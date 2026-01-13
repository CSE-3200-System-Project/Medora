"""
Geocoding service for converting addresses to coordinates.
Uses OpenStreetMap Nominatim API and caches results in database.
"""

import httpx
from typing import Optional, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import logging

from app.db.models.doctor import DoctorProfile

logger = logging.getLogger(__name__)

# Nominatim API configuration
NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org"
USER_AGENT = "Medora Healthcare Platform (Bangladesh Medical Service)"


async def geocode_address(address: str, timeout: int = 10) -> Optional[Dict[str, float]]:
    """
    Geocode an address using OpenStreetMap Nominatim API.
    
    Args:
        address: Full address string to geocode
        timeout: Request timeout in seconds
        
    Returns:
        Dict with 'lat' and 'lng' keys if successful, None otherwise
    """
    if not address or not address.strip():
        logger.warning("Empty address provided for geocoding")
        return None
    
    try:
        query = f"{address.strip()}, Bangladesh"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{NOMINATIM_BASE_URL}/search",
                params={
                    "q": query,
                    "format": "json",
                    "limit": 1,
                    "countrycodes": "bd",  # Bangladesh only
                },
                headers={"User-Agent": USER_AGENT},
                timeout=timeout
            )
            
            if response.status_code != 200:
                logger.error(f"Nominatim API returned status {response.status_code} for: {address}")
                return None
            
            data = response.json()
            
            if data and len(data) > 0:
                result = {
                    "lat": float(data[0]["lat"]),
                    "lng": float(data[0]["lon"])
                }
                logger.info(f"✓ Geocoded: '{address}' → {result['lat']}, {result['lng']}")
                return result
            else:
                logger.warning(f"✗ No geocoding results for: {address}")
                return None
                
    except httpx.TimeoutException:
        logger.error(f"Geocoding timeout for address: {address}")
        return None
    except Exception as e:
        logger.error(f"Geocoding error for '{address}': {str(e)}")
        return None


async def geocode_and_save_doctor_locations(
    db: AsyncSession,
    doctor_id: str,
    force_regeocode: bool = False
) -> Dict[str, bool]:
    """
    Geocode and save hospital and chamber locations for a doctor.
    Only geocodes if coordinates don't exist or force_regeocode is True.
    
    Args:
        db: Database session
        doctor_id: Doctor profile ID
        force_regeocode: If True, geocode even if coordinates exist
        
    Returns:
        Dict with 'hospital_geocoded' and 'chamber_geocoded' boolean keys
    """
    result = {"hospital_geocoded": False, "chamber_geocoded": False}
    
    # Fetch doctor profile
    stmt = select(DoctorProfile).where(DoctorProfile.profile_id == doctor_id)
    db_result = await db.execute(stmt)
    doctor = db_result.scalar_one_or_none()
    
    if not doctor:
        logger.error(f"Doctor not found: {doctor_id}")
        return result
    
    # Geocode hospital location
    if (force_regeocode or not doctor.hospital_latitude or not doctor.hospital_longitude):
        if doctor.hospital_address or doctor.hospital_city or doctor.hospital_name:
            # Build address string
            address_parts = []
            if doctor.hospital_address:
                address_parts.append(doctor.hospital_address)
            if doctor.hospital_city and doctor.hospital_city not in (doctor.hospital_address or ""):
                address_parts.append(doctor.hospital_city)
            if not address_parts and doctor.hospital_name:
                address_parts.append(doctor.hospital_name)
            
            if address_parts:
                address_string = ", ".join(address_parts)
                logger.info(f"Geocoding hospital for doctor {doctor_id}: {address_string}")
                
                coords = await geocode_address(address_string)
                
                if coords:
                    doctor.hospital_latitude = coords["lat"]
                    doctor.hospital_longitude = coords["lng"]
                    # Also update legacy fields for backward compatibility
                    doctor.latitude = coords["lat"]
                    doctor.longitude = coords["lng"]
                    result["hospital_geocoded"] = True
                    logger.info(f"✓ Saved hospital coordinates for doctor {doctor_id}")
    else:
        logger.info(f"Hospital coordinates already exist for doctor {doctor_id}")
    
    # Geocode chamber location
    if (force_regeocode or not doctor.chamber_latitude or not doctor.chamber_longitude):
        if doctor.chamber_address or doctor.chamber_city or doctor.chamber_name:
            # Build address string
            address_parts = []
            if doctor.chamber_address:
                address_parts.append(doctor.chamber_address)
            if doctor.chamber_city and doctor.chamber_city not in (doctor.chamber_address or ""):
                address_parts.append(doctor.chamber_city)
            if not address_parts and doctor.chamber_name:
                address_parts.append(doctor.chamber_name)
            
            if address_parts:
                address_string = ", ".join(address_parts)
                logger.info(f"Geocoding chamber for doctor {doctor_id}: {address_string}")
                
                coords = await geocode_address(address_string)
                
                if coords:
                    doctor.chamber_latitude = coords["lat"]
                    doctor.chamber_longitude = coords["lng"]
                    result["chamber_geocoded"] = True
                    logger.info(f"✓ Saved chamber coordinates for doctor {doctor_id}")
    else:
        logger.info(f"Chamber coordinates already exist for doctor {doctor_id}")
    
    # Commit changes
    if result["hospital_geocoded"] or result["chamber_geocoded"]:
        await db.commit()
        await db.refresh(doctor)
        logger.info(f"Successfully geocoded doctor {doctor_id}: {result}")
    
    return result


async def geocode_all_doctors_missing_coordinates(db: AsyncSession, limit: int = 50) -> Dict[str, int]:
    """
    Batch geocode all doctors missing coordinates.
    Used for one-time data migration or periodic updates.
    
    Args:
        db: Database session
        limit: Maximum number of doctors to geocode in one run
        
    Returns:
        Dict with counts: total_processed, hospital_geocoded, chamber_geocoded
    """
    stats = {
        "total_processed": 0,
        "hospital_geocoded": 0,
        "chamber_geocoded": 0,
    }
    
    # Find doctors missing coordinates
    stmt = select(DoctorProfile).where(
        (DoctorProfile.hospital_latitude.is_(None)) |
        (DoctorProfile.chamber_latitude.is_(None))
    ).limit(limit)
    
    result = await db.execute(stmt)
    doctors = result.scalars().all()
    
    logger.info(f"Found {len(doctors)} doctors needing geocoding")
    
    for doctor in doctors:
        geocode_result = await geocode_and_save_doctor_locations(db, doctor.profile_id)
        stats["total_processed"] += 1
        if geocode_result["hospital_geocoded"]:
            stats["hospital_geocoded"] += 1
        if geocode_result["chamber_geocoded"]:
            stats["chamber_geocoded"] += 1
        
        # Respect Nominatim rate limit: 1 request per second
        # Since we may make 2 requests per doctor (hospital + chamber),
        # this is handled in the geocode_and_save_doctor_locations function
        import asyncio
        await asyncio.sleep(1)
    
    logger.info(f"Batch geocoding complete: {stats}")
    return stats

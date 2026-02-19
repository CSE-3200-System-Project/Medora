"""
Cleanup script for duplicate active consultations.
This script finds and closes duplicate active consultations, keeping only the most recent one.
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone
from app.db.session import AsyncSessionLocal
from app.db.models.consultation import Consultation
from app.db.models.enums import ConsultationStatus


async def cleanup_duplicate_consultations():
    """Find and close duplicate active consultations."""
    async with AsyncSessionLocal() as db:
        try:
            # Find all doctor-patient pairs with multiple active consultations
            result = await db.execute(
                select(
                    Consultation.doctor_id,
                    Consultation.patient_id,
                    func.count(Consultation.id).label('count')
                )
                .where(Consultation.status == ConsultationStatus.OPEN)
                .group_by(Consultation.doctor_id, Consultation.patient_id)
                .having(func.count(Consultation.id) > 1)
            )
            
            duplicates = result.all()
            
            if not duplicates:
                print("✅ No duplicate active consultations found!")
                return
            
            print(f"Found {len(duplicates)} doctor-patient pairs with duplicate active consultations")
            
            total_closed = 0
            
            for doctor_id, patient_id, count in duplicates:
                print(f"\n📋 Doctor {doctor_id} - Patient {patient_id}: {count} active consultations")
                
                # Get all active consultations for this pair
                result = await db.execute(
                    select(Consultation)
                    .where(
                        and_(
                            Consultation.doctor_id == doctor_id,
                            Consultation.patient_id == patient_id,
                            Consultation.status == ConsultationStatus.OPEN
                        )
                    )
                    .order_by(Consultation.created_at.desc())
                )
                consultations = result.scalars().all()
                
                # Keep the most recent one, close the rest
                for i, consultation in enumerate(consultations):
                    if i == 0:
                        print(f"  ✓ Keeping consultation {consultation.id} (most recent)")
                    else:
                        print(f"  ✗ Closing consultation {consultation.id} (duplicate)")
                        consultation.status = ConsultationStatus.COMPLETED
                        consultation.completed_at = datetime.now(timezone.utc)
                        total_closed += 1
            
            await db.commit()
            print(f"\n✅ Cleanup complete! Closed {total_closed} duplicate consultations.")
            
        except Exception as e:
            print(f"❌ Error during cleanup: {str(e)}")
            await db.rollback()
            raise


if __name__ == "__main__":
    print("Starting duplicate consultation cleanup...\n")
    asyncio.run(cleanup_duplicate_consultations())

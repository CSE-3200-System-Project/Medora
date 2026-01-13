"use client";

import React, { useState, useEffect, useCallback } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Map,
  MapMarker,
  MarkerContent,
  MapControls,
  useMap,
} from "@/components/ui/map";

interface LocationPickerProps {
  value?: {
    address: string;
    city: string;
    latitude?: number;
    longitude?: number;
  };
  onChange: (location: {
    address: string;
    city: string;
    latitude: number;
    longitude: number;
  }) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}

// Default center (Dhaka, Bangladesh)
const DEFAULT_CENTER: [number, number] = [90.4125, 23.8103];

// Geocode a location text using Nominatim
async function geocodeLocation(locationText: string): Promise<{
  lat: number;
  lng: number;
  displayName: string;
} | null> {
  try {
    const query = encodeURIComponent(`${locationText}, Bangladesh`);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'Medora Healthcare Platform',
        },
      }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        displayName: data[0].display_name,
      };
    }
    return null;
  } catch (error) {
    console.warn('Geocoding failed:', error);
    return null;
  }
}

// Reverse geocode coordinates to address
async function reverseGeocode(lat: number, lng: number): Promise<{
  address: string;
  city: string;
} | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'Medora Healthcare Platform',
        },
      }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data && data.address) {
      const address = [
        data.address.road,
        data.address.suburb,
        data.address.neighbourhood
      ].filter(Boolean).join(', ');
      
      const city = data.address.city || data.address.town || data.address.district || '';
      
      return { address, city };
    }
    return null;
  } catch (error) {
    console.warn('Reverse geocoding failed:', error);
    return null;
  }
}

function LocationMarker() {
  return (
    <div className="relative flex items-center justify-center">
      <div className="w-10 h-10 rounded-full bg-primary border-2 border-white shadow-lg flex items-center justify-center">
        <MapPin className="w-5 h-5 text-white" />
      </div>
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-primary" />
    </div>
  );
}

export function LocationPicker({
  value,
  onChange,
  label = "Location",
  placeholder = "Enter address or drag marker on map",
  className,
}: LocationPickerProps) {
  const [searchText, setSearchText] = useState(value?.address || "");
  const [isSearching, setIsSearching] = useState(false);
  const [markerPosition, setMarkerPosition] = useState<{ lat: number; lng: number } | null>(
    value?.latitude && value?.longitude
      ? { lat: value.latitude, lng: value.longitude }
      : null
  );
  const [mapCenter, setMapCenter] = useState<[number, number]>(
    value?.latitude && value?.longitude
      ? [value.longitude, value.latitude]
      : DEFAULT_CENTER
  );

  // Search for location
  const handleSearch = useCallback(async () => {
    if (!searchText.trim()) return;
    
    setIsSearching(true);
    const result = await geocodeLocation(searchText);
    setIsSearching(false);
    
    if (result) {
      setMarkerPosition({ lat: result.lat, lng: result.lng });
      setMapCenter([result.lng, result.lat]);
      
      // Reverse geocode to get structured address
      const addressInfo = await reverseGeocode(result.lat, result.lng);
      
      onChange({
        address: addressInfo?.address || searchText,
        city: addressInfo?.city || value?.city || "",
        latitude: result.lat,
        longitude: result.lng,
      });
    }
  }, [searchText, onChange, value?.city]);

  // Handle drag end
  const handleDragEnd = useCallback(async (lngLat: { lng: number; lat: number }) => {
    setMarkerPosition({ lat: lngLat.lat, lng: lngLat.lng });
    
    // Reverse geocode to get address
    const addressInfo = await reverseGeocode(lngLat.lat, lngLat.lng);
    
    if (addressInfo) {
      setSearchText(addressInfo.address);
      onChange({
        address: addressInfo.address,
        city: addressInfo.city,
        latitude: lngLat.lat,
        longitude: lngLat.lng,
      });
    } else {
      onChange({
        address: value?.address || "",
        city: value?.city || "",
        latitude: lngLat.lat,
        longitude: lngLat.lng,
      });
    }
  }, [onChange, value?.address, value?.city]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  };

  // Handle enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <div className={className}>
      <Label className="mb-2 block">{label}</Label>
      
      {/* Search Input */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="pl-9"
          />
        </div>
        <Button 
          type="button" 
          variant="secondary" 
          onClick={handleSearch}
          disabled={isSearching}
        >
          {isSearching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Search"
          )}
        </Button>
      </div>
      
      {/* Map */}
      <div className="h-[250px] rounded-lg border border-border overflow-hidden">
        <Map center={mapCenter} zoom={markerPosition ? 15 : 11}>
          <MapControls
            position="bottom-right"
            showZoom
            showLocate
            onLocate={(coords) => {
              setMarkerPosition({ lat: coords.latitude, lng: coords.longitude });
              setMapCenter([coords.longitude, coords.latitude]);
              
              // Reverse geocode
              reverseGeocode(coords.latitude, coords.longitude).then(addressInfo => {
                if (addressInfo) {
                  setSearchText(addressInfo.address);
                  onChange({
                    address: addressInfo.address,
                    city: addressInfo.city,
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                  });
                }
              });
            }}
          />
          
          {markerPosition && (
            <MapMarker
              longitude={markerPosition.lng}
              latitude={markerPosition.lat}
              draggable
              onDragEnd={handleDragEnd}
            >
              <MarkerContent className="cursor-grab active:cursor-grabbing">
                <LocationMarker />
              </MarkerContent>
            </MapMarker>
          )}
        </Map>
      </div>
      
      <p className="text-xs text-muted-foreground mt-2">
        Search for your location or drag the marker to set exact position
      </p>
    </div>
  );
}

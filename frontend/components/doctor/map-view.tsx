"use client";

import React, { useState, useEffect } from "react";
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow, useMapsLibrary } from "@vis.gl/react-google-maps";
import { MapPin, User, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Doctor {
  profile_id: string;
  first_name: string;
  last_name: string;
  title?: string;
  specialization: string;
  hospital_name?: string;
  hospital_address?: string;
  hospital_city?: string;
  profile_photo_url?: string;
  consultation_fee?: number;
}

interface MapViewProps {
  doctors: Doctor[];
  className?: string;
}

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

const MapContent = ({ doctors }: { doctors: Doctor[] }) => {
  const geocodingLib = useMapsLibrary("geocoding");
  const [locations, setLocations] = useState<Record<string, google.maps.LatLngLiteral>>({});
  const [selectedDoc, setSelectedDoc] = useState<Doctor | null>(null);
  
  // Default center (Dhaka)
  const defaultCenter = { lat: 23.8103, lng: 90.4125 };

  useEffect(() => {
    if (!geocodingLib || !doctors.length) return;

    const geocoder = new geocodingLib.Geocoder();
    let isMounted = true;

    const processDoctors = async () => {
      // Create a queue of doctors that have addresses but no location yet
      const docsToGeocode = doctors.filter(doc => {
        // Skip if already geocoded
        if (locations[doc.profile_id]) return false;
        
        // Skip if no address
        if (!doc.hospital_name && !doc.hospital_address) return false;
        
        return true;
      });

      // Limit to 5 at a time to be safe with quotas during demo
      for (const doc of docsToGeocode.slice(0, 5)) {
        if (!isMounted) break;

        const address = [
            doc.hospital_name, 
            doc.hospital_address, 
            doc.hospital_city, 
            "Bangladesh"
        ].filter(Boolean).join(", ");

        if (!address) continue;

        try {
          const result = await geocoder.geocode({ address });
          if (result.results[0]?.geometry?.location) {
            const loc = result.results[0].geometry.location;
            
            // Update state safely
            setLocations(prev => ({
              ...prev,
              [doc.profile_id]: { lat: loc.lat(), lng: loc.lng() }
            }));
          }
        } catch (e) {
            console.warn(`Geocoding failed for ${doc.first_name}:`, e);
        }
        
        // Small delay between requests
        await new Promise(r => setTimeout(r, 500));
      }
    };

    processDoctors();

    return () => { isMounted = false; };
  }, [doctors, geocodingLib]);

  return (
    <Map
      defaultCenter={defaultCenter}
      defaultZoom={11}
      mapId="DEMO_MAP_ID" 
      className="w-full h-full"
      disableDefaultUI={false}
      gestureHandling={'greedy'}
    >
      {doctors.map(doctor => {
        const position = locations[doctor.profile_id];
        if (!position) return null;

        return (
            <AdvancedMarker
                key={doctor.profile_id}
                position={position}
                onClick={() => setSelectedDoc(doctor)}
            >
                <Pin background={'#0360D9'} borderColor={'#004299'} glyphColor={'white'} />
            </AdvancedMarker>
        );
      })}

      {selectedDoc && locations[selectedDoc.profile_id] && (
        <InfoWindow
          position={locations[selectedDoc.profile_id]}
          onCloseClick={() => setSelectedDoc(null)}
          className="min-w-[200px]"
        >
          <div className="p-2">
            <div className="flex items-center gap-3 mb-2">
                <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedDoc.profile_photo_url} />
                    <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                </Avatar>
                <div>
                   <h4 className="font-bold text-sm text-gray-900">{selectedDoc.title} {selectedDoc.first_name} {selectedDoc.last_name}</h4>
                   <p className="text-xs text-primary">{selectedDoc.specialization}</p>
                </div>
            </div>
            
            <div className="text-xs text-muted-foreground space-y-1 mb-3">
               <p className="font-medium text-gray-700">{selectedDoc.hospital_name}</p>
               <p>{selectedDoc.hospital_address}, {selectedDoc.hospital_city}</p>
            </div>

            <Button size="sm" className="w-full h-8 text-xs" onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedDoc.hospital_name || '')}`, '_blank')}>
                <Navigation className="h-3 w-3 mr-1" /> Get Directions
            </Button>
          </div>
        </InfoWindow>
      )}
    </Map>
  );
};

export function MapView({ doctors = [], className }: MapViewProps) {
  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className={`w-full h-full min-h-[400px] bg-slate-100 rounded-2xl border border-border flex items-center justify-center p-6 ${className}`}>
         <div className="text-center">
            <MapPin className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Map is unavailable (Missing API Key)</p>
         </div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
      <div className={`w-full h-full min-h-[400px] bg-slate-100 rounded-2xl border border-border overflow-hidden relative ${className}`}>
        <MapContent doctors={doctors} />
      </div>
    </APIProvider>
  );
}

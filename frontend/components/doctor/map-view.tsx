"use client";

import React, { useState } from "react";
import { MapPin, Plus, Stethoscope, Navigation, Clock, Route, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MedoraLoader } from "@/components/ui/medora-loader";
import { CardSkeleton } from "@/components/ui/skeleton-loaders";
import {
  Map as MedoraMap,
  MapMarker,
  MarkerContent,
  MarkerPopup,
  MarkerTooltip,
  MapControls,
  MapRoute,
  MarkerLabel,
} from "@/components/ui/map-lazy";

interface Doctor {
  profile_id: string;
  first_name: string;
  last_name: string;
  title?: string;
  specialization: string;
  hospital_name?: string;
  hospital_address?: string;
  hospital_city?: string;
  hospital_latitude?: number;
  hospital_longitude?: number;
  chamber_name?: string;
  chamber_address?: string;
  chamber_city?: string;
  chamber_latitude?: number;
  chamber_longitude?: number;
  // AI search fields
  latitude?: number;
  longitude?: number;
  profile_photo_url?: string;
  consultation_fee?: number;
  visiting_hours?: string;
}

interface DoctorLocation {
  type: 'hospital' | 'chamber';
  name: string;
  address?: string;
  city?: string;
  latitude: number;
  longitude: number;
  doctor: Doctor;
}

interface RouteData {
  coordinates: [number, number][];
  duration: number; // seconds
  distance: number; // meters
}

interface MapViewProps {
  doctors: Doctor[];
  className?: string;
  userLocation?: { latitude: number; longitude: number } | null;
  onDoctorSelect?: (doctor: Doctor) => void;
}

// Default center (Dhaka, Bangladesh)
const DEFAULT_CENTER: [number, number] = [90.4125, 23.8103];
const DEFAULT_ZOOM = 11;
const ROUTE_CACHE_TTL_MS = 5 * 60 * 1000;
const routeCache = new Map<string, { data: RouteData[]; ts: number }>();

// Format duration from seconds
function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m`;
}

// Format distance from meters
function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

// Fetch routes from OSRM API
async function fetchRoutes(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  signal?: AbortSignal,
): Promise<RouteData[]> {
  const cacheKey = `${from.lat.toFixed(4)},${from.lng.toFixed(4)}-${to.lat.toFixed(4)},${to.lng.toFixed(4)}`;
  const cached = routeCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < ROUTE_CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&alternatives=true`,
      {
        signal,
        cache: "force-cache",
      },
    );
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    
    if (data.routes && data.routes.length > 0) {
      const parsed = data.routes.map((route: any) => ({
        coordinates: route.geometry.coordinates,
        duration: route.duration,
        distance: route.distance,
      }));
      routeCache.set(cacheKey, { data: parsed, ts: Date.now() });
      return parsed;
    }
    
    return [];
  } catch {
    return [];
  }
}

// Hospital marker icon (red cross)
function HospitalMarkerIcon({ isSelected }: { isSelected?: boolean }) {
  return (
    <div className={`
      relative flex items-center justify-center
      w-10 h-10 rounded-full
      ${isSelected ? 'bg-red-500 scale-110' : 'bg-red-500/90'}
      border-2 border-white shadow-lg
      transition-transform duration-200
      hover:scale-110
    `}>
      <Plus className="w-6 h-6 text-white" strokeWidth={3} />
      <div className={`
        absolute -bottom-2 left-1/2 -translate-x-1/2
        w-0 h-0
        border-l-[6px] border-l-transparent
        border-r-[6px] border-r-transparent
        border-t-[8px] ${isSelected ? 'border-t-red-500' : 'border-t-red-500/90'}
      `} />
    </div>
  );
}

// Chamber marker icon (green clinic)
function ChamberMarkerIcon({ isSelected }: { isSelected?: boolean }) {
  return (
    <div className={`
      relative flex items-center justify-center
      w-10 h-10 rounded-full
      ${isSelected ? 'bg-green-500 scale-110' : 'bg-green-500/90'}
      border-2 border-white shadow-lg
      transition-transform duration-200
      hover:scale-110
    `}>
      <Stethoscope className="w-5 h-5 text-white" />
      <div className={`
        absolute -bottom-2 left-1/2 -translate-x-1/2
        w-0 h-0
        border-l-[6px] border-l-transparent
        border-r-[6px] border-r-transparent
        border-t-[8px] ${isSelected ? 'border-t-green-500' : 'border-t-green-500/90'}
      `} />
    </div>
  );
}

// Location popup content
function LocationPopupContent({ 
  location,
  onGetDirections 
}: { 
  location: DoctorLocation;
  onGetDirections: () => void;
}) {
  const { doctor, type, name, address, city } = location;
  
  return (
    <div className="min-w-[240px] p-3">
      <div className="flex items-center gap-3 mb-3">
        <Avatar className="h-12 w-12 border-2 border-primary/20">
          <AvatarImage src={doctor.profile_photo_url} />
          <AvatarFallback className="bg-primary/10 text-primary text-xs">
            {doctor.first_name[0]}{doctor.last_name[0]}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm text-foreground truncate">
            {doctor.title} {doctor.first_name} {doctor.last_name}
          </h4>
          <Badge variant="secondary" className="text-xs mt-0.5">
            {doctor.specialization}
          </Badge>
        </div>
      </div>
      
      <Badge 
        variant={type === 'hospital' ? 'destructive' : 'default'}
        className="mb-2 text-xs"
      >
        {type === 'hospital' ? 'Hospital' : 'Chamber'}
      </Badge>
      
      <div className="space-y-2 text-xs text-muted-foreground mb-3">
        {name && (
          <div className="flex items-start gap-2">
            <MapPin className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
            <div>
              <p className="font-medium text-foreground">{name}</p>
              {address && <p>{address}</p>}
              {city && <p>{city}</p>}
            </div>
          </div>
        )}
        
        {doctor.visiting_hours && (
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span>{doctor.visiting_hours}</span>
          </div>
        )}
        
        {doctor.consultation_fee && (
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">
              ৳{doctor.consultation_fee}
            </span>
            <span>consultation fee</span>
          </div>
        )}
      </div>

      <Button 
        size="sm" 
        className="w-full h-8 text-xs"
        onClick={onGetDirections}
      >
        <Navigation className="h-3 w-3 mr-1.5" />
        Get Directions
      </Button>
    </div>
  );
}

export function MapView({ 
  doctors = [], 
  className,
  userLocation,
  onDoctorSelect 
}: MapViewProps) {
  const [selectedLocation, setSelectedLocation] = useState<DoctorLocation | null>(null);
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  // Convert doctors to locations (hospital + chamber + generic lat/lng)
  const allLocations: DoctorLocation[] = React.useMemo(() => {
    const locations: DoctorLocation[] = [];
    
    doctors.forEach(doctor => {
      // Add hospital location if coordinates exist
      if (doctor.hospital_latitude && doctor.hospital_longitude) {
        locations.push({
          type: 'hospital',
          name: doctor.hospital_name || 'Hospital',
          address: doctor.hospital_address,
          city: doctor.hospital_city,
          latitude: doctor.hospital_latitude,
          longitude: doctor.hospital_longitude,
          doctor
        });
      }
      
      // Add chamber location if coordinates exist
      if (doctor.chamber_latitude && doctor.chamber_longitude) {
        locations.push({
          type: 'chamber',
          name: doctor.chamber_name || 'Chamber',
          address: doctor.chamber_address,
          city: doctor.chamber_city,
          latitude: doctor.chamber_latitude,
          longitude: doctor.chamber_longitude,
          doctor
        });
      }
      
      // For AI search results: Add generic location if no hospital/chamber coordinates exist
      // but generic latitude/longitude are available (from AI search)
      if ((!doctor.hospital_latitude || !doctor.hospital_longitude) && 
          (!doctor.chamber_latitude || !doctor.chamber_longitude) &&
          doctor.latitude && doctor.longitude) {
        // Determine location type based on available data
        const hasHospitalData = doctor.hospital_name || doctor.hospital_address;
        const hasChamberData = doctor.chamber_name || doctor.chamber_address;
        
        if (hasHospitalData) {
          locations.push({
            type: 'hospital',
            name: doctor.hospital_name || 'Hospital',
            address: doctor.hospital_address,
            city: doctor.hospital_city,
            latitude: doctor.latitude,
            longitude: doctor.longitude,
            doctor
          });
        } else if (hasChamberData) {
          locations.push({
            type: 'chamber',
            name: doctor.chamber_name || 'Chamber',
            address: doctor.chamber_address,
            city: doctor.chamber_city,
            latitude: doctor.latitude,
            longitude: doctor.longitude,
            doctor
          });
        } else {
          // Fallback: treat as hospital location
          locations.push({
            type: 'hospital',
            name: doctor.hospital_name || doctor.chamber_name || 'Clinic',
            address: doctor.hospital_address || doctor.chamber_address,
            city: doctor.hospital_city || doctor.chamber_city,
            latitude: doctor.latitude,
            longitude: doctor.longitude,
            doctor
          });
        }
      }
    });
    
    return locations;
  }, [doctors]);

  // Calculate map center - prioritize patient location, then doctor locations
  const mapCenter = React.useMemo(() => {
    if (userLocation) {
      return [userLocation.longitude, userLocation.latitude] as [number, number];
    }
    
    if (allLocations.length === 0) return DEFAULT_CENTER;
    
    // Calculate centroid of all doctor locations
    let sumLng = 0, sumLat = 0;
    allLocations.forEach(loc => {
      sumLng += loc.longitude;
      sumLat += loc.latitude;
    });
    
    return [sumLng / allLocations.length, sumLat / allLocations.length] as [number, number];
  }, [allLocations, userLocation]);

  // Handle get directions
  const handleGetDirections = async (location: DoctorLocation) => {
    if (!userLocation) {
      setRouteError("Enable location services to get directions.");
      return;
    }

    setIsLoadingRoutes(true);
    setRouteError(null);
    setSelectedLocation(location);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 5000);
    const routesData = await fetchRoutes(
      { lat: userLocation.latitude, lng: userLocation.longitude },
      { lat: location.latitude, lng: location.longitude },
      controller.signal,
    );
    window.clearTimeout(timeoutId);
    
    setRoutes(routesData);
    setSelectedRouteIndex(0);
    setIsLoadingRoutes(false);
    
    if (routesData.length === 0) {
      setRouteError("Unable to find a route right now. Please try again.");
    }
  };

  // Clear route
  const clearRoute = () => {
    setRoutes([]);
    setSelectedLocation(null);
    setSelectedRouteIndex(0);
    setRouteError(null);
  };

  // Handle marker click
  const handleMarkerClick = (location: DoctorLocation) => {
    setSelectedLocation(location);
    onDoctorSelect?.(location.doctor);
  };

  // Sort routes: non-selected first, selected last (renders on top)
  const sortedRoutes = routes
    .map((route, index) => ({ route, index }))
    .sort((a, b) => {
      if (a.index === selectedRouteIndex) return 1;
      if (b.index === selectedRouteIndex) return -1;
      return 0;
    });

  if (doctors.length === 0) {
    return (
      <div className={`w-full h-full min-h-[400px] bg-surface rounded-2xl border border-border flex items-center justify-center p-6 ${className}`}>
        <div className="text-center">
          <MapPin className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No doctors to display on map</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full h-full min-h-[400px] rounded-2xl border border-border overflow-hidden relative ${className}`}>
      <MedoraMap center={mapCenter} zoom={DEFAULT_ZOOM}>
        <MapControls
          position="bottom-right"
          showZoom
          showCompass
          showLocate
          showFullscreen
        />

        {/* Draw routes if available */}
        {sortedRoutes.map(({ route, index }) => {
          const isSelected = index === selectedRouteIndex;
          return (
            <MapRoute
              key={index}
              coordinates={route.coordinates}
              color={isSelected ? '#6366f1' : '#94a3b8'}
              width={isSelected ? 6 : 5}
              opacity={isSelected ? 1 : 0.6}
              onClick={() => setSelectedRouteIndex(index)}
            />
          );
        })}

        {/* Patient location marker */}
        {userLocation && (
          <MapMarker
            longitude={userLocation.longitude}
            latitude={userLocation.latitude}
          >
            <MarkerContent>
              <div className="relative flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500 border-2 border-white shadow-md"></span>
              </div>
            </MarkerContent>
            <MarkerLabel position="top" className="text-xs font-medium">
              You
            </MarkerLabel>
          </MapMarker>
        )}

        {/* Doctor location markers */}
        {allLocations.map((location) => {
          const isSelected = selectedLocation?.doctor.profile_id === location.doctor.profile_id &&
                            selectedLocation?.type === location.type;
          const uniqueKey = `${location.doctor.profile_id}-${location.type}`;

          return (
            <MapMarker
              key={uniqueKey}
              longitude={location.longitude}
              latitude={location.latitude}
              onClick={() => handleMarkerClick(location)}
            >
              <MarkerContent className="cursor-pointer">
                {location.type === 'hospital' ? (
                  <HospitalMarkerIcon isSelected={isSelected} />
                ) : (
                  <ChamberMarkerIcon isSelected={isSelected} />
                )}
              </MarkerContent>
              
              <MarkerTooltip className="text-xs font-medium">
                {location.doctor.title} {location.doctor.first_name} {location.doctor.last_name}
                <br />
                <span className="text-[10px] opacity-80">
                  {location.type === 'hospital' ? 'Hospital' : 'Chamber'}
                </span>
              </MarkerTooltip>
              
              <MarkerPopup className="!p-0" closeButton>
                <LocationPopupContent 
                  location={location}
                  onGetDirections={() => handleGetDirections(location)}
                />
              </MarkerPopup>
            </MapMarker>
          );
        })}

        {/* Destination marker when route is active */}
        {selectedLocation && routes.length > 0 && (
          <MapMarker
            longitude={selectedLocation.longitude}
            latitude={selectedLocation.latitude}
          >
            <MarkerContent>
              <div className="w-5 h-5 rounded-full bg-red-500 border-2 border-white shadow-lg" />
            </MarkerContent>
          </MapMarker>
        )}
      </MedoraMap>

      {/* Route selection panel */}
      {routes.length > 0 && (
        <div className="absolute top-3 left-3 flex flex-col gap-2 bg-background/95 backdrop-blur-sm rounded-xl p-3 shadow-lg border border-border max-w-[280px]">
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-sm">Route Options</span>
            <Button 
              size="sm" 
              variant="ghost" 
              className="h-6 w-6 p-0" 
              onClick={clearRoute}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          
          {routes.map((route, index) => {
            const isActive = index === selectedRouteIndex;
            const isFastest = index === 0;
            return (
              <Button
                key={index}
                variant={isActive ? "default" : "secondary"}
                size="sm"
                onClick={() => setSelectedRouteIndex(index)}
                className="justify-start gap-3 h-auto py-2"
              >
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="font-medium text-sm">
                    {formatDuration(route.duration)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs opacity-80">
                  <Route className="w-3 h-3" />
                  {formatDistance(route.distance)}
                </div>
                {isFastest && (
                  <Badge variant="default" className="text-[10px] px-1.5 py-0.5 ml-auto bg-success text-primary-foreground">
                    Fastest
                  </Badge>
                )}
              </Button>
            );
          })}
        </div>
      )}

      {/* Loading indicator */}
      {isLoadingRoutes && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm">
          <div className="space-y-3 rounded-lg border border-border bg-background/95 px-4 py-3 shadow-lg">
            <MedoraLoader size="sm" label="Finding best routes..." />
            <CardSkeleton className="h-6 w-56" />
          </div>
        </div>
      )}

      {/* Stats indicator */}
      {routes.length === 0 && (
        <div className="absolute top-3 left-3 bg-background/95 backdrop-blur-sm rounded-lg px-4 py-2 text-sm text-muted-foreground shadow-md border border-border">
          <span className="font-medium text-primary">
            {allLocations.length}
          </span>
          {' '}location{allLocations.length !== 1 ? 's' : ''} shown
        </div>
      )}

      {routeError && (
        <div className="absolute bottom-3 left-3 max-w-[300px] rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 shadow-sm">
          {routeError}
        </div>
      )}
    </div>
  );
}

"use client";

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Map, MapControls, MapMarker, MarkerContent, MarkerTooltip } from '@/components/ui/map';
import { Navbar } from '@/components/ui/navbar';
import { Ambulance, Phone } from 'lucide-react';

// Sample ambulance data - in production this would come from an API
const AMBULANCES = [
  { id: 1, name: "Dhaka Medical Ambulance", phone: "01711-000001", lat: 23.7104, lng: 90.4074 },
  { id: 2, name: "Square Hospital Ambulance", phone: "01711-000002", lat: 23.7525, lng: 90.3893 },
  { id: 3, name: "United Hospital Ambulance", phone: "01711-000003", lat: 23.8041, lng: 90.4152 },
  { id: 4, name: "Apollo Ambulance", phone: "01711-000004", lat: 23.7835, lng: 90.4014 },
];

// Default center (Dhaka, Bangladesh)
const DEFAULT_CENTER: [number, number] = [90.4125, 23.8103];

export default function FindAmbulancePage() {
  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      
      <main className="pt-24 pb-8 px-4 md:px-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Find Ambulance</h1>
          <p className="text-muted-foreground">
            Locate nearby ambulance services for emergency transport
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6">
          {/* Map */}
          <Card className="p-0 overflow-hidden">
            <div className="h-[500px] lg:h-[600px]">
              <Map center={DEFAULT_CENTER} zoom={12}>
                <MapControls
                  position="bottom-right"
                  showZoom
                  showCompass
                  showLocate
                  showFullscreen
                />
                
                {AMBULANCES.map((ambulance) => (
                  <MapMarker
                    key={ambulance.id}
                    longitude={ambulance.lng}
                    latitude={ambulance.lat}
                  >
                    <MarkerContent className="cursor-pointer">
                      <div className="w-10 h-10 rounded-full bg-destructive border-2 border-white shadow-lg flex items-center justify-center">
                        <Ambulance className="w-5 h-5 text-white" />
                      </div>
                    </MarkerContent>
                    <MarkerTooltip className="text-xs font-medium">
                      {ambulance.name}
                    </MarkerTooltip>
                  </MapMarker>
                ))}
              </Map>
            </div>
          </Card>
          
          {/* Ambulance List */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Nearby Ambulances</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {AMBULANCES.map((ambulance) => (
                  <div
                    key={ambulance.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                      <Ambulance className="w-5 h-5 text-destructive" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{ambulance.name}</p>
                      <a
                        href={`tel:${ambulance.phone}`}
                        className="text-xs text-primary flex items-center gap-1 hover:underline"
                      >
                        <Phone className="w-3 h-3" />
                        {ambulance.phone}
                      </a>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            
            <Card className="bg-destructive/5 border-destructive/20">
              <CardContent className="p-4">
                <h4 className="font-semibold text-destructive mb-2">Emergency?</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Call the national emergency number for immediate assistance
                </p>
                <a
                  href="tel:999"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-destructive text-white rounded-lg font-medium text-sm hover:bg-destructive/90 transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  Call 999
                </a>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
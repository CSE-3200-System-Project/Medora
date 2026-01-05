import React from "react";
import { MapPin } from "lucide-react";

export function MapView() {
  return (
    <div className="w-full h-full min-h-[400px] bg-slate-100 rounded-2xl border border-border flex items-center justify-center relative overflow-hidden">
      {/* Placeholder for actual map implementation */}
      <div className="absolute inset-0 opacity-20 bg-[url('https://upload.wikimedia.org/wikipedia/commons/e/ec/Dhaka_City_Map.png')] bg-cover bg-center" />
      
      <div className="z-10 text-center p-6 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg max-w-xs">
        <MapPin className="h-10 w-10 text-primary mx-auto mb-3" />
        <h3 className="font-bold text-lg mb-1">Map View</h3>
        <p className="text-sm text-muted-foreground">
          Interactive map showing doctor locations will be displayed here.
        </p>
      </div>
    </div>
  );
}

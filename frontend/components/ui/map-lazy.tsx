"use client";

import dynamic from "next/dynamic";

const loadingFallback = () => (
  <div className="absolute inset-0 flex items-center justify-center bg-background/70">
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  </div>
);

export const Map = dynamic(() => import("@/components/ui/map").then((m) => m.Map), {
  ssr: false,
  loading: loadingFallback,
});

export const MapMarker = dynamic(() => import("@/components/ui/map").then((m) => m.MapMarker), {
  ssr: false,
});

export const MarkerContent = dynamic(
  () => import("@/components/ui/map").then((m) => m.MarkerContent),
  { ssr: false },
);

export const MarkerPopup = dynamic(() => import("@/components/ui/map").then((m) => m.MarkerPopup), {
  ssr: false,
});

export const MarkerTooltip = dynamic(
  () => import("@/components/ui/map").then((m) => m.MarkerTooltip),
  { ssr: false },
);

export const MarkerLabel = dynamic(() => import("@/components/ui/map").then((m) => m.MarkerLabel), {
  ssr: false,
});

export const MapControls = dynamic(() => import("@/components/ui/map").then((m) => m.MapControls), {
  ssr: false,
});

export const MapRoute = dynamic(() => import("@/components/ui/map").then((m) => m.MapRoute), {
  ssr: false,
});

"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type ChartDimensions = { width: number; height: number };

type SafeChartContainerProps = {
  className?: string;
  minHeight?: number;
  render: (dimensions: ChartDimensions) => ReactNode;
};

export const SafeChartContainer = memo(function SafeChartContainer({
  className,
  minHeight = 120,
  render,
}: SafeChartContainerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState<ChartDimensions | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  const updateDimensions = useCallback((width: number, height: number) => {
    const nextWidth = Math.floor(width);
    const nextHeight = Math.floor(height);

    if (nextWidth > 0 && nextHeight > 0) {
      setDimensions((prev) => {
        if (prev && prev.width === nextWidth && prev.height === nextHeight) {
          return prev;
        }
        return { width: nextWidth, height: nextHeight };
      });
      return;
    }

    setDimensions(null);
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const initialRect = node.getBoundingClientRect();
    updateDimensions(initialRect.width, initialRect.height);

    observerRef.current = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      updateDimensions(entry.contentRect.width, entry.contentRect.height);
    });
    observerRef.current.observe(node);

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [updateDimensions]);

  return (
    <div ref={containerRef} className={cn("min-w-0", className)} style={{ minHeight }}>
      {dimensions !== null ? render(dimensions) : null}
    </div>
  );
});

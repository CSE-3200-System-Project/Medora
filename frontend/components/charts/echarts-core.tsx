"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import {
  BarChart,
  GaugeChart,
  LineChart,
  PieChart,
  RadarChart,
} from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsCoreOption } from "echarts/core";
import type { CSSProperties } from "react";

echarts.use([
  BarChart,
  GaugeChart,
  LineChart,
  PieChart,
  RadarChart,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  CanvasRenderer,
]);

type EChartsCoreProps = {
  option: EChartsCoreOption;
  style?: CSSProperties;
  className?: string;
  theme?: string;
  notMerge?: boolean;
  lazyUpdate?: boolean;
};

export default function EChartsCore({
  option,
  style,
  className,
  theme,
  notMerge = true,
  lazyUpdate = true,
}: EChartsCoreProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const instance = echarts.init(el, theme);
    instanceRef.current = instance;

    const handleResize = () => instance.resize();
    const observer = new ResizeObserver(handleResize);
    observer.observe(el);

    return () => {
      observer.disconnect();
      instance.dispose();
      instanceRef.current = null;
    };
  }, [theme]);

  useEffect(() => {
    instanceRef.current?.setOption(option, { notMerge, lazyUpdate });
  }, [option, notMerge, lazyUpdate]);

  return <div ref={containerRef} className={className} style={style} />;
}

import { useMemo } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useMetricsStore } from "@/stores/metricsStore";
import type { MachineMetric, MetricOEE } from "@/types/metrics";

export function useFilteredMetrics(): MachineMetric[] {
  const metrics = useMetricsStore((s) => s.metrics);
  const selectedPlant = useAuthStore((s) => s.selectedPlant);
  const selectedLine = useAuthStore((s) => s.selectedLine);

  return useMemo(() => {
    return metrics.filter((m) => {
      if (selectedPlant && m.plant !== selectedPlant) return false;
      if (selectedLine && selectedLine !== "All Lines" && m.line !== selectedLine) return false;
      return true;
    });
  }, [metrics, selectedPlant, selectedLine]);
}

export function useMetricsForMachines(machineName: string): MachineMetric | undefined {
  const metrics = useMetricsStore((s) => s.metrics);
  return useMemo(() => metrics.find((m) => m.machineName === machineName), [metrics, machineName]);
}

export function useMetricsStatus(): { loaded: boolean; connected: boolean } {
  const loaded = useMetricsStore((s) => s.loaded);
  const connected = useMetricsStore((s) => s.connected);
  return { loaded, connected };
}

export function averageOEE(metrics: MachineMetric[]): MetricOEE {
  const active = metrics.filter((m) => m.status === "running" || m.status === "idle");
  if (!active.length) return { oee: 0, availability: 0, performance: 0, quality: 0 };
  const sum = (k: keyof MetricOEE) =>
    active.reduce((a, m) => a + (m.oee[k] ?? 0), 0) / active.length;
  return { oee: sum("oee"), availability: sum("availability"), performance: sum("performance"), quality: sum("quality") };
}

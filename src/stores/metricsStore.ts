import { create } from "zustand";
import type { MachineMetric } from "@/types/metrics";

interface MetricsState {
  metrics: MachineMetric[];
  loaded: boolean;
  connected: boolean;
  setMetrics: (metrics: MachineMetric[]) => void;
  setConnected: (connected: boolean) => void;
  upsertMetric: (metric: MachineMetric) => void;
  byMachineId: (machineId: string) => MachineMetric | undefined;
}

export const useMetricsStore = create<MetricsState>((set, get) => ({
  metrics: [],
  loaded: false,
  connected: false,

  setMetrics: (metrics) => set({ metrics, loaded: true }),

  setConnected: (connected) => set({ connected }),

  upsertMetric: (metric) =>
    set((state) => {
      const exists = state.metrics.some((m) => m.machineId === metric.machineId);
      return {
        metrics: exists
          ? state.metrics.map((m) => (m.machineId === metric.machineId ? metric : m))
          : [...state.metrics, metric],
      };
    }),

  byMachineId: (machineId) => get().metrics.find((m) => m.machineId === machineId),
}));

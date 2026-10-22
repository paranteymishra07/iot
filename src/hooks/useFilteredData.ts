import { useMemo, useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useMetricsStore } from "@/stores/metricsStore";
import { useAlarmStore } from "@/stores/alarmStore";
import { useEnergyStore } from "@/stores/energyStore";
import { useMasterDataStore } from "@/stores/masterDataStore";
import { api } from "@/lib/api";
import type { MachineMaster, ProductionLine, PlantLocation } from "@/types/masterData";
import type { MachineMetric } from "@/types/metrics";
import type { EnergyData } from "@/types/energy";
import type { Machine } from "@/types/machine";
import type { Alarm } from "@/types/alarm";
import type { TrendHourRow } from "@/types/trend";

function defaultSensors(metric?: MachineMetric) {
  if (metric?.sensor) return { ...metric.sensor };
  return { temperature: 0, vibration: 0, load: 0, speed: 0, power: 0 };
}

function buildMachine(
  m: MachineMaster,
  lines: ProductionLine[],
  plants: PlantLocation[],
  metric?: MachineMetric,
  energy?: EnergyData
): Machine {
  const line = lines.find((l) => l.id === m.lineId);
  const plant = plants.find((p) => p.id === line?.plantId);

  const status = metric?.status ?? (m.status === "active" ? "idle" : "down");
  const totalUnits = metric?.totalUnits ?? 0;
  const goodUnits = metric?.goodUnits ?? 0;
  const rejects = Math.max(0, totalUnits - goodUnits);

  const cycleSec = metric?.idealCycleTimeSec ?? m.threshold ?? m.cycleTime ?? 0;
  const plannedTimeMin = metric?.plannedTimeMin ?? 0;
  const target = cycleSec > 0 && plannedTimeMin > 0 ? Math.round((plannedTimeMin * 60) / cycleSec) : 0;

  return {
    id: m.id,
    name: m.name,
    type: m.type,
    line: metric?.line || line?.name || "",
    plant: metric?.plant || plant?.name || "",
    status,
    oee: metric?.oee ?? { oee: 0, availability: 0, performance: 0, quality: 0 },
    sensors: defaultSensors(metric),
    production: {
      target,
      actual: totalUnits,
      good: goodUnits,
      rejects,
      cycleTime: cycleSec,
      rate: cycleSec > 0 && plannedTimeMin > 0 ? Number(((plannedTimeMin * 60) / cycleSec).toFixed(1)) : 0,
    },
    lastUpdate: metric?.updatedAt ? new Date(metric.updatedAt) : new Date(),
    operatingHours: 0,
    healthScore: 0,
    energyConsumption: energy?.todayKwh ?? 0,
    ipAddress: m.ipAddress,
    firmware: "",
    mqttTopics: [],
  };
}

export function useMachines(): Machine[] {
  const masters = useMasterDataStore((s) => s.machines);
  const lines = useMasterDataStore((s) => s.lines);
  const plants = useMasterDataStore((s) => s.plants);
  const metrics = useMetricsStore((s) => s.metrics);
  const energyData = useEnergyStore((s) => s.energyData);

  return useMemo(() => {
    const metricByName = new Map<string, MachineMetric>();
    for (const met of metrics) {
      if (met.machineName) metricByName.set(met.machineName, met);
    }
    const energyByName = new Map<string, EnergyData>();
    for (const e of energyData) {
      if (e.machineName) energyByName.set(e.machineName, e);
    }
    return masters.map((master) =>
      buildMachine(master, lines, plants, metricByName.get(master.name), energyByName.get(master.name))
    );
  }, [masters, lines, plants, metrics, energyData]);
}

export function useMachine(id: string): Machine | undefined {
  const machines = useMachines();
  return useMemo(() => machines.find((m) => m.id === id) || machines.find((m) => m.name.toLowerCase() === id.toLowerCase()), [machines, id]);
}

export function useFilteredMachines(): Machine[] {
  const machines = useMachines();
  const selectedPlant = useAuthStore((s) => s.selectedPlant);
  const selectedLine = useAuthStore((s) => s.selectedLine);

  return useMemo(() => {
    return machines.filter((m) => {
      if (selectedPlant && m.plant !== selectedPlant) return false;
      if (selectedLine && selectedLine !== "All Lines" && m.line !== selectedLine) return false;
      return true;
    });
  }, [machines, selectedPlant, selectedLine]);
}

export function useFilteredAlarms(): Alarm[] {
  const alarms = useAlarmStore((s) => s.alarms);
  const selectedPlant = useAuthStore((s) => s.selectedPlant);
  const selectedLine = useAuthStore((s) => s.selectedLine);

  return useMemo(() => {
    return alarms.filter((a) => {
      if (selectedPlant && a.plant !== selectedPlant) return false;
      if (selectedLine && selectedLine !== "All Lines" && a.line !== selectedLine) return false;
      return true;
    });
  }, [alarms, selectedPlant, selectedLine]);
}

export function useFilteredEnergy(): EnergyData[] {
  const energyData = useEnergyStore((s) => s.energyData);
  const selectedPlant = useAuthStore((s) => s.selectedPlant);
  const selectedLine = useAuthStore((s) => s.selectedLine);

  return useMemo(() => {
    return energyData.filter((e) => {
      if (selectedPlant && e.plant !== selectedPlant) return false;
      if (selectedLine && selectedLine !== "All Lines" && e.line !== selectedLine) return false;
      return true;
    });
  }, [energyData, selectedPlant, selectedLine]);
}

interface TrendOptions {
  scope?: "all" | "machine";
  machineId?: string;
  hours?: number;
  pollMs?: number;
}

export function useTrendSeries(
  options: TrendOptions
): { series: TrendHourRow[]; hasData: boolean; loading: boolean } {
  const scope = options.scope ?? "all";
  const machineId = options.machineId;
  const hours = options.hours ?? 24;
  const pollMs = options.pollMs ?? 60000;

  const [series, setSeries] = useState<TrendHourRow[]>([]);
  const [hasData, setHasData] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const params: Record<string, string | number> = { scope, hours };
        if (scope === "machine" && machineId) params.machineId = machineId;
        const { data } = await api.get("/metrics/trends", { params });
        if (!active) return;
        setSeries(data.series ?? []);
        setHasData(Boolean(data.hasData) && (data.series ?? []).length > 0);
      } catch (err) {
        if (!active) return;
        setSeries([]);
        setHasData(false);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    const t = setInterval(load, pollMs);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [scope, machineId, hours, pollMs]);

  return { series, hasData, loading };
}

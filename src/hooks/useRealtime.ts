import { useEffect } from "react";
import { useMachineStore } from "@/stores/machineStore";

function jitter(value: number, range: number): number {
  return Math.max(0, value + (Math.random() - 0.5) * range);
}

export function useRealtime() {
  const { machines, updateMachine } = useMachineStore();

  useEffect(() => {
    const interval = setInterval(() => {
      machines.forEach((m) => {
        if (m.status === "running") {
          updateMachine(m.id, {
            sensors: {
              temperature: Math.min(90, jitter(m.sensors.temperature, 1.5)),
              vibration: Math.max(0.1, jitter(m.sensors.vibration, 0.3)),
              load: Math.min(100, Math.max(0, jitter(m.sensors.load, 4))),
              speed: Math.max(0, jitter(m.sensors.speed, 40)),
              power: Math.max(0, jitter(m.sensors.power, 0.3)),
              pressure: m.sensors.pressure ? jitter(m.sensors.pressure, 3) : undefined,
            },
            production: {
              ...m.production,
              actual: m.production.actual + Math.floor(Math.random() * 2),
              rejects: m.production.rejects + (Math.random() < 0.05 ? 1 : 0),
            },
            oee: {
              oee: Math.min(100, jitter(m.oee.oee, 0.3)),
              availability: Math.min(100, jitter(m.oee.availability, 0.2)),
              performance: Math.min(100, jitter(m.oee.performance, 0.2)),
              quality: Math.min(100, jitter(m.oee.quality, 0.1)),
            },
          });
        }
      });
    }, 2500);

    return () => clearInterval(interval);
  }, [machines, updateMachine]);
}

export function useTimeSeriesData(baseValue: number, points = 24): { time: string; value: number }[] {
  const data = [];
  const now = new Date();
  for (let i = points - 1; i >= 0; i--) {
    const t = new Date(now.getTime() - i * 3600000);
    data.push({
      time: t.getHours().toString().padStart(2, "0") + ":00",
      value: Math.max(0, baseValue + (Math.random() - 0.4) * baseValue * 0.3),
    });
  }
  return data;
}

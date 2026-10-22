import { MachineMetric, computeOEE, MetricStatus } from "../models/MachineMetric.js";
import { broadcastMetric } from "../realtime/metricBus.js";
import { ensureActiveMachineMetrics } from "../services/ensureMetrics.js";
import { recordHourlySnapshot } from "../services/recordHistory.js";

function drift(value: number, amount: number, min = 0, max = Infinity): number {
  return Math.min(max, Math.max(min, value + (Math.random() - 0.5) * amount));
}

interface SimConfig {
  machineId: string;
  minUnits: number;
  maxUnits: number;
  rejectRate: number;
  tempBase: number;
}

const SIM_MACHINES: SimConfig[] = [
  { machineId: "cnc-001", minUnits: 0, maxUnits: 3, rejectRate: 0.01, tempBase: 64 },
  { machineId: "cnc-002", minUnits: 0, maxUnits: 2, rejectRate: 0.005, tempBase: 48 },
  { machineId: "press-003", minUnits: 0, maxUnits: 3, rejectRate: 0.012, tempBase: 71 },
  { machineId: "cnc-004", minUnits: 0, maxUnits: 0, rejectRate: 0, tempBase: 31 },
  { machineId: "assembly-001", minUnits: 0, maxUnits: 2, rejectRate: 0, tempBase: 55 },
  { machineId: "weld-001", minUnits: 0, maxUnits: 0, rejectRate: 0, tempBase: 43 },
];

export async function simulateMetrics() {
  try {
    await ensureActiveMachineMetrics();
    const docs = await MachineMetric.find();
    for (const doc of docs) {
      const cfg = SIM_MACHINES.find((s) => s.machineId === doc.machineId) ?? {
        machineId: doc.machineId,
        minUnits: 0,
        maxUnits: 2,
        rejectRate: 0.01,
        tempBase: 60,
      };

      const unitIncrease = cfg.minUnits + Math.floor(Math.random() * (cfg.maxUnits - cfg.minUnits + 1));
      const totalUnits = doc.totalUnits + unitIncrease;

      const prevRejects = Math.max(0, doc.totalUnits - doc.goodUnits);
      let rejects = prevRejects;
      if (Math.random() < cfg.rejectRate) rejects += 1;

      const goodUnits = Math.max(0, Math.min(totalUnits, totalUnits - rejects));

      const downtimeRecovery = Math.random() < 0.02 ? 10 + Math.random() * 20 : 0;
      const nextDowntimeMin = Math.min(
        doc.plannedTimeMin * 0.15,
        Math.max(0, doc.downtimeMin + (Math.random() < 0.04 ? 2 + Math.random() * 4 : 0) - downtimeRecovery)
      );

      const producing = unitIncrease > 0;
      const status: MetricStatus = doc.manualStatus
        ? doc.status
        : producing
          ? "running"
          : doc.status === "down" || doc.status === "maintenance"
            ? doc.status
            : Math.random() < 0.08
              ? "idle"
              : "running";

      doc.status = status;
      doc.totalUnits = totalUnits;
      doc.goodUnits = goodUnits;
      doc.downtimeMin = nextDowntimeMin;
      doc.sensor = {
        temperature: Math.max(20, drift(doc.sensor.temperature ?? cfg.tempBase, 1.5)),
        vibration: Math.max(0.1, drift(doc.sensor.vibration ?? 2, 0.3)),
        load: Math.min(100, Math.max(0, drift(doc.sensor.load ?? 70, 4))),
        speed: Math.max(0, drift(doc.sensor.speed ?? 1800, 40)),
        power: Math.max(0, drift(doc.sensor.power ?? 4, 0.3)),
        pressure: doc.sensor.pressure != null ? drift(doc.sensor.pressure, 3) : undefined,
      };

      await doc.save();

      await recordHourlySnapshot(doc);

      broadcastMetric({
        id: (doc as unknown as { id: string }).id,
        machineId: doc.machineId,
        machineName: doc.machineName,
        plant: doc.plant,
        line: doc.line,
        status: doc.status,
        plannedTimeMin: doc.plannedTimeMin,
        downtimeMin: doc.downtimeMin,
        operatingTimeMin: doc.plannedTimeMin - doc.downtimeMin,
        idealCycleTimeSec: doc.idealCycleTimeSec,
        totalUnits: doc.totalUnits,
        goodUnits: doc.goodUnits,
        rejects: doc.totalUnits - doc.goodUnits,
        sensor: doc.sensor,
        oee: computeOEE(doc),
        updatedAt: new Date(),
      });
    }
  } catch (err) {
    console.error("Metrics simulation error:", err);
  }
}

export function startMetricSimulator(intervalMs = 5000) {
  simulateMetrics();
  setInterval(() => simulateMetrics().catch(() => {}), intervalMs);
  console.log(`[metrics] IoT simulator started (every ${intervalMs}ms)`);
}

import { MachineMetric, computeOEE, IMachineMetric } from "../models/MachineMetric.js";
import { MetricHistory, hourBucket } from "../models/MetricHistory.js";

const HOUR_MS = 60 * 60 * 1000;
const PLANNED_MIN_PER_HOUR = 60;

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Deterministic per machine/hour so repeated backfills keep the same curve
// instead of reshuffling the chart on every restart.
function noise(seed: string, spread: number): number {
  return ((hashSeed(seed) % 1000) / 1000 - 0.5) * 2 * spread;
}

function clamp(v: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, v));
}

function round1(v: number): number {
  return Number(v.toFixed(1));
}

interface HourPlan {
  hour: Date;
  status: string;
  oee: number;
  availability: number;
  performance: number;
  quality: number;
  totalUnits: number;
  baseTotalUnits: number;
  deltaUnits: number;
  temperature: number;
  power: number;
}

function planHours(doc: IMachineMetric, hours: number, currentHour: Date): HourPlan[] {
  const live = computeOEE(doc);
  const plans: HourPlan[] = [];

  let totalUnits = doc.totalUnits || 0;
  const idealCycleTimeSec = doc.idealCycleTimeSec > 0 ? doc.idealCycleTimeSec : 10;
  const baseTemp = doc.sensor?.temperature || 55;
  const basePower = doc.sensor?.power || 4;
  const isProducing = doc.status === "running" || doc.status === "idle";

  for (let back = hours - 1; back >= 1; back--) {
    const hour = new Date(currentHour.getTime() - back * HOUR_MS);
    const seed = `${doc.machineId}|${hour.getTime()}`;

    const availability = isProducing
      ? clamp(live.availability + noise(`${seed}|a`, 12), 45, 100)
      : clamp(noise(`${seed}|a`, 6), 0, 100);
    const performance = isProducing
      ? clamp(live.performance + noise(`${seed}|p`, 14), 5, 100)
      : 0;
    const quality = clamp(live.quality + noise(`${seed}|q`, 4), 80, 100);

    const operatingSec = (PLANNED_MIN_PER_HOUR * (availability / 100)) * 60;
    const deltaUnits = Math.max(0, Math.round((operatingSec * (performance / 100)) / idealCycleTimeSec));
    const baseTotalUnits = Math.max(0, totalUnits - deltaUnits);
    const rejects = Math.min(deltaUnits, Math.round(deltaUnits * (1 - quality / 100)));

    plans.push({
      hour,
      status: deltaUnits > 0 ? "running" : "idle",
      oee: (availability / 100) * (performance / 100) * (quality / 100) * 100,
      availability,
      performance,
      quality,
      totalUnits,
      baseTotalUnits,
      deltaUnits,
      temperature: Math.max(20, baseTemp + noise(`${seed}|t`, 9)),
      power: Math.max(0, basePower * (0.8 + (deltaUnits > 0 ? 0.4 : 0)) + noise(`${seed}|w`, 1.2)),
    });

    totalUnits = baseTotalUnits;
  }

  return plans;
}

export async function backfillMetricHistory(hours = 24): Promise<number> {
  if (hours < 1) return 0;

  const docs = await MachineMetric.find();
  if (docs.length === 0) return 0;

  const currentHour = hourBucket(new Date());
  const ops: Parameters<typeof MetricHistory.bulkWrite>[0] = [];

  for (const doc of docs) {
    for (const p of planHours(doc, hours, currentHour)) {
      ops.push({
        updateOne: {
          filter: { machineId: doc.machineId, hour: p.hour },
          update: {
            $setOnInsert: {
              machineId: doc.machineId,
              machineName: doc.machineName,
              plant: doc.plant,
              line: doc.line,
              hour: p.hour,
              status: p.status,
              oee: round1(p.oee),
              availability: round1(p.availability),
              performance: round1(p.performance),
              quality: round1(p.quality),
              totalUnits: p.totalUnits,
              baseTotalUnits: p.baseTotalUnits,
              deltaUnits: p.deltaUnits,
              temperature: round1(p.temperature),
              power: round1(p.power),
            },
          },
          upsert: true,
        },
      });
    }
  }

  if (ops.length === 0) return 0;

  // $setOnInsert keeps every already-recorded hour untouched, so this is safe
  // to run on each boot and never rewrites real simulator history.
  const res = await MetricHistory.bulkWrite(ops, { ordered: false });
  return res.upsertedCount ?? 0;
}

export function startHistoryBackfill(hours = 24) {
  backfillMetricHistory(hours)
    .then((n) => {
      if (n > 0) console.log(`[history] backfilled ${n} hourly trend rows (last ${hours}h)`);
    })
    .catch((err) => console.error("[history] backfill failed:", err));
}

import { MetricHistory, hourBucket, IMetricHistory } from "../models/MetricHistory.js";
import { MachineMetric, computeOEE } from "../models/MachineMetric.js";

export async function recordHourlySnapshot(doc: InstanceType<typeof MachineMetric>): Promise<void> {
  const hour = hourBucket(new Date());
  const oee = computeOEE(doc);
  const prev = await MetricHistory.findOne({ machineId: doc.machineId, hour });

  const baseTotalUnits = prev != null ? (prev.baseTotalUnits as number || 0) : (doc.totalUnits || 0);
  const deltaUnits = Math.max(0, (doc.totalUnits || 0) - baseTotalUnits);

  const update: Partial<IMetricHistory> = {
    machineName: doc.machineName,
    plant: doc.plant,
    line: doc.line,
    status: doc.status,
    oee: oee.oee,
    availability: oee.availability,
    performance: oee.performance,
    quality: oee.quality,
    totalUnits: doc.totalUnits,
    baseTotalUnits,
    deltaUnits,
    temperature: doc.sensor?.temperature ?? 0,
    power: doc.sensor?.power ?? 0,
  };

  await MetricHistory.findOneAndUpdate(
    { machineId: doc.machineId, hour },
    { $set: update },
    { upsert: true, new: true }
  );
}

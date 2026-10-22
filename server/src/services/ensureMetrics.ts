import { Machine } from "../models/Machine.js";
import { MachineMetric } from "../models/MachineMetric.js";
import { Plant } from "../models/Plant.js";
import { ProductionLog } from "../models/ProductionLog.js";

export async function ensureActiveMachineMetrics(): Promise<number> {
  const machines = await Machine.find({ status: { $ne: "inactive" } })
    .populate("lineId", "name plantId")
    .lean();
  const existing = await MachineMetric.find().select("machineName machineId").lean();
  const existingNames = new Set(existing.map((m) => m.machineName?.toLowerCase()));

  const plants = await Plant.find().select("name").lean();

  let created = 0;
  for (const m of machines) {
    const name = (m as any).name as string;
    if (!name) continue;
    if (existingNames.has(String(name).toLowerCase())) continue;

    const line = (m as any).lineId as any;
    const lineName = line?.name || "";
    const plantId = line?.plantId || "";
    const plantName = plants.find((p) => String((p as any)._id) === String(plantId))?.name || "";

    // Seed status/counts from today's ProductionLog if present, so the admin
    // view reflects the operator's current status instead of default idle.
    const today = new Date().toISOString().slice(0, 10);
    const log = await ProductionLog.findOne({ machineId: String((m as any)._id), date: today }).lean();
    const threshold = (m as any).threshold ?? (m as any).cycleTime ?? 0;

    await MachineMetric.findOneAndUpdate(
      { machineName: name },
      {
        $setOnInsert: {
          machineId: String(name).toLowerCase(),
          machineName: name,
          plant: log?.plant || plantName,
          line: log?.line || lineName,
          status: log?.status || "idle",
          manualStatus: !!log?.manualStatus,
          plannedTimeMin: log?.plannedTimeMin ?? 480,
          downtimeMin: log?.downtimeMin ?? 0,
          idealCycleTimeSec: log?.cycleTimeThreshold ?? threshold,
          totalUnits: log?.totalUnits ?? 0,
          goodUnits: log?.goodUnits ?? 0,
          sensor: { temperature: 0, vibration: 0, load: 0, speed: 0, power: 0 },
        },
      },
      { upsert: true, new: true }
    );
    created++;
  }
  return created;
}

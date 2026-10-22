import { ProductionLog, LogStatus } from "../models/ProductionLog.js";
import { MachineMetric } from "../models/MachineMetric.js";

export const IDLE_AFTER_MS = 5 * 60 * 1000;
export const DOWN_AFTER_MS = 10 * 60 * 1000;
export const DOWN_AFTER_MANUAL_MS = 5 * 60 * 1000;

export type AutoStatus = LogStatus;

export function deriveAutoStatus(lastProducedAt: Date | null, now: Date = new Date()): AutoStatus {
  if (!lastProducedAt) return "idle";
  const elapsed = now.getTime() - new Date(lastProducedAt).getTime();
  if (elapsed >= DOWN_AFTER_MS) return "down";
  if (elapsed >= IDLE_AFTER_MS) return "idle";
  return "running";
}

export interface StatusTickResult {
  machineId: string;
  previous: LogStatus;
  current: LogStatus;
  changed: boolean;
}

export async function applyStatusEngine(now: Date = new Date()): Promise<StatusTickResult[]> {
  const docs = await ProductionLog.find().lean();
  const results: StatusTickResult[] = [];

  for (const doc of docs) {
    const current = doc.status as LogStatus;

    if (doc.manualStatus) {
      // Hold the operator's manual status, but still auto-advance to DOWN
      // once the manual idle/down threshold (5 min) passes. Then release the
      // manual hold so the machine stays DOWN until the operator set it back
      // to running manually.
      const manualSince = doc.manualStatusAt ? new Date(doc.manualStatusAt).getTime() : null;
      const elapsedManual = manualSince ? now.getTime() - manualSince : Infinity;
      if (current !== "down" && elapsedManual >= DOWN_AFTER_MANUAL_MS) {
        await ProductionLog.updateOne(
          { machineId: doc.machineId },
          { $set: { status: "down", manualStatus: false, manualStatusAt: null } }
        );
        if (doc.machineName) {
          await MachineMetric.findOneAndUpdate(
            { machineId: String(doc.machineName).toLowerCase() },
            { $set: { status: "down", manualStatus: false } }
          );
        }
        results.push({ machineId: doc.machineId, previous: current, current: "down", changed: true });
      }
      continue;
    }

    // Auto-detection for machines that haven't been manually overridden
    const auto = deriveAutoStatus(doc.lastProducedAt, now);
    if (auto !== current) {
      await ProductionLog.updateOne(
        { machineId: doc.machineId },
        { $set: { status: auto } }
      );
      if (auto === "down" && doc.machineName) {
        await MachineMetric.findOneAndUpdate(
          { machineId: String(doc.machineName).toLowerCase() },
          { $set: { status: "down", manualStatus: false } }
        );
      }
      results.push({ machineId: doc.machineId, previous: current, current: auto, changed: true });
    }
  }

  return results;
}

export function startStatusEngine(intervalMs: number = 30 * 1000) {
  const timer = setInterval(() => {
    applyStatusEngine().catch((err) => console.error("[status-engine]", err));
  }, intervalMs);
  timer.unref?.();
  return timer;
}

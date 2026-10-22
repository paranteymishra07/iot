import { Router } from "express";
import { ProductionLog, computeDayEfficiency, DayEfficiency, LogStatus } from "../models/ProductionLog.js";
import { User } from "../models/User.js";
import { Machine } from "../models/Machine.js";
import { MachineMetric, computeOEE, IMachineMetric } from "../models/MachineMetric.js";
import { broadcastMetric } from "../realtime/metricBus.js";

const router = Router();

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function getOperatorById(id: string) {
  return User.findById(id);
}

function toClient(doc: any) {
  return {
    id: doc.id,
    machineId: doc.machineId,
    machineName: doc.machineName,
    operatorId: doc.operatorId,
    operatorName: doc.operatorName,
    plant: doc.plant,
    line: doc.line,
    date: doc.date,
    status: doc.status,
    manualStatus: doc.manualStatus,
    dailyTarget: doc.dailyTarget,
    totalUnits: doc.totalUnits,
    goodUnits: doc.goodUnits,
    rejects: doc.rejects,
    cycleTimeSec: doc.cycleTimeSec,
    cycleTimeThreshold: doc.cycleTimeThreshold,
    plannedTimeMin: doc.plannedTimeMin,
    downtimeMin: doc.downtimeMin,
    downtimeReasonId: doc.downtimeReasonId,
    downtimeReasonLabel: doc.downtimeReasonLabel,
    lastProducedAt: doc.lastProducedAt,
    updatedAt: doc.updatedAt ?? doc.createdAt,
  };
}

function createEmptyLog(machineId: string, machineName: string, operator: any, line: string, machineDefaults?: { threshold?: number; cycleTime?: number }) {
  return {
    machineId,
    machineName,
    operatorId: operator.id,
    operatorName: operator.name,
    plant: operator.plant || "",
    line,
    date: today(),
    status: "running" as const,
    dailyTarget: operator.dailyTarget || 0,
    totalUnits: 0,
    goodUnits: 0,
    rejects: 0,
    cycleTimeSec: machineDefaults?.cycleTime ?? 0,
    cycleTimeThreshold: machineDefaults?.threshold ?? 0,
    plannedTimeMin: 0,
    downtimeMin: 0,
    downtimeReasonId: "",
    downtimeReasonLabel: "",
    lastProducedAt: new Date(),
  };
}

// Operator: report production / cycle time / downtime for an assigned machine
router.post("/log", async (req, res) => {
  try {
    const { machineId, operatorId, totalUnits, goodUnits, rejects, cycleTimeSec, cycleTimeThreshold, plannedTimeMin, downtimeMin, downtimeReasonId, downtimeReasonLabel, status } = req.body;
    if (!machineId || !operatorId) return res.status(400).json({ error: "machineId and operatorId are required" });

    const operator = await getOperatorById(operatorId);
    if (!operator) return res.status(404).json({ error: "Operator not found" });

    const machine = await Machine.findById(machineId).populate("lineId", "name");
    if (!machine) return res.status(404).json({ error: "Machine not found" });

    const lineName = (machine as any).lineId?.name || (machine as any).lineIdStr || "";

    const date = today();
    let log = await ProductionLog.findOne({ machineId, date });
    if (!log) {
      log = await ProductionLog.create(createEmptyLog(machineId, machine.name, operator, lineName, { threshold: (machine as any).threshold, cycleTime: (machine as any).cycleTime }));
    }

    const set: Record<string, unknown> = {};
    if (typeof totalUnits === "number" && totalUnits >= 0) set.totalUnits = totalUnits;
    if (typeof goodUnits === "number" && goodUnits >= 0) set.goodUnits = goodUnits;
    if (typeof rejects === "number" && rejects >= 0) set.rejects = rejects;
    // Cycle time & threshold are FIXED on the machine master and applied everywhere.
    if (typeof (machine as any).cycleTime === "number" && (machine as any).cycleTime >= 0) set.cycleTimeSec = (machine as any).cycleTime;
    if (typeof (machine as any).threshold === "number" && (machine as any).threshold >= 0) set.cycleTimeThreshold = (machine as any).threshold;
    if (typeof plannedTimeMin === "number" && plannedTimeMin >= 0) set.plannedTimeMin = plannedTimeMin;
    if (typeof downtimeMin === "number" && downtimeMin >= 0) set.downtimeMin = downtimeMin;
    if (typeof downtimeReasonId === "string" && downtimeReasonId) {
      set.downtimeReasonId = downtimeReasonId;
      set.downtimeReasonLabel = downtimeReasonLabel || "";
    }
    if (typeof status === "string") set.status = status;
    if (set.status === "running") set.manualStatus = false;
    if (set.totalUnits !== undefined && set.totalUnits !== log.totalUnits) {
      set.lastProducedAt = new Date();
    }
    set.rejects = (set.rejects as number) ?? (log.totalUnits ?? 0) - (log.goodUnits ?? 0);

    Object.assign(log, set);
    await log.save();

    res.json(toClient(log));
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to record production" });
  }
});

// Operator: manual status toggle
router.post("/status", async (req, res) => {
  try {
    const { machineId, status, downtimeReasonId, downtimeReasonLabel } = req.body;
    if (!machineId || !status) return res.status(400).json({ error: "machineId and status are required" });
    const allow: LogStatus[] = ["running", "idle", "down", "maintenance"];
    if (!allow.includes(status)) return res.status(400).json({ error: "Invalid status" });

    if (status !== "running" && !downtimeReasonId) {
      return res.status(400).json({ error: "A downtime reason is required for idle, down, or maintenance status" });
    }

    const date = today();
    const log = await ProductionLog.findOne({ machineId, date });
    if (!log) return res.status(404).json({ error: "No production log for today" });

    log.status = status;
    log.manualStatus = status !== "running";
    log.manualStatusAt = status !== "running" ? new Date() : null;
    if (status !== "running" && downtimeReasonId) {
      log.downtimeReasonId = downtimeReasonId;
      log.downtimeReasonLabel = downtimeReasonLabel || "";
    }
    if (status === "running") log.lastProducedAt = new Date();
    await log.save();

    // Sync the operator's manual status into the admin's MachineMetric view
    if (log.machineName) {
      const slug = String(log.machineName).toLowerCase();
      const metric = await MachineMetric.findOneAndUpdate(
        { machineId: slug },
        { $set: { status, manualStatus: status !== "running" } },
        { new: true }
      );
      if (metric) {
        const oee = computeOEE(metric);
        broadcastMetric({
          id: (metric as unknown as { id: string }).id,
          machineId: metric.machineId,
          machineName: metric.machineName,
          plant: metric.plant,
          line: metric.line,
          status: metric.status,
          plannedTimeMin: metric.plannedTimeMin,
          downtimeMin: metric.downtimeMin,
          operatingTimeMin: metric.plannedTimeMin - metric.downtimeMin,
          idealCycleTimeSec: metric.idealCycleTimeSec,
          totalUnits: metric.totalUnits,
          goodUnits: metric.goodUnits,
          rejects: metric.totalUnits - metric.goodUnits,
          sensor: metric.sensor,
          oee,
          updatedAt: new Date(),
        });
      }
    }

    res.json(toClient(log));
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to update status" });
  }
});

// Operator: today's status + log for assigned machines
router.get("/dashboard/:operatorId", async (req, res) => {
  try {
    const operator: any = await getOperatorById(req.params.operatorId);
    if (!operator) return res.status(404).json({ error: "Operator not found" });

    const date = today();
    const logs = await ProductionLog.find({ operatorId: req.params.operatorId, date }).sort({ machineName: 1 });

    const assignedIds: (string | any)[] = operator.assignedMachineIds || [];
    const assignedSet = new Set(assignedIds.map((id: any) => String(id)));

    // Only show machines the operator is currently assigned to. A ProductionLog
    // may still exist for a machine removed from the assignment; exclude those.
    const assignedLogs = logs.filter((l) => assignedSet.has(String(l.machineId)));

    const byMachine = new Map(assignedLogs.map((l) => [String(l.machineId), l]));

    let assignedMachines: any[] = [];
    if (assignedIds.length) {
      assignedMachines = await Machine.find({ _id: { $in: assignedIds } }).select("name type threshold cycleTime");
    }

    const entries: any[] = assignedLogs.map((log) => log);
    for (const m of assignedMachines) {
      if (!byMachine.has(String(m.id))) {
        entries.push({
          id: m.id,
          machineId: m.id,
          machineName: (m as any).name,
          operatorId: operator.id,
          operatorName: operator.name,
          plant: operator.plant || "",
          line: "",
          date,
          status: "running" as const,
          dailyTarget: operator.dailyTarget || 0,
          totalUnits: 0,
          goodUnits: 0,
          rejects: 0,
          cycleTimeSec: (m as any).cycleTime ?? 0,
          cycleTimeThreshold: (m as any).threshold ?? 0,
          plannedTimeMin: 0,
          downtimeMin: 0,
          downtimeReasonId: "",
          downtimeReasonLabel: "",
          lastProducedAt: null,
        });
      }
    }

    const dashboard = entries.map((log) => {
      const eff = computeDayEfficiency(
        log.plannedTimeMin,
        log.downtimeMin,
        log.totalUnits,
        log.goodUnits,
        log.dailyTarget,
        log.cycleTimeSec,
        log.cycleTimeThreshold
      );
      return { ...toClient(log), ...eff };
    });

    res.json({ date, target: operator.dailyTarget || 0, machines: dashboard });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch dashboard" });
  }
});

// Daily efficiency summary for an operator (OEE-influenced)
router.get("/daily/:operatorId", async (req, res) => {
  try {
    const date = req.query.date as string | undefined;
    const day = date || today();
    const logs = await ProductionLog.find({ operatorId: req.params.operatorId, date: day });

    const plannedTimeMin = logs.reduce((a, l) => a + l.plannedTimeMin, 0);
    const downtimeMin = logs.reduce((a, l) => a + l.downtimeMin, 0);
    const totalUnits = logs.reduce((a, l) => a + l.totalUnits, 0);
    const goodUnits = logs.reduce((a, l) => a + l.goodUnits, 0);
    const rejects = logs.reduce((a, l) => a + l.rejects, 0);
    const dailyTarget = logs[0]?.dailyTarget || 0;
    const avgCycle = logs.length ? logs.reduce((a, l) => a + l.cycleTimeSec, 0) / logs.length : 0;

    const eff = computeDayEfficiency(plannedTimeMin, downtimeMin, totalUnits, goodUnits, dailyTarget, avgCycle, logs[0]?.cycleTimeThreshold);
    const summary: DayEfficiency = { ...eff, totalUnits, goodUnits, rejects, dailyTarget, downtimeMin };
    res.json({ date: day, ...summary });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch daily efficiency" });
  }
});

export default router;

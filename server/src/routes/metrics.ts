import { Router, Request, Response } from "express";
import { MachineMetric, computeOEE, IMachineMetric } from "../models/MachineMetric.js";
import { METRIC_EVENT, broadcastMetric, metricBus } from "../realtime/metricBus.js";

const router = Router();

function toClientDoc(m: IMachineMetric) {
  const oee = computeOEE(m);
  return {
    id: (m as unknown as { id: string }).id,
    machineId: m.machineId,
    machineName: m.machineName,
    plant: m.plant,
    line: m.line,
    status: m.status,
    manualStatus: m.manualStatus,
    plannedTimeMin: m.plannedTimeMin,
    downtimeMin: m.downtimeMin,
    operatingTimeMin: m.plannedTimeMin - m.downtimeMin,
    idealCycleTimeSec: m.idealCycleTimeSec,
    totalUnits: m.totalUnits,
    goodUnits: m.goodUnits,
    rejects: m.totalUnits - m.goodUnits,
    sensor: m.sensor,
    oee,
    updatedAt: m.updatedAt ?? m.createdAt,
  };
}

router.get("/", async (_req: Request, res: Response) => {
  try {
    const docs = await MachineMetric.find().sort({ machineName: 1 });
    res.json(docs.map(toClientDoc));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch metrics" });
  }
});

router.get("/stream", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (payload: unknown) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  send({ type: "connected", message: "Metrics stream connected" });

  const onUpdate = (metric: unknown) => {
    send({ type: "metric", metric });
  };

  metricBus.on(METRIC_EVENT, onUpdate);

  const heartbeat = setInterval(() => send({ type: "ping", ts: Date.now() }), 20000);

  req.on("close", () => {
    metricBus.off(METRIC_EVENT, onUpdate);
    clearInterval(heartbeat);
  });
});

router.get("/:machineId", async (req: Request, res: Response) => {
  try {
    const doc = await MachineMetric.findOne({ machineId: req.params.machineId });
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json(toClientDoc(doc));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch metric" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const doc = await MachineMetric.findOneAndUpdate(
      { machineId: req.body.machineId },
      { $set: req.body },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    const client = toClientDoc(doc);
    broadcastMetric(client);
    res.status(201).json(client);
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to create/update metric" });
  }
});

router.put("/:machineId", async (req: Request, res: Response) => {
  try {
    const doc = await MachineMetric.findOneAndUpdate(
      { machineId: req.params.machineId },
      { $set: req.body },
      { new: true }
    );
    if (!doc) return res.status(404).json({ error: "Not found" });
    const client = toClientDoc(doc);
    broadcastMetric(client);
    res.json(client);
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to update metric" });
  }
});

export default router;

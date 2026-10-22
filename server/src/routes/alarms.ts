import { Router } from "express";
import { Alarm } from "../models/Alarm.js";

const router = Router();

router.get("/", async (req, res) => {
  const { status, severity, plant } = req.query;
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (severity) filter.severity = severity;
  if (plant) filter.plant = plant;
  const alarms = await Alarm.find(filter).sort({ timestamp: -1 });
  res.json(alarms);
});

router.get("/:id", async (req, res) => {
  const alarm = await Alarm.findById(req.params.id);
  if (!alarm) return res.status(404).json({ error: "Not found" });
  res.json(alarm);
});

router.post("/", async (req, res) => {
  const alarm = await Alarm.create(req.body);
  res.status(201).json(alarm);
});

router.put("/:id", async (req, res) => {
  const alarm = await Alarm.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!alarm) return res.status(404).json({ error: "Not found" });
  res.json(alarm);
});

router.delete("/:id", async (req, res) => {
  const deleted = await Alarm.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ error: "Not found" });
  res.json({ success: true });
});

export default router;

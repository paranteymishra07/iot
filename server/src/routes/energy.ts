import { Router } from "express";
import { EnergyData } from "../models/EnergyData.js";

const router = Router();

router.get("/", async (req, res) => {
  const { plant, line } = req.query;
  const filter: Record<string, unknown> = {};
  if (plant) filter.plant = plant;
  if (line) filter.line = line;
  const data = await EnergyData.find(filter);
  res.json(data);
});

router.get("/:machineId", async (req, res) => {
  const data = await EnergyData.findOne({ machineId: req.params.machineId });
  if (!data) return res.status(404).json({ error: "Not found" });
  res.json(data);
});

router.post("/", async (req, res) => {
  const data = await EnergyData.create(req.body);
  res.status(201).json(data);
});

router.put("/:machineId", async (req, res) => {
  const data = await EnergyData.findOneAndUpdate(
    { machineId: req.params.machineId },
    req.body,
    { new: true, upsert: true }
  );
  res.json(data);
});

router.delete("/:machineId", async (req, res) => {
  const deleted = await EnergyData.findOneAndDelete({ machineId: req.params.machineId });
  if (!deleted) return res.status(404).json({ error: "Not found" });
  res.json({ success: true });
});

export default router;

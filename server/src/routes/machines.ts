import { Router } from "express";
import { Machine } from "../models/Machine.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { lineId } = req.query;
    const filter: Record<string, unknown> = {};
    if (lineId) filter.lineId = lineId;
    const machines = await Machine.find(filter).populate("lineId", "name code").sort({ createdAt: -1 });
    res.json(machines);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch machines" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const machine = await Machine.findById(req.params.id).populate("lineId", "name code");
    if (!machine) return res.status(404).json({ error: "Not found" });
    res.json(machine);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch machine" });
  }
});

router.post("/", async (req, res) => {
  try {
    const machine = await Machine.create(req.body);
    res.status(201).json(machine);
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to create machine" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const machine = await Machine.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!machine) return res.status(404).json({ error: "Not found" });
    res.json(machine);
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to update machine" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Machine.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete machine" });
  }
});

export default router;

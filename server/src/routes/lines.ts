import { Router } from "express";
import { Line } from "../models/Line.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { plantId } = req.query;
    const filter: Record<string, unknown> = {};
    if (plantId) filter.plantId = plantId;
    const lines = await Line.find(filter).populate("plantId", "name code").sort({ createdAt: -1 });
    res.json(lines);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch lines" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const line = await Line.findById(req.params.id).populate("plantId", "name code");
    if (!line) return res.status(404).json({ error: "Not found" });
    res.json(line);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch line" });
  }
});

router.post("/", async (req, res) => {
  try {
    const line = await Line.create(req.body);
    res.status(201).json(line);
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to create line" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const line = await Line.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!line) return res.status(404).json({ error: "Not found" });
    res.json(line);
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to update line" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Line.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete line" });
  }
});

export default router;

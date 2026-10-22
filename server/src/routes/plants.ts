import { Router } from "express";
import { Plant } from "../models/Plant.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { companyId } = req.query;
    const filter: Record<string, unknown> = {};
    if (companyId) filter.companyId = companyId;
    const plants = await Plant.find(filter).populate("companyId", "name code").sort({ createdAt: -1 });
    res.json(plants);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch plants" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const plant = await Plant.findById(req.params.id).populate("companyId", "name code");
    if (!plant) return res.status(404).json({ error: "Not found" });
    res.json(plant);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch plant" });
  }
});

router.post("/", async (req, res) => {
  try {
    const plant = await Plant.create(req.body);
    res.status(201).json(plant);
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to create plant" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const plant = await Plant.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!plant) return res.status(404).json({ error: "Not found" });
    res.json(plant);
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to update plant" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Plant.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete plant" });
  }
});

export default router;

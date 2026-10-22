import { Router } from "express";
import { DowntimeReason, DEFAULT_DOWNTIME_REASONS } from "../models/DowntimeReason.js";

const router = Router();

async function ensureDefaults() {
  const count = await DowntimeReason.countDocuments();
  if (count === 0) {
    await DowntimeReason.insertMany(DEFAULT_DOWNTIME_REASONS);
  }
}

router.get("/", async (req, res) => {
  try {
    await ensureDefaults();
    const all = req.query.all === "1" || req.query.all === "true";
    const query = all ? {} : { active: true };
    const reasons = await DowntimeReason.find(query).sort({ category: 1, label: 1 });
    res.json(reasons);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch downtime reasons" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { label, category } = req.body;
    if (!label || !category) return res.status(400).json({ error: "label and category are required" });
    const reason = await DowntimeReason.create({ label, category });
    res.status(201).json(reason);
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to create reason" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { label, category, active } = req.body;
    const set: Record<string, unknown> = {};
    if (typeof label === "string" && label.trim()) set.label = label.trim();
    if (typeof category === "string" && category.trim()) set.category = category.trim();
    if (typeof active === "boolean") set.active = active;
    const reason = await DowntimeReason.findByIdAndUpdate(req.params.id, { $set: set }, { new: true });
    if (!reason) return res.status(404).json({ error: "Not found" });
    res.json(reason);
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to update reason" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const deleted = await DowntimeReason.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete reason" });
  }
});

export default router;

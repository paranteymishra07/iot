import { Router, Request, Response } from "express";
import { buildShiftReport } from "../services/shiftReport.js";
import { isValidDate } from "../models/ShiftAssignment.js";
import { ensureShiftDefaults } from "../services/shiftDefaults.js";

const router = Router();

function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const plantId = req.query.plantId ? String(req.query.plantId) : undefined;
    if (!plantId) return res.status(400).json({ error: "plantId is required" });

    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 6);

    const from = isValidDate(req.query.from) ? String(req.query.from) : ymd(weekAgo);
    const to = isValidDate(req.query.to) ? String(req.query.to) : ymd(today);
    if (to < from) return res.status(400).json({ error: "to must not be before from" });

    const spanDays = (new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86400000;
    if (spanDays > 92) return res.status(400).json({ error: "Range cannot exceed 92 days" });

    await ensureShiftDefaults(plantId);

    const report = await buildShiftReport(plantId, from, to);
    res.json({ ...report, hasData: report.totals.shifts > 0 });
  } catch (err: any) {
    const message = err?.message || "Failed to build shift report";
    const status = message === "Plant not found" || message.startsWith("No shifts") ? 404 : 500;
    res.status(status).json({ error: message });
  }
});

export default router;

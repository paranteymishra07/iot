import { Router, Request, Response } from "express";
import { MetricHistory } from "../models/MetricHistory.js";

const router = Router();

interface HourRow {
  time: string;
  oee: number;
  availability: number;
  performance: number;
  quality: number;
  units: number;
  temperature: number;
  power: number;
}

function label(hour: Date): string {
  return hour.getHours().toString().padStart(2, "0") + ":00";
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

router.get("/trends", async (req: Request, res: Response) => {
  try {
    const scope: string = req.query.scope === "machine" ? "machine" : "all";
    const hours = Math.min(168, Math.max(1, Number(req.query.hours) || 24));
    const machineId = req.query.machineId ? String(req.query.machineId) : undefined;

    const start = new Date();
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() - (hours - 1));

    const match: Record<string, unknown> = { hour: { $gte: start } };
    if (scope === "machine" && machineId) {
      const re = new RegExp(`^${escapeRegExp(machineId)}$`, "i");
      match.$or = [{ machineId: re }, { machineName: re }];
    }

    const docs = await MetricHistory.find(match).sort({ hour: 1 });

    interface HourAgg {
      hourTs: number;
      oeeSum: number;
      aSum: number;
      pSum: number;
      qSum: number;
      tSum: number;
      pwSum: number;
      count: number;
      units: number;
    }

    const byHour = new Map<number, HourAgg>();

    for (const d of docs) {
      const key = d.hour.getTime();
      let row = byHour.get(key);
      if (!row) {
        row = { hourTs: key, oeeSum: 0, aSum: 0, pSum: 0, qSum: 0, tSum: 0, pwSum: 0, count: 0, units: 0 };
        byHour.set(key, row);
      }
      row.oeeSum += d.oee || 0;
      row.aSum += d.availability || 0;
      row.pSum += d.performance || 0;
      row.qSum += d.quality || 0;
      row.tSum += d.temperature || 0;
      row.pwSum += d.power || 0;
      row.units += d.deltaUnits || 0;
      row.count += 1;
    }

    // Sort by timestamp, not the "HH:00" label, so windows crossing midnight
    // stay chronological.
    const pointByTs = new Map<number, HourRow>();
    for (const r of byHour.values()) {
      pointByTs.set(r.hourTs, {
        time: label(new Date(r.hourTs)),
        oee: Number((r.oeeSum / r.count).toFixed(1)),
        availability: Number((r.aSum / r.count).toFixed(1)),
        performance: Number((r.pSum / r.count).toFixed(1)),
        quality: Number((r.qSum / r.count).toFixed(1)),
        units: Math.round(r.units),
        temperature: Number((r.tSum / r.count).toFixed(1)),
        power: Number((r.pwSum / r.count).toFixed(1)),
      });
    }

    // Emit one row per hour in the requested window so the chart always has a
    // continuous x-axis; hours with no history carry the last known values.
    const series: HourRow[] = [];
    let carry: HourRow | undefined;

    for (let ts = start.getTime(); ts <= start.getTime() + (hours - 1) * 60 * 60 * 1000; ts += 60 * 60 * 1000) {
      const hit = pointByTs.get(ts);
      if (hit) {
        carry = hit;
        series.push(hit);
      } else if (carry) {
        series.push({ ...carry, time: label(new Date(ts)), units: 0 });
      }
    }

    res.json({ scope, hours, machineId: machineId ?? null, series, hasData: pointByTs.size > 0 });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch trends" });
  }
});

export default router;

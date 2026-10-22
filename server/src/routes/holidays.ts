import { Router, Request, Response } from "express";
import { Holiday, IHoliday, HOLIDAY_TYPES, HolidayType } from "../models/Holiday.js";
import { isValidDate } from "../models/ShiftAssignment.js";
import { Plant } from "../models/Plant.js";
import { requireHr, isInScope } from "../middleware/auth.js";

const router = Router();

// The holiday calendar is HR data and is scoped to the caller's own plant.
router.use(requireHr);

const denied = (res: Response) => res.status(403).json({ error: "You do not have access to that plant" });

type HolidayDoc = InstanceType<typeof Holiday>;

function refIdStr(value: unknown): string {
  const ref = value as { _id?: { toHexString(): string } };
  return ref?._id?.toHexString?.() || String(value ?? "");
}

function toClientHoliday(h: IHoliday): Record<string, unknown> {
  const doc = h as unknown as HolidayDoc;
  return {
    id: refIdStr(doc._id),
    plantId: refIdStr(doc.plantId),
    plant: doc.plant,
    date: doc.date,
    name: doc.name,
    type: doc.type,
    notes: doc.notes,
    createdAt: doc.createdAt,
  };
}

function readHolidayBody(body: Record<string, unknown>): Record<string, unknown> {
  const set: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) set.name = body.name.trim();
  if (body.date !== undefined) set.date = String(body.date);
  if (body.type !== undefined) {
    const type = String(body.type);
    if (!HOLIDAY_TYPES.includes(type as HolidayType)) set.type = "__invalid__";
    else set.type = type;
  }
  if (typeof body.notes === "string") set.notes = body.notes.trim();
  return set;
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const { plantId, from, to, year } = req.query;
    const filter: Record<string, unknown> = {};
    if (plantId) {
      if (!isInScope(req, plantId as string)) return denied(res);
      filter.plantId = plantId;
    } else if (req.plantScope !== null) {
      // Without a plantId, restrict the calendar to the caller's own plants.
      filter.plantId = { $in: req.plantScope || [] };
    }

    if (isValidDate(from) || isValidDate(to)) {
      filter.date = {};
      if (isValidDate(from)) (filter.date as Record<string, unknown>).$gte = from;
      if (isValidDate(to)) (filter.date as Record<string, unknown>).$lte = to;
    } else if (year && /^\d{4}$/.test(String(year))) {
      filter.date = { $gte: `${year}-01-01`, $lte: `${year}-12-31` };
    }

    const list = await Holiday.find(filter).sort({ date: 1 });
    res.json(list.map(toClientHoliday));
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch holidays" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const { plantId } = req.body;
    if (!plantId) return res.status(400).json({ error: "plantId is required" });
    if (!isInScope(req, plantId)) return denied(res);

    const set = readHolidayBody(req.body);
    if (set.type === "__invalid__") return res.status(400).json({ error: "Invalid holiday type" });
    if (!set.name) return res.status(400).json({ error: "Holiday name is required" });
    if (!isValidDate(set.date)) return res.status(400).json({ error: "date must be YYYY-MM-DD" });

    const plant = await Plant.findById(plantId).select("name").lean();
    if (!plant) return res.status(404).json({ error: "Plant not found" });

    const existing = await Holiday.findOne({ plantId, date: set.date }).lean();
    if (existing) return res.status(409).json({ error: "This plant already has a holiday on that date" });

    const holiday = await Holiday.create({ ...set, plantId, plant: plant.name });
    res.status(201).json(toClientHoliday(holiday));
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to create holiday" });
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const set = readHolidayBody(req.body);
    if (set.type === "__invalid__") return res.status(400).json({ error: "Invalid holiday type" });
    if (set.date !== undefined && !isValidDate(set.date)) {
      return res.status(400).json({ error: "date must be YYYY-MM-DD" });
    }

    const current = await Holiday.findById(req.params.id).lean();
    if (!current) return res.status(404).json({ error: "Not found" });
    if (!isInScope(req, String(current.plantId))) return denied(res);

    if (set.date && set.date !== current.date) {
      const clash = await Holiday.findOne({ plantId: current.plantId, date: set.date }).lean();
      if (clash) return res.status(409).json({ error: "This plant already has a holiday on that date" });
    }

    const holiday = await Holiday.findByIdAndUpdate(req.params.id, { $set: set }, { new: true });
    res.json(toClientHoliday(holiday as unknown as IHoliday));
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to update holiday" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const current = await Holiday.findById(req.params.id).lean();
    if (!current) return res.status(404).json({ error: "Not found" });
    if (!isInScope(req, String(current.plantId))) return denied(res);
    await Holiday.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete holiday" });
  }
});

export default router;

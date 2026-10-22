import { Router, Request, Response } from "express";
import { Shift, IShift, isValidTime, durationMin, crossesMidnight } from "../models/Shift.js";
import { ShiftAssignment, IShiftAssignment, RosterStatus, isValidDate, eachDate } from "../models/ShiftAssignment.js";
import { ensureShiftDefaults } from "../services/shiftDefaults.js";
import { Plant } from "../models/Plant.js";
import { User } from "../models/User.js";
import { requireHr, isInScope } from "../middleware/auth.js";

const router = Router();

// Shift definitions and the roster are HR data, scoped to the caller's own plant.
router.use(requireHr);

const denied = (res: Response) => res.status(403).json({ error: "You do not have access to that plant" });

type ShiftDoc = InstanceType<typeof Shift>;
type AssignmentDoc = InstanceType<typeof ShiftAssignment>;

const ROSTER_STATUSES: RosterStatus[] = ["planned", "confirmed", "completed"];

function refIdStr(value: unknown): string {
  const ref = value as { _id?: { toHexString(): string } };
  return ref?._id?.toHexString?.() || String(value ?? "");
}

function toClientShift(s: IShift): Record<string, unknown> {
  const doc = s as unknown as ShiftDoc;
  return {
    id: refIdStr(doc._id),
    plantId: refIdStr(doc.plantId),
    name: doc.name,
    code: doc.code,
    startTime: doc.startTime,
    endTime: doc.endTime,
    breakMin: doc.breakMin,
    order: doc.order,
    active: doc.active,
    durationMin: durationMin(doc.startTime, doc.endTime, doc.breakMin),
    crossesMidnight: crossesMidnight(doc.startTime, doc.endTime),
    createdAt: doc.createdAt,
  };
}

function toClientAssignment(a: IShiftAssignment): Record<string, unknown> {
  const doc = a as unknown as AssignmentDoc;
  return {
    id: refIdStr(doc._id),
    plantId: refIdStr(doc.plantId),
    plant: doc.plant,
    shiftId: refIdStr(doc.shiftId),
    shiftName: doc.shiftName,
    operatorId: refIdStr(doc.operatorId),
    operatorName: doc.operatorName,
    date: doc.date,
    status: doc.status,
    notes: doc.notes,
    createdAt: doc.createdAt,
  };
}

function readShiftBody(body: Record<string, unknown>): Record<string, unknown> {
  const set: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) set.name = body.name.trim();
  if (typeof body.code === "string" && body.code.trim()) set.code = body.code.trim().toUpperCase();
  if (body.startTime !== undefined) set.startTime = String(body.startTime);
  if (body.endTime !== undefined) set.endTime = String(body.endTime);
  if (body.breakMin !== undefined) set.breakMin = Number(body.breakMin) || 0;
  if (body.order !== undefined) set.order = Number(body.order) || 0;
  if (typeof body.active === "boolean") set.active = body.active;
  return set;
}

function validateShiftSet(set: Record<string, unknown>): string | null {
  if (!set.name) return "Shift name is required";
  if (!set.code) return "Shift code is required";
  if (!isValidTime(set.startTime)) return "Start time must be HH:MM (24h)";
  if (!isValidTime(set.endTime)) return "End time must be HH:MM (24h)";
  if (set.startTime === set.endTime) return "Start and end time cannot be the same";
  if (Number(set.breakMin) < 0) return "Break cannot be negative";
  if (Number(set.breakMin) >= durationMin(set.startTime as string, set.endTime as string)) {
    return "Break must be shorter than the shift";
  }
  return null;
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const plantId = req.query.plantId ? String(req.query.plantId) : undefined;
    if (plantId && !isInScope(req, plantId)) return denied(res);
    if (plantId) await ensureShiftDefaults(plantId);
    const all = req.query.all === "1" || req.query.all === "true";
    // Without a plantId, only ever return the caller's own plants' shifts.
    const query: Record<string, unknown> = plantId
      ? { plantId }
      : req.plantScope === null
        ? {}
        : { plantId: { $in: req.plantScope || [] } };
    const shifts = await Shift.find(query).sort({ order: 1, code: 1 });
    const list = shifts.map((s) => toClientShift(s));
    res.json(all ? list : list.filter((s) => s.active));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch shifts" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const { plantId } = req.body;
    if (!plantId) return res.status(400).json({ error: "plantId is required" });
    if (!isInScope(req, plantId)) return denied(res);
    const plant = await Plant.findById(plantId).select("name").lean();
    if (!plant) return res.status(404).json({ error: "Plant not found" });

    const set = readShiftBody(req.body);
    const invalid = validateShiftSet(set);
    if (invalid) return res.status(400).json({ error: invalid });

    const shift = await Shift.create({ ...set, plantId, order: set.order ?? (await Shift.countDocuments({ plantId })) + 1 });
    res.status(201).json(toClientShift(shift));
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to create shift" });
  }
});

router.get("/roster", async (req: Request, res: Response) => {
  try {
    const plantId = req.query.plantId ? String(req.query.plantId) : undefined;
    if (plantId && !isInScope(req, plantId)) return denied(res);
    if (plantId) await ensureShiftDefaults(plantId);

    const today = new Date();
    const defaultFrom = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const defaultTo = new Date(defaultFrom);
    defaultTo.setDate(defaultTo.getDate() + 6);

    const from = isValidDate(req.query.from) ? String(req.query.from) : defaultFrom.toISOString().slice(0, 10);
    const to = isValidDate(req.query.to) ? String(req.query.to) : defaultTo.toISOString().slice(0, 10);

    const match: Record<string, unknown> = { date: { $gte: from, $lte: to } };
    if (plantId) match.plantId = plantId;
    else if (req.plantScope !== null) match.plantId = { $in: req.plantScope || [] };

    const assignments = await ShiftAssignment.find(match).sort({ date: 1, shiftName: 1, operatorName: 1 });
    res.json({ from, to, assignments: assignments.map((a) => toClientAssignment(a)) });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch roster" });
  }
});

router.post("/roster", async (req: Request, res: Response) => {
  try {
    const { plantId, shiftId, operatorId, date, status, notes } = req.body;
    if (!plantId || !shiftId || !operatorId) return res.status(400).json({ error: "plantId, shiftId and operatorId are required" });
    if (!isInScope(req, plantId)) return denied(res);
    if (!isValidDate(date)) return res.status(400).json({ error: "date must be YYYY-MM-DD" });
    if (status && !ROSTER_STATUSES.includes(status)) return res.status(400).json({ error: "Invalid roster status" });

    const [plant, shift, operator] = await Promise.all([
      Plant.findById(plantId).select("name").lean(),
      Shift.findById(shiftId).lean(),
      User.findById(operatorId).select("name role status").lean(),
    ]);
    if (!plant) return res.status(404).json({ error: "Plant not found" });
    if (!shift) return res.status(404).json({ error: "Shift not found" });
    if (!operator) return res.status(404).json({ error: "Operator not found" });

    const assignment = await ShiftAssignment.findOneAndUpdate(
      { plantId, shiftId, operatorId, date },
      {
        $set: {
          plant: plant.name,
          shiftName: shift.name,
          operatorName: operator.name,
          status: status || "planned",
          notes: typeof notes === "string" ? notes : "",
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.status(201).json(toClientAssignment(assignment));
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to assign operator" });
  }
});

router.post("/roster/bulk", async (req: Request, res: Response) => {
  try {
    const { plantId, shiftId, operatorIds, from, to, mode } = req.body;
    if (!plantId || !shiftId) return res.status(400).json({ error: "plantId and shiftId are required" });
    if (!isInScope(req, plantId)) return denied(res);
    if (!Array.isArray(operatorIds) || operatorIds.length === 0) {
      return res.status(400).json({ error: "operatorIds must be a non-empty array" });
    }
    if (!isValidDate(from) || !isValidDate(to)) return res.status(400).json({ error: "from and to must be YYYY-MM-DD" });
    if (to < from) return res.status(400).json({ error: "to must not be before from" });

    const [plant, shift] = await Promise.all([
      Plant.findById(plantId).select("name").lean(),
      Shift.findById(shiftId).lean(),
    ]);
    if (!plant) return res.status(404).json({ error: "Plant not found" });
    if (!shift) return res.status(404).json({ error: "Shift not found" });

    const dates = eachDate(from, to);
    const operators = await User.find({ _id: { $in: operatorIds } }).select("name").lean();
    if (operators.length !== operatorIds.length) {
      return res.status(404).json({ error: "One or more operators not found" });
    }

    if (mode === "remove") {
      const res2 = await ShiftAssignment.deleteMany({ plantId, shiftId, date: { $in: dates }, operatorId: { $in: operatorIds } });
      return res.json({ mode: "remove", count: res2.deletedCount ?? 0 });
    }

    const ops: Parameters<typeof ShiftAssignment.bulkWrite>[0] = operators.flatMap((operator) =>
      dates.map((date) => ({
        updateOne: {
          filter: { plantId, shiftId, operatorId: String((operator as any)._id), date },
          update: {
            $setOnInsert: {
              plantId,
              plant: plant.name,
              shiftId,
              shiftName: shift.name,
              operatorId: String((operator as any)._id),
              operatorName: operator.name,
              date,
              status: "planned",
              notes: "",
            },
          },
          upsert: true,
        },
      }))
    );

    const result = await ShiftAssignment.bulkWrite(ops, { ordered: false });
    res.json({ mode: "add", count: result.upsertedCount ?? 0 });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to update roster" });
  }
});

router.put("/roster/:id", async (req: Request, res: Response) => {
  try {
    const { status, notes } = req.body;
    const set: Record<string, unknown> = {};
    if (status) {
      if (!ROSTER_STATUSES.includes(status)) return res.status(400).json({ error: "Invalid roster status" });
      set.status = status;
    }
    if (typeof notes === "string") set.notes = notes;
    const target = await ShiftAssignment.findById(req.params.id).lean();
    if (!target) return res.status(404).json({ error: "Not found" });
    if (!isInScope(req, String(target.plantId))) return denied(res);
    const assignment = await ShiftAssignment.findByIdAndUpdate(req.params.id, { $set: set }, { new: true });
    if (!assignment) return res.status(404).json({ error: "Not found" });
    res.json(toClientAssignment(assignment));
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to update assignment" });
  }
});

router.delete("/roster/:id", async (req: Request, res: Response) => {
  try {
    const target = await ShiftAssignment.findById(req.params.id).lean();
    if (!target) return res.status(404).json({ error: "Not found" });
    if (!isInScope(req, String(target.plantId))) return denied(res);
    await ShiftAssignment.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove assignment" });
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const set = readShiftBody(req.body);
    const current = await Shift.findById(req.params.id).lean();
    if (!current) return res.status(404).json({ error: "Not found" });
    if (!isInScope(req, String(current.plantId))) return denied(res);

    const merged = { ...current, ...set };
    const invalid = validateShiftSet(merged);
    if (invalid) return res.status(400).json({ error: invalid });

    const shift = await Shift.findByIdAndUpdate(req.params.id, { $set: set }, { new: true });
    if (set.name || set.code) {
      await ShiftAssignment.updateMany({ shiftId: req.params.id }, { $set: { shiftName: shift!.name } });
    }
    res.json(toClientShift(shift!));
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to update shift" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const current = await Shift.findById(req.params.id).lean();
    if (!current) return res.status(404).json({ error: "Not found" });
    if (!isInScope(req, String(current.plantId))) return denied(res);
    const assigned = await ShiftAssignment.countDocuments({ shiftId: req.params.id });
    if (assigned > 0) {
      return res.status(400).json({ error: `Cannot delete: ${assigned} roster assignment(s) still reference this shift` });
    }
    await Shift.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete shift" });
  }
});

export default router;

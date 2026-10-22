import { Router, Request, Response } from "express";
import { Attendance, IAttendance, ATTENDANCE_STATUSES, AttendanceStatus } from "../models/Attendance.js";
import { Holiday } from "../models/Holiday.js";
import { Shift } from "../models/Shift.js";
import { ShiftAssignment, isValidDate } from "../models/ShiftAssignment.js";
import { computeAttendance } from "../services/attendanceCalc.js";
import { ensureShiftDefaults } from "../services/shiftDefaults.js";
import { Plant } from "../models/Plant.js";
import { User } from "../models/User.js";
import { requireHr, isInScope } from "../middleware/auth.js";

const router = Router();

// Marking attendance is HR work, and HR only ever sees its own plant.
router.use(requireHr);

const denied = (res: Response) => res.status(403).json({ error: "You do not have access to that plant" });

type AttendanceDoc = InstanceType<typeof Attendance>;

function refIdStr(value: unknown): string {
  const ref = value as { _id?: { toHexString(): string } };
  return ref?._id?.toHexString?.() || String(value ?? "");
}

function toClientAttendance(a: IAttendance): Record<string, unknown> {
  const doc = a as unknown as AttendanceDoc;
  return {
    id: refIdStr(doc._id),
    plantId: refIdStr(doc.plantId),
    plant: doc.plant,
    shiftId: refIdStr(doc.shiftId),
    shiftName: doc.shiftName,
    shiftCode: doc.shiftCode,
    operatorId: refIdStr(doc.operatorId),
    operatorName: doc.operatorName,
    date: doc.date,
    status: doc.status,
    checkIn: doc.checkIn,
    checkOut: doc.checkOut,
    workedMin: doc.workedMin,
    lateMin: doc.lateMin,
    earlyLeaveMin: doc.earlyLeaveMin,
    otAutoMin: doc.otAutoMin,
    otMin: doc.otMin,
    otOverrideMin: doc.otOverrideMin,
    shiftStartTime: doc.shiftStartTime,
    shiftEndTime: doc.shiftEndTime,
    shiftDurationMin: doc.shiftDurationMin,
    isHoliday: doc.isHoliday,
    holidayName: doc.holidayName,
    notes: doc.notes,
    markedBy: doc.markedBy,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

interface MarkInput {
  plantId: string;
  shiftId: string;
  operatorId: string;
  date: string;
  status: AttendanceStatus;
  checkIn: string;
  checkOut: string;
  otOverrideMin: number | null;
  notes: string;
  markedBy: string;
}

function readMarkInput(body: Record<string, unknown>): { value: MarkInput | null; error?: string } {
  const plantId = String(body.plantId ?? "");
  const shiftId = String(body.shiftId ?? "");
  const operatorId = String(body.operatorId ?? "");
  const date = String(body.date ?? "");
  const status = String(body.status ?? "present") as AttendanceStatus;

  if (!plantId || !shiftId || !operatorId) return { value: null, error: "plantId, shiftId and operatorId are required" };
  if (!isValidDate(date)) return { value: null, error: "date must be YYYY-MM-DD" };
  if (!ATTENDANCE_STATUSES.includes(status)) return { value: null, error: "Invalid attendance status" };

  const rawOverride = body.otOverrideMin;
  let otOverrideMin: number | null = null;
  if (rawOverride !== undefined && rawOverride !== null && rawOverride !== "") {
    const n = Number(rawOverride);
    if (Number.isNaN(n) || n < 0) return { value: null, error: "otOverrideMin must be zero or more" };
    otOverrideMin = Math.round(n);
  }

  return {
    value: {
      plantId,
      shiftId,
      operatorId,
      date,
      status,
      checkIn: typeof body.checkIn === "string" ? body.checkIn : "",
      checkOut: typeof body.checkOut === "string" ? body.checkOut : "",
      otOverrideMin,
      notes: typeof body.notes === "string" ? body.notes.trim() : "",
      markedBy: typeof body.markedBy === "string" ? body.markedBy.trim() : "",
    },
  };
}

/**
 * Builds the record for one roster slot. The plant holiday (if any) is stamped
 * onto the row so the overtime rule and any later salary run still see it even
 * if the holiday is renamed or deleted afterwards.
 */
async function buildMarkedRecord(input: MarkInput) {
  const [plant, shift, operator, holiday] = await Promise.all([
    Plant.findById(input.plantId).select("name").lean(),
    Shift.findById(input.shiftId).lean(),
    User.findById(input.operatorId).select("name role status").lean(),
    Holiday.findOne({ plantId: input.plantId, date: input.date }).lean(),
  ]);

  if (!plant) return { error: "Plant not found", status: 404 };
  if (!shift) return { error: "Shift not found", status: 404 };
  if (!operator) return { error: "Operator not found", status: 404 };
  if (operator.status === "inactive") return { error: "Operator is inactive", status: 400 };

  const isHoliday = Boolean(holiday);
  const computed = computeAttendance({
    shift: { startTime: shift.startTime, endTime: shift.endTime, breakMin: shift.breakMin },
    status: input.status,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    isHoliday,
    overrideOtMin: input.otOverrideMin,
  });
  if (computed.error) return { error: computed.error, status: 400 };

  return {
    record: {
      plantId: input.plantId,
      plant: plant.name,
      shiftId: input.shiftId,
      shiftName: shift.name,
      shiftCode: shift.code,
      operatorId: input.operatorId,
      operatorName: operator.name,
      date: input.date,
      status: input.status,
      checkIn: computed.checkIn,
      checkOut: computed.checkOut,
      workedMin: computed.workedMin,
      lateMin: computed.lateMin,
      earlyLeaveMin: computed.earlyLeaveMin,
      otAutoMin: computed.otAutoMin,
      otMin: computed.otMin,
      otOverrideMin: input.otOverrideMin,
      shiftStartTime: shift.startTime,
      shiftEndTime: shift.endTime,
      shiftDurationMin: computed.shiftDurationMin,
      isHoliday,
      holidayName: holiday?.name ?? "",
      notes: input.notes,
      markedBy: input.markedBy,
    },
  };
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const { plantId, operatorId, shiftId } = req.query;
    const from = req.query.from ? String(req.query.from) : "";
    const to = req.query.to ? String(req.query.to) : "";
    if (!plantId) return res.status(400).json({ error: "plantId is required" });
    if (!isInScope(req, plantId as string)) return denied(res);
    if (!isValidDate(from) || !isValidDate(to)) {
      return res.status(400).json({ error: "from and to must be YYYY-MM-DD" });
    }
    if (to < from) return res.status(400).json({ error: "to must not be before from" });

    const filter: Record<string, unknown> = { plantId, date: { $gte: from, $lte: to } };
    if (operatorId) filter.operatorId = operatorId;
    if (shiftId) filter.shiftId = shiftId;

    const list = await Attendance.find(filter).sort({ date: 1, shiftCode: 1, operatorName: 1 });
    res.json(list.map(toClientAttendance));
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch attendance" });
  }
});

/**
 * Roster view for one day: every rostered operator x shift slot, joined with the
 * attendance already marked (if any) and the plant holiday. This is what the
 * marking screen renders, so unmarked slots arrive as pending rows.
 */
router.get("/day", async (req: Request, res: Response) => {
  try {
    const plantId = req.query.plantId ? String(req.query.plantId) : "";
    const date = req.query.date ? String(req.query.date) : "";
    if (!plantId) return res.status(400).json({ error: "plantId is required" });
    if (!isInScope(req, plantId)) return denied(res);
    if (!isValidDate(date)) return res.status(400).json({ error: "date must be YYYY-MM-DD" });

    const plant = await Plant.findById(plantId).select("name").lean();
    if (!plant) return res.status(404).json({ error: "Plant not found" });

    await ensureShiftDefaults(plantId);

    const [shifts, assignments, marked, holiday] = await Promise.all([
      Shift.find({ plantId, active: true }).sort({ order: 1, code: 1 }),
      ShiftAssignment.find({ plantId, date }).lean(),
      Attendance.find({ plantId, date }).lean(),
      Holiday.findOne({ plantId, date }).lean(),
    ]);

    const markedByKey = new Map(
      marked.map((m) => [`${refIdStr(m.shiftId)}|${refIdStr(m.operatorId)}`, m])
    );
    const holidayName = holiday?.name ?? "";
    const isHoliday = Boolean(holiday);

    // Group the roster by operator so the grid can list people once with their
    // per-shift slots underneath.
    const byOperator = new Map<string, { operatorId: string; operatorName: string; slots: Record<string, unknown>[] }>();
    for (const a of assignments) {
      const operatorId = refIdStr(a.operatorId);
      const shiftId = refIdStr(a.shiftId);
      if (!byOperator.has(operatorId)) {
        byOperator.set(operatorId, { operatorId, operatorName: a.operatorName, slots: [] });
      }
      const existing = markedByKey.get(`${shiftId}|${operatorId}`);
      byOperator.get(operatorId)!.slots.push(
        existing
          ? { ...toClientAttendance(existing as unknown as IAttendance), marked: true }
          : {
              id: "",
              plantId,
              plant: plant.name,
              shiftId,
              shiftName: a.shiftName,
              shiftCode: (shifts.find((s) => refIdStr(s._id) === shiftId)?.code ?? ""),
              operatorId,
              operatorName: a.operatorName,
              date,
              status: isHoliday ? "holiday" : "",
              checkIn: "",
              checkOut: "",
              workedMin: 0,
              lateMin: 0,
              earlyLeaveMin: 0,
              otAutoMin: 0,
              otMin: 0,
              otOverrideMin: null,
              shiftStartTime: shifts.find((s) => refIdStr(s._id) === shiftId)?.startTime ?? "",
              shiftEndTime: shifts.find((s) => refIdStr(s._id) === shiftId)?.endTime ?? "",
              shiftDurationMin: 0,
              isHoliday,
              holidayName,
              notes: "",
              markedBy: "",
              marked: false,
            }
      );
    }

    res.json({
      date,
      plant: { id: plantId, name: plant.name },
      isHoliday,
      holidayName,
      shifts: shifts.map((s) => ({
        id: refIdStr(s._id),
        code: s.code,
        name: s.name,
        startTime: s.startTime,
        endTime: s.endTime,
        breakMin: s.breakMin,
      })),
      operators: Array.from(byOperator.values()),
      totals: {
        rostered: assignments.length,
        marked: marked.length,
        present: marked.filter((m) => m.status === "present").length,
        absent: marked.filter((m) => m.status === "absent").length,
        leave: marked.filter((m) => m.status === "leave").length,
        halfDay: marked.filter((m) => m.status === "half_day").length,
        otMin: marked.reduce((sum, m) => sum + m.otMin, 0),
        lateMin: marked.reduce((sum, m) => sum + m.lateMin, 0),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load attendance day" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const { value, error } = readMarkInput(req.body ?? {});
    if (!value) return res.status(400).json({ error });
    if (!isInScope(req, value.plantId)) return denied(res);

    const built = await buildMarkedRecord(value);
    if (built.error) return res.status(built.status).json({ error: built.error });

    const saved = await Attendance.findOneAndUpdate(
      { plantId: value.plantId, shiftId: value.shiftId, operatorId: value.operatorId, date: value.date },
      { $set: built.record },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json(toClientAttendance(saved));
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to mark attendance" });
  }
});

/** Mark many roster slots at once (e.g. "mark everyone present for shift B"). */
router.post("/bulk", async (req: Request, res: Response) => {
  try {
    const { plantId, shiftId, date, status, checkIn, checkOut, operatorIds, markedBy } = req.body ?? {};
    if (!plantId || !shiftId) return res.status(400).json({ error: "plantId and shiftId are required" });
    if (!isInScope(req, plantId)) return denied(res);
    if (!isValidDate(date)) return res.status(400).json({ error: "date must be YYYY-MM-DD" });
    if (!ATTENDANCE_STATUSES.includes(status)) return res.status(400).json({ error: "Invalid attendance status" });
    if (!Array.isArray(operatorIds) || operatorIds.length === 0) {
      return res.status(400).json({ error: "operatorIds must be a non-empty array" });
    }

    const results: { operatorId: string; ok: boolean; error?: string }[] = [];
    for (const operatorId of operatorIds) {
      const { value, error } = readMarkInput({
        plantId,
        shiftId,
        operatorId,
        date,
        status,
        checkIn: checkIn ?? "",
        checkOut: checkOut ?? "",
        markedBy: markedBy ?? "",
      });
      if (!value) {
        results.push({ operatorId, ok: false, error });
        continue;
      }
      const built = await buildMarkedRecord(value);
      if (built.error) {
        results.push({ operatorId, ok: false, error: built.error });
        continue;
      }
      await Attendance.findOneAndUpdate(
        { plantId, shiftId, operatorId, date },
        { $set: built.record },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      results.push({ operatorId, ok: true });
    }

    res.json({ marked: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok) });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to mark attendance in bulk" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const existing = await Attendance.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (!isInScope(req, String(existing.plantId))) return denied(res);
    await Attendance.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete attendance record" });
  }
});

export default router;

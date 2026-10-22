import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import { SalaryStructure, ISalaryStructure, TAX_REGIMES, HOLIDAY_PAY_MODES, TaxRegime, HolidayPayMode } from "../models/SalaryStructure.js";
import { Payslip, IPayslip, PAYSLIP_STATUSES, PayslipStatus } from "../models/Payslip.js";
import { Attendance } from "../models/Attendance.js";
import { User } from "../models/User.js";
import { Plant } from "../models/Plant.js";
import { calculateSalary, SalaryStructureInput } from "../services/salaryCalc.js";
import { isValidDate } from "../models/ShiftAssignment.js";
import { requireHr, isInScope } from "../middleware/auth.js";

const router = Router();

// Salary is HR-only end to end: no role may read or change payroll without an
// HR-capable role, and every query is clamped to the caller's plant scope.
router.use(requireHr);

/** Clamps a list filter to the caller's plants when no plantId was supplied. */
function plantFilter(req: Request, requested?: string): Record<string, unknown> {
  if (requested) {
    if (!isInScope(req, requested)) return { __denied: true };
    return { plantId: requested };
  }
  if (req.plantScope === null) return {};
  return { plantId: { $in: req.plantScope || [] } };
}

const denied = (res: Response) => res.status(403).json({ error: "You do not have access to that plant" });

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

type SalaryStructureDoc = InstanceType<typeof SalaryStructure>;
type PayslipDoc = InstanceType<typeof Payslip>;

function refIdStr(value: unknown): string {
  const ref = value as { _id?: { toHexString(): string } };
  return ref?._id?.toHexString?.() || String(value ?? "");
}

/** Last day of the given "YYYY-MM", so a month run covers the whole calendar month. */
function monthBounds(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

function toClientStructure(s: ISalaryStructure): Record<string, unknown> {
  const doc = s as unknown as SalaryStructureDoc;
  return {
    id: refIdStr(doc._id),
    plantId: refIdStr(doc.plantId),
    plant: doc.plant,
    operatorId: refIdStr(doc.operatorId),
    operatorName: doc.operatorName,
    monthlyGross: doc.monthlyGross,
    basicPercent: doc.basicPercent,
    otMultiplier: doc.otMultiplier,
    effectiveFrom: doc.effectiveFrom,
    deductions: doc.deductions,
    taxRegime: doc.taxRegime,
    holidayPayMode: doc.holidayPayMode,
    professionalTaxAmount: doc.professionalTaxAmount,
    paidLeave: doc.paidLeave,
    active: doc.active,
    notes: doc.notes,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function toClientPayslip(p: IPayslip, warnings: string[] = []): Record<string, unknown> {
  const doc = p as unknown as PayslipDoc;
  return {    id: refIdStr(doc._id),
    plantId: refIdStr(doc.plantId),
    plant: doc.plant,
    operatorId: refIdStr(doc.operatorId),
    operatorName: doc.operatorName,
    month: doc.month,
    structureId: refIdStr(doc.structureId),
    structureSnapshot: doc.structureSnapshot,
    attendance: doc.attendance,
    earnings: doc.earnings,
    deductions: doc.deductions,
    netPay: doc.netPay,
    status: doc.status,
    generatedBy: doc.generatedBy,
    approvedBy: doc.approvedBy,
    approvedAt: doc.approvedAt,
    paidAt: doc.paidAt,
    notes: doc.notes,
    // The stored list wins so a re-fetched payslip keeps explaining itself;
    // freshly calculated warnings are the fallback for older documents.
    warnings: doc.warnings?.length ? doc.warnings : warnings,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/** Maps a stored structure onto the shape the calculator expects. */
function toCalcInput(s: ISalaryStructure): SalaryStructureInput {
  const doc = s as unknown as SalaryStructureDoc;
  const d = doc.deductions || ({} as Record<string, boolean>);
  return {
    monthlyGross: doc.monthlyGross,
    basicPercent: doc.basicPercent,
    otMultiplier: doc.otMultiplier,
    deductions: {
      epf: d.epf !== false,
      esi: d.esi !== false,
      professionalTax: d.professionalTax !== false,
      tds: d.tds !== false,
    },
    taxRegime: doc.taxRegime,
    holidayPayMode: doc.holidayPayMode,
    professionalTaxAmount: doc.professionalTaxAmount,
    paidLeave: doc.paidLeave,
  };
}

function readStructureBody(body: Record<string, unknown>): Record<string, unknown> {
  const set: Record<string, unknown> = {};

  if (body.monthlyGross !== undefined) {
    const gross = Number(body.monthlyGross);
    if (!Number.isFinite(gross) || gross < 0) set.monthlyGross = "__invalid__";
    else set.monthlyGross = gross;
  }
  if (body.basicPercent !== undefined) {
    const basic = Number(body.basicPercent);
    if (!Number.isFinite(basic) || basic < 0 || basic > 100) set.basicPercent = "__invalid__";
    else set.basicPercent = basic;
  }
  if (body.otMultiplier !== undefined) {
    const ot = Number(body.otMultiplier);
    if (!Number.isFinite(ot) || ot < 1) set.otMultiplier = "__invalid__";
    else set.otMultiplier = ot;
  }
  if (body.effectiveFrom !== undefined) {
    set.effectiveFrom = String(body.effectiveFrom);
  }
  if (body.deductions !== undefined && body.deductions && typeof body.deductions === "object") {
    const d = body.deductions as Record<string, unknown>;
    set.deductions = {
      epf: d.epf !== false,
      esi: d.esi !== false,
      professionalTax: d.professionalTax !== false,
      tds: d.tds !== false,
    };
  }
  if (body.taxRegime !== undefined) {
    const regime = String(body.taxRegime);
    set.taxRegime = TAX_REGIMES.includes(regime as TaxRegime) ? regime : "__invalid__";
  }
  if (body.holidayPayMode !== undefined) {
    const mode = String(body.holidayPayMode);
    set.holidayPayMode = HOLIDAY_PAY_MODES.includes(mode as HolidayPayMode) ? mode : "__invalid__";
  }
  if (body.professionalTaxAmount !== undefined) {
    const pt = Number(body.professionalTaxAmount);
    if (!Number.isFinite(pt) || pt < 0) set.professionalTaxAmount = "__invalid__";
    else set.professionalTaxAmount = pt;
  }
  if (body.paidLeave !== undefined) set.paidLeave = body.paidLeave !== false;
  if (body.active !== undefined) set.active = body.active !== false;
  if (typeof body.notes === "string") set.notes = body.notes.trim();
  return set;
}

// ---------------------------------------------------------------------------
// Salary structures
// ---------------------------------------------------------------------------

router.get("/structures", async (req: Request, res: Response) => {
  try {
    const { plantId, operatorId } = req.query;
    const filter = plantFilter(req, plantId as string | undefined);
    if (filter.__denied) return denied(res);
    if (operatorId) filter.operatorId = operatorId;
    const list = await SalaryStructure.find(filter).sort({ operatorName: 1, effectiveFrom: -1 });
    res.json(list.map(toClientStructure));
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch salary structures" });
  }
});

router.post("/structures", async (req: Request, res: Response) => {
  try {
    const { plantId, operatorId } = req.body;
    if (!plantId) return res.status(400).json({ error: "plantId is required" });
    if (!isInScope(req, plantId)) return denied(res);
    if (!operatorId || !mongoose.isValidObjectId(operatorId)) {
      return res.status(400).json({ error: "operatorId is required" });
    }

    const set = readStructureBody(req.body);
    for (const key of ["monthlyGross", "basicPercent", "otMultiplier", "taxRegime", "holidayPayMode", "professionalTaxAmount"]) {
      if (set[key] === "__invalid__") return res.status(400).json({ error: `Invalid ${key}` });
    }
    if (set.effectiveFrom !== undefined && !isValidDate(set.effectiveFrom)) {
      return res.status(400).json({ error: "effectiveFrom must be YYYY-MM-DD" });
    }
    if (!set.monthlyGross) return res.status(400).json({ error: "monthlyGross is required" });

    const operator = await User.findById(operatorId).select("name plant status role").lean();
    if (!operator) return res.status(404).json({ error: "Operator not found" });
    if (operator.role !== "operator") {
      return res.status(400).json({ error: "Salary can only be set for operator accounts" });
    }
    if (operator.status !== "active") {
      return res.status(400).json({ error: "Cannot set salary for an inactive operator" });
    }
    if (operator.plant) {
      const operatorPlant = await Plant.findOne({ name: operator.plant }).select("_id").lean();
      if (operatorPlant && String(operatorPlant._id) !== String(plantId)) {
        return res.status(400).json({ error: "Operator belongs to a different plant" });
      }
    }

    const plant = await Plant.findById(plantId).select("name").lean();
    if (!plant) return res.status(404).json({ error: "Plant not found" });

    const effectiveFrom = set.effectiveFrom || new Date().toISOString().slice(0, 10);
    const clash = await SalaryStructure.findOne({ operatorId, effectiveFrom }).lean();
    if (clash) {
      return res.status(409).json({ error: "A structure already exists for this operator from that date" });
    }

    const created = await SalaryStructure.create({
      ...set,
      effectiveFrom,
      plantId,
      plant: plant.name,
      operatorId,
      operatorName: operator.name,
    });
    res.status(201).json(toClientStructure(created));
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to create salary structure" });
  }
});

router.put("/structures/:id", async (req: Request, res: Response) => {
  try {
    const current = await SalaryStructure.findById(req.params.id).lean();
    if (!current) return res.status(404).json({ error: "Not found" });
    if (!isInScope(req, String(current.plantId))) return denied(res);

    const set = readStructureBody(req.body);
    for (const key of ["monthlyGross", "basicPercent", "otMultiplier", "taxRegime", "holidayPayMode", "professionalTaxAmount"]) {
      if (set[key] === "__invalid__") return res.status(400).json({ error: `Invalid ${key}` });
    }
    if (set.effectiveFrom !== undefined && !isValidDate(set.effectiveFrom)) {
      return res.status(400).json({ error: "effectiveFrom must be YYYY-MM-DD" });
    }
    if (set.effectiveFrom && set.effectiveFrom !== current.effectiveFrom) {
      const clash = await SalaryStructure.findOne({
        operatorId: current.operatorId,
        effectiveFrom: set.effectiveFrom,
        _id: { $ne: req.params.id },
      }).lean();
      if (clash) return res.status(409).json({ error: "A structure already exists for this operator from that date" });
    }

    const updated = await SalaryStructure.findByIdAndUpdate(req.params.id, { $set: set }, { new: true });
    res.json(toClientStructure(updated as unknown as ISalaryStructure));
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to update salary structure" });
  }
});

router.delete("/structures/:id", async (req: Request, res: Response) => {
  try {
    const structure = await SalaryStructure.findByIdAndDelete(req.params.id);
    if (!structure) return res.status(404).json({ error: "Not found" });
    // Payslips keep their own frozen snapshot, so removing the live structure
    // never rewrites payroll history.
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete salary structure" });
  }
});

// ---------------------------------------------------------------------------
// Payslips
// ---------------------------------------------------------------------------

router.get("/payslips", async (req: Request, res: Response) => {
  try {
    const { plantId, month, operatorId, status } = req.query;
    const filter = plantFilter(req, plantId as string | undefined);
    if (filter.__denied) return denied(res);
    if (month && MONTH_RE.test(String(month))) filter.month = month;
    if (operatorId) filter.operatorId = operatorId;
    if (status && PAYSLIP_STATUSES.includes(status as PayslipStatus)) filter.status = status;

    const list = await Payslip.find(filter).sort({ operatorName: 1 });
    res.json(list.map((p) => toClientPayslip(p)));
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch payslips" });
  }
});

router.get("/payslips/:id", async (req: Request, res: Response) => {
  try {
    const payslip = await Payslip.findById(req.params.id);
    if (!payslip) return res.status(404).json({ error: "Not found" });
    if (!isInScope(req, String(payslip.plantId))) return denied(res);
    res.json(toClientPayslip(payslip));
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch payslip" });
  }
});

/**
 * Runs payroll for a month. Payslip figures are a frozen snapshot, so this
 * always rebuilds drafts from the current attendance and refuses to touch a
 * month that is already approved or paid.
 */
router.post("/run", async (req: Request, res: Response) => {
  try {
    const { plantId, month, generatedBy, bonus, otherDeduction, force } = req.body;
    if (!plantId) return res.status(400).json({ error: "plantId is required" });
    if (!isInScope(req, plantId)) return denied(res);
    if (!month || !MONTH_RE.test(String(month))) {
      return res.status(400).json({ error: "month must be YYYY-MM" });
    }
    if (!mongoose.isValidObjectId(plantId)) return res.status(400).json({ error: "Invalid plantId" });

    const plant = await Plant.findById(plantId).select("name").lean();
    if (!plant) return res.status(404).json({ error: "Plant not found" });

    const { from, to } = monthBounds(month);

    // Only operators with a structure in force on the first of the month are
    // paid, so a mid-month hire is handled by a structure with a later
    // effectiveFrom on the next run.
    const structures = await SalaryStructure.find({
      plantId,
      effectiveFrom: { $lte: from },
      active: { $ne: false },
    }).sort({ operatorId: 1, effectiveFrom: -1 });

    if (structures.length === 0) {
      return res.status(400).json({ error: `No salary structures are in force for ${month}` });
    }

    // The newest structure per operator wins when several are in force.
    const effective = new Map<string, ISalaryStructure>();
    for (const s of structures) {
      const key = refIdStr((s as unknown as SalaryStructureDoc).operatorId);
      if (!effective.has(key)) effective.set(key, s);
    }

    const existing = await Payslip.find({ plantId, month }).lean();
    const existingByOperator = new Map(
      existing.map((p) => [refIdStr(p.operatorId), p])
    );

    const locked = existing.filter((p) => p.status !== "draft").map((p) => p.operatorName);
    if (locked.length > 0 && !force) {
      return res.status(409).json({
        error: `${month} already has approved or paid payslips and will not be overwritten`,
        operators: locked,
      });
    }

    const attendance = await Attendance.find({
      plantId,
      date: { $gte: from, $lte: to },
    }).lean();

    const byOperator = new Map<string, typeof attendance>();
    for (const row of attendance) {
      const key = refIdStr(row.operatorId);
      const list = byOperator.get(key);
      if (list) list.push(row);
      else byOperator.set(key, [row]);
    }

    const results: Record<string, unknown>[] = [];
    const skipped: { operatorName: string; reason: string }[] = [];
    const written: IPayslip[] = [];

    for (const [operatorId, structure] of effective) {
      const prior = existingByOperator.get(operatorId);
      if (prior && prior.status !== "draft" && !force) {
        skipped.push({ operatorName: prior.operatorName, reason: `already ${prior.status}` });
        continue;
      }
      const priorId = prior ? (prior as unknown as { _id: mongoose.Types.ObjectId })._id : null;

      const rows = byOperator.get(operatorId) || [];
      const calc = calculateSalary({
        month,
        structure: toCalcInput(structure),
        attendance: rows,
        bonus: Number(bonus) || 0,
        otherDeduction: Number(otherDeduction) || 0,
      });

      const doc = prior
        ? await Payslip.findByIdAndUpdate(
            priorId,
            {
              $set: {
                structureId: (structure as unknown as SalaryStructureDoc)._id,
                structureSnapshot: toClientStructure(structure),
                attendance: calc.attendance,
                earnings: calc.earnings,
                deductions: calc.deductions,
                netPay: calc.netPay,
                warnings: calc.warnings,
                status: "draft",
                generatedBy: String(generatedBy || ""),
                notes: "",
              },
            },
            { new: true }
          )
        : await Payslip.create({
            plantId,
            plant: plant.name,
            operatorId: (structure as unknown as SalaryStructureDoc).operatorId,
            operatorName: (structure as unknown as SalaryStructureDoc).operatorName,
            month,
            structureId: (structure as unknown as SalaryStructureDoc)._id,
            structureSnapshot: toClientStructure(structure),
            attendance: calc.attendance,
            earnings: calc.earnings,
            deductions: calc.deductions,
            netPay: calc.netPay,
            warnings: calc.warnings,
            status: "draft",
            generatedBy: String(generatedBy || ""),
          });

      if (doc) {
        written.push(doc as unknown as IPayslip);
        results.push(toClientPayslip(doc as unknown as IPayslip, calc.warnings));
      }
    }

    const totals = written.reduce(
      (acc, p) => ({
        gross: acc.gross + p.earnings.grossEarnings,
        deductions: acc.deductions + p.deductions.total,
        net: acc.net + p.netPay,
        epf: acc.epf + p.deductions.epf,
        esi: acc.esi + p.deductions.esi,
        pt: acc.pt + p.deductions.professionalTax,
        tds: acc.tds + p.deductions.tds,
        lop: acc.lop + p.deductions.lop,
      }),
      { gross: 0, deductions: 0, net: 0, epf: 0, esi: 0, pt: 0, tds: 0, lop: 0 }
    );

    const round = (n: number) => Math.round(n * 100) / 100 + 0;

    res.status(201).json({
      month,
      plant: plant.name,
      count: results.length,
      results,
      skipped,
      totals: {
        grossEarnings: round(totals.gross),
        totalDeductions: round(totals.deductions),
        netPay: round(totals.net),
        epf: round(totals.epf),
        esi: round(totals.esi),
        professionalTax: round(totals.pt),
        tds: round(totals.tds),
        lop: round(totals.lop),
      },
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to run payroll" });
  }
});

/** Moves a payslip through draft -> approved -> paid. */
router.put("/payslips/:id/status", async (req: Request, res: Response) => {
  try {
    const { status, approvedBy } = req.body;
    if (!status || !PAYSLIP_STATUSES.includes(status as PayslipStatus)) {
      return res.status(400).json({ error: "Invalid payslip status" });
    }

    const current = await Payslip.findById(req.params.id);
    if (!current) return res.status(404).json({ error: "Not found" });
    if (!isInScope(req, String(current.plantId))) return denied(res);

    // Approve only from draft, pay only from approved, so a payslip cannot skip
    // review or go back to draft once money has moved.
    if (status === "approved" && current.status !== "draft") {
      return res.status(409).json({ error: `Only a draft can be approved, this one is ${current.status}` });
    }
    if (status === "paid" && current.status !== "approved") {
      return res.status(409).json({ error: `Only an approved payslip can be marked paid, this one is ${current.status}` });
    }
    if (status === "draft" && current.status !== "draft") {
      return res.status(409).json({ error: "A payslip cannot go back to draft once it is approved or paid" });
    }

    const update: Record<string, unknown> = { status };
    if (status === "approved") {
      update.approvedBy = String(approvedBy || "");
      update.approvedAt = new Date();
    }
    if (status === "paid") update.paidAt = new Date();

    const updated = await Payslip.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
    res.json(toClientPayslip(updated as unknown as IPayslip));
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to update payslip status" });
  }
});

/**
 * Removes a draft payslip, so a payroll run made in error can be cleared out.
 * Approved and paid payslips are payroll history and are never deleted here.
 */
router.delete("/payslips/:id", async (req: Request, res: Response) => {
  try {
    const payslip = await Payslip.findById(req.params.id).lean();
    if (!payslip) return res.status(404).json({ error: "Not found" });
    if (!isInScope(req, String(payslip.plantId))) return denied(res);
    if (payslip.status !== "draft") {
      return res.status(409).json({
        error: `Only a draft payslip can be deleted, this one is ${payslip.status}`,
      });
    }
    await Payslip.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete payslip" });
  }
});

/** Dry run for a single operator, so HR can check a month before running it. */
router.post("/preview", async (req: Request, res: Response) => {
  try {
    const { plantId, operatorId, month, bonus, otherDeduction } = req.body;
    if (!plantId || !operatorId) return res.status(400).json({ error: "plantId and operatorId are required" });
    if (!isInScope(req, plantId)) return denied(res);
    if (!month || !MONTH_RE.test(String(month))) return res.status(400).json({ error: "month must be YYYY-MM" });

    const { from, to } = monthBounds(month);
    const structure = await SalaryStructure.findOne({
      operatorId,
      plantId,
      effectiveFrom: { $lte: from },
      active: { $ne: false },
    }).sort({ effectiveFrom: -1 }).lean();

    if (!structure) return res.status(404).json({ error: "No salary structure is in force for this month" });

    const rows = await Attendance.find({ plantId, operatorId, date: { $gte: from, $lte: to } }).lean();
    const leanStructure = structure as unknown as ISalaryStructure;
    const calc = calculateSalary({
      month,
      structure: toCalcInput(leanStructure),
      attendance: rows,
      bonus: Number(bonus) || 0,
      otherDeduction: Number(otherDeduction) || 0,
    });

    res.json({
      month,
      operatorId,
      operatorName: (structure as unknown as { operatorName?: string }).operatorName || "",
      structure: toClientStructure(leanStructure),
      calculation: calc,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to preview salary" });
  }
});

export default router;

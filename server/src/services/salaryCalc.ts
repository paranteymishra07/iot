import { AttendanceRecordLike } from "./attendanceTypes.js";
import { HolidayPayMode, TaxRegime } from "../models/SalaryStructure.js";

/**
 * Indian plant payroll.
 *
 * Earned pay
 *   monthlyPay   fixed salary for the month
 *   otAmount     worked overtime minutes x hourly rate x otMultiplier
 *   holidayPay   public/company holidays, only in "extra" mode
 *   bonus        manual, never part of the PF/ESI wage base
 *
 * Deductions
 *   LOP          loss of pay for unexcused absence and unpaid leave
 *   EPF          12% employee share of basic (statutory, 12% wage ceiling)
 *   ESI          0.75% employee share, skipped above the 15000 wage ceiling
 *   PT           flat monthly state slab
 *   TDS          annualised on the tax regime, monthly share deducted
 *   late         optional company policy, disabled by default
 */

export const STANDARD_HOURS_PER_DAY = 8;
export const EPF_RATE = 0.12;
export const EPF_WAGE_CEILING = 15000;
export const ESI_RATE = 0.0075;
export const ESI_WAGE_CEILING = 15000;

// `+ 0` normalises -0 to 0, which otherwise shows up on a payslip when a
// deduction exactly cancels the earnings (a fully absent month, for example).
const round2 = (n: number) => Math.round(n * 100) / 100 + 0;

/** ESI has a 170/month contribution ceiling, PF has no monthly cap. */
export const ESI_MONTHLY_CAP = 170;

export const NEW_REGIME_SLABS: { upTo: number; rate: number }[] = [
  { upTo: 300000, rate: 0 },
  { upTo: 700000, rate: 0.05 },
  { upTo: 1000000, rate: 0.1 },
  { upTo: 1200000, rate: 0.15 },
  { upTo: 1500000, rate: 0.2 },
  { upTo: Infinity, rate: 0.3 },
];

export const OLD_REGIME_SLABS: { upTo: number; rate: number }[] = [
  { upTo: 250000, rate: 0 },
  { upTo: 500000, rate: 0.05 },
  { upTo: 1000000, rate: 0.2 },
  { upTo: Infinity, rate: 0.3 },
];

/** Annual income tax under the new regime, including the 87A rebate. */
export function computeAnnualTaxNewRegime(annualTaxable: number): number {
  if (annualTaxable <= 0) return 0;
  let remaining = annualTaxable;
  let previous = 0;
  let tax = 0;
  for (const slab of NEW_REGIME_SLABS) {
    if (remaining <= 0) break;
    const taxableInSlab = Math.min(remaining, slab.upTo - previous);
    tax += taxableInSlab * slab.rate;
    remaining -= taxableInSlab;
    previous = slab.upTo;
  }
  // 87A: up to 12L of taxable income is effectively zero-rated for most filers.
  if (annualTaxable <= 1200000) {
    const rebate = Math.min(tax, 60000);
    tax = Math.max(0, tax - rebate);
  }
  return tax;
}

/** Annual income tax under the old regime, with the standard deduction. */
export function computeAnnualTaxOldRegime(
  annualGrossWages: number,
  deductionsUnder80C = 0
): number {
  const taxable = Math.max(0, annualGrossWages - 50000 - Math.max(0, deductionsUnder80C));
  if (taxable <= 0) return 0;
  let remaining = taxable;
  let previous = 0;
  let tax = 0;
  for (const slab of OLD_REGIME_SLABS) {
    if (remaining <= 0) break;
    const taxableInSlab = Math.min(remaining, slab.upTo - previous);
    tax += taxableInSlab * slab.rate;
    remaining -= taxableInSlab;
    previous = slab.upTo;
  }
  // 87A rebate for sub-5L taxpayers in the old regime.
  if (taxable <= 500000) tax = Math.max(0, tax - 12500);
  return tax;
}

export interface SalaryStructureInput {
  monthlyGross: number;
  basicPercent: number;
  otMultiplier: number;
  deductions: {
    epf: boolean;
    esi: boolean;
    professionalTax: boolean;
    tds: boolean;
  };
  taxRegime: TaxRegime;
  holidayPayMode: HolidayPayMode;
  professionalTaxAmount: number;
  paidLeave: boolean;
  /** Company policy for lateness. Off by default since it is not statutory. */
  lateDeductionEnabled?: boolean;
  lateGraceMin?: number;
  lateDeductionDaysPerLate?: number;
}

export interface SalaryCalculationInput {
  month: string; // "YYYY-MM"
  structure: SalaryStructureInput;
  attendance: AttendanceRecordLike[];
  bonus?: number;
  /** Manual extra deduction, e.g. a recovery. */
  otherDeduction?: number;
  /** Deductions claimed under section 80C, only used by the old regime. */
  deductions80C?: number;
}

export interface SalaryCalculation {
  daysInMonth: number;
  dailyWage: number;
  hourlyRate: number;
  basicAmount: number;
  attendance: {
    presentDays: number;
    halfDays: number;
    absentDays: number;
    paidLeaveDays: number;
    unpaidLeaveDays: number;
    paidHolidayDays: number;
    weeklyOffDays: number;
    lateDays: number;
    lateMin: number;
    workedMin: number;
    otMin: number;
    unmarkedDays: number;
    /** Distinct calendar days carrying at least one attendance row. */
    markedDays: number;
  };
  earnings: {
    monthlyPay: number;
    otAmount: number;
    paidHolidayAmount: number;
    bonus: number;
    grossEarnings: number;
    grossWages: number;
  };
  deductions: {
    lop: number;
    epf: number;
    esi: number;
    professionalTax: number;
    tds: number;
    late: number;
    other: number;
    total: number;
  };
  netPay: number;
  warnings: string[];
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return 30;
  return new Date(y, m, 0).getDate();
}

export function calculateSalary(input: SalaryCalculationInput): SalaryCalculation {
  const { structure } = input;
  const warnings: string[] = [];

  const monthDays = daysInMonth(input.month);
  const monthlyGross = Math.max(0, structure.monthlyGross);

  const dailyWage = monthlyGross / monthDays;
  const basicAmount = (monthlyGross * clamp(structure.basicPercent, 0, 100)) / 100;
  // Overtime is valued against the gross hourly rate, not the basic.
  const hourlyRate = monthlyGross / (monthDays * STANDARD_HOURS_PER_DAY);

  const counts = tallyAttendance(input.attendance, structure, input.month, monthDays);

  // --- Earnings -------------------------------------------------------------
  // The full monthly gross is reported here and loss of pay is carried as a
  // deduction line, so a payslip always reconciles as gross - deductions = net.
  // Subtracting LOP from earnings *and* listing it as a deduction would charge
  // the operator for an absence twice.
  const monthlyPay = round2(monthlyGross);

  const otAmount = round2((counts.otMin / 60) * hourlyRate * Math.max(1, structure.otMultiplier));

  const paidHolidayAmount =
    structure.holidayPayMode === "extra" ? round2(counts.paidHolidayDays * dailyWage) : 0;

  const bonus = round2(Math.max(0, input.bonus ?? 0));

  // Statutory wages: everything the employee earns except the manual bonus.
  const grossWages = round2(monthlyPay + otAmount + paidHolidayAmount);
  const grossEarnings = round2(grossWages + bonus);

  // --- Deductions -----------------------------------------------------------
  const lop = round2(counts.lopAmount);

  // EPF: 12% of basic, but never more than 12% of the 15000 wage ceiling.
  let epf = 0;
  if (structure.deductions.epf) {
    const pfBase = Math.min(basicAmount, EPF_WAGE_CEILING);
    epf = round2(pfBase * EPF_RATE);
    if (basicAmount > EPF_WAGE_CEILING) {
      warnings.push("Basic is above the EPF 15000 ceiling; PF is capped at 12% of 15000.");
    }
  }

  // ESI: 0.75% of gross wages, only while the wage ceiling is not crossed.
  let esi = 0;
  if (structure.deductions.esi) {
    if (grossWages <= ESI_WAGE_CEILING) {
      esi = round2(Math.min(grossWages * ESI_RATE, ESI_MONTHLY_CAP));
    } else {
      warnings.push("Gross wages are above the ESI 15000 ceiling, so ESI is not deducted.");
    }
  }

  const professionalTax = structure.deductions.professionalTax
    ? round2(Math.max(0, structure.professionalTaxAmount))
    : 0;

  // TDS on the annualised, non-bonus wages less the statutory employee shares.
  let tds = 0;
  if (structure.deductions.tds) {
    const monthlyTaxableWages = Math.max(0, grossWages - epf - esi - professionalTax);
    const annualTaxable = monthlyTaxableWages * 12;
    const annualTax =
      structure.taxRegime === "old"
        ? computeAnnualTaxOldRegime(annualTaxable, input.deductions80C)
        : computeAnnualTaxNewRegime(annualTaxable);
    tds = round2(annualTax / 12);
    if (tds <= 0) {
      warnings.push("Annualised salary is below the tax threshold, so no TDS is deducted.");
    }
  }

  // Lateness: a company policy, not a statutory deduction. Off unless enabled.
  let late = 0;
  if (structure.lateDeductionEnabled && counts.lateDays.length > 0) {
    const grace = Math.max(0, structure.lateGraceMin ?? 0);
    const lateBeyondGrace = (counts.lateDays as number[]).filter((m) => m > grace).length;
    const perLate = structure.lateDeductionDaysPerLate ?? 0;
    if (perLate > 0 && lateBeyondGrace > 0) {
      late = round2(lateBeyondGrace * perLate * dailyWage);
    }
  }

  const other = round2(Math.max(0, input.otherDeduction ?? 0));

  const total = round2(lop + epf + esi + professionalTax + tds + late + other);

  const netPay = round2(grossEarnings - total);
  if (netPay < 0) {
    warnings.push("Deductions exceed earnings, so net pay is negative. Check the inputs.");
  }
  if (counts.unmarkedDays > 0) {
    warnings.push(
      `${counts.unmarkedDays} day(s) in this month have no attendance row. They are not deducted, but the salary is incomplete until attendance is marked.`
    );
  }

  return {
    daysInMonth: monthDays,
    dailyWage: round2(dailyWage),
    hourlyRate: round2(hourlyRate),
    basicAmount,
    attendance: {
      presentDays: counts.presentDays,
      halfDays: counts.halfDays,
      absentDays: counts.absentDays,
      paidLeaveDays: counts.paidLeaveDays,
      unpaidLeaveDays: counts.unpaidLeaveDays,
      paidHolidayDays: counts.paidHolidayDays,
      weeklyOffDays: counts.weeklyOffDays,
      lateDays: counts.lateDays.length,
      lateMin: counts.lateMin,
      workedMin: counts.workedMin,
      otMin: counts.otMin,
      unmarkedDays: counts.unmarkedDays,
      markedDays: counts.markedDays,
    },
    earnings: { monthlyPay, otAmount, paidHolidayAmount, bonus, grossEarnings, grossWages },
    deductions: { lop, epf, esi, professionalTax, tds, late, other, total },
    netPay,
    warnings,
  };
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

interface Tally {
  presentDays: number;
  halfDays: number;
  absentDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  paidHolidayDays: number;
  weeklyOffDays: number;
  workedMin: number;
  otMin: number;
  lopAmount: number;
  lateDays: number[];
  lateMin: number;
  markedDays: number;
  unmarkedDays: number;
}

/**
 * Attendance is per shift, but payroll is per day, so rows are folded onto
 * calendar days first. An operator rostered on two shifts in one day is paid
 * one day, while their hours and overtime from both shifts still add up.
 */
function tallyAttendance(
  rows: AttendanceRecordLike[],
  structure: SalaryStructureInput,
  month: string,
  monthDays: number
): Tally {
  const byDate = new Map<string, AttendanceRecordLike[]>();
  for (const r of rows) {
    if (!r.date.startsWith(month)) continue;
    const list = byDate.get(r.date);
    if (list) list.push(r);
    else byDate.set(r.date, [r]);
  }

  const tally: Tally = {
    presentDays: 0,
    halfDays: 0,
    absentDays: 0,
    paidLeaveDays: 0,
    unpaidLeaveDays: 0,
    paidHolidayDays: 0,
    weeklyOffDays: 0,
    workedMin: 0,
    otMin: 0,
    lopAmount: 0,
    lateDays: [],
    lateMin: 0,
    markedDays: byDate.size,
    unmarkedDays: Math.max(0, monthDays - byDate.size),
  };

  // Days that hold nothing are counted at the end.
  for (const [date, dayRows] of byDate) {
    tally.workedMin += dayRows.reduce((s, r) => s + (r.workedMin || 0), 0);
    tally.otMin += dayRows.reduce((s, r) => s + (r.otMin || 0), 0);
    tally.lateMin += dayRows.reduce((s, r) => s + (r.lateMin || 0), 0);
    if (dayRows.some((r) => (r.lateMin || 0) > 0)) {
      tally.lateDays.push(Math.max(...dayRows.map((r) => r.lateMin || 0)));
    }

    // A day takes the "best" status: real work outranks a leave or absence
    // marker, and a half day outranks a full absence.
    const present = dayRows.some((r) => r.status === "present");
    const half = dayRows.some((r) => r.status === "half_day");
    const leave = dayRows.some((r) => r.status === "leave");
    const absent = dayRows.some((r) => r.status === "absent");
    const holiday = dayRows.some((r) => r.status === "holiday" || r.isHoliday);
    const weeklyOff = dayRows.some((r) => r.status === "weekly_off");

    if (present) {
      tally.presentDays++;
    } else if (half) {
      tally.halfDays++;
    } else if (leave) {
      if (structure.paidLeave) tally.paidLeaveDays++;
      else {
        tally.unpaidLeaveDays++;
      }
    } else if (absent) {
      tally.absentDays++;
    } else if (holiday) {
      tally.paidHolidayDays++;
    } else if (weeklyOff) {
      tally.weeklyOffDays++;
    }
  }

  const dailyWage = Math.max(0, structure.monthlyGross) / monthDays;
  // Loss of pay: an unexcused absence and an unpaid leave both cost a day. A
  // paid holiday, a weekly off and any unmarked day cost nothing.
  const unpaidLeaveLoss = tally.unpaidLeaveDays * dailyWage;
  const absenceLoss = tally.absentDays * dailyWage;
  tally.lopAmount = unpaidLeaveLoss + absenceLoss;

  return tally;
}

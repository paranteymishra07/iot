import { toMinutes, crossesMidnight, durationMin, isValidTime } from "../models/Shift.js";
import { AttendanceStatus } from "../models/Attendance.js";

export interface ShiftWindow {
  startTime: string;
  endTime: string;
  breakMin: number;
}

export interface ComputedAttendance {
  checkIn: string;
  checkOut: string;
  workedMin: number;
  lateMin: number;
  earlyLeaveMin: number;
  otAutoMin: number;
  otMin: number;
  shiftDurationMin: number;
}

// A standard working day. Overtime only starts once the operator is on the clock
// beyond this, and the shift break is deducted on top of it. So an 8h shift with
// a 30m break needs 8h30m on the clock before a single overtime minute is earned
// — working the full 8h span itself is not overtime.
export const STANDARD_DAY_MIN = 8 * 60;

// Everything is in minutes-from-midnight, with times that wrap past midnight
// pushed onto the next day (+1440) so a night shift stays monotonic.
function normalizeOut(outMin: number, inMin: number): number {
  return outMin < inMin ? outMin + 1440 : outMin;
}

/**
 * Derives worked hours, lateness and overtime from the punch times.
 *
 * Overtime rules:
 *  - on a plant holiday or weekly off, every worked minute counts as overtime
 *  - otherwise overtime is the time on the clock beyond a standard day, with the
 *    shift break deducted as well: ot = worked - (8h + break)
 * HR can override the result via `overrideOtMin`.
 */
export function computeAttendance(opts: {
  shift: ShiftWindow;
  status: AttendanceStatus;
  checkIn: string;
  checkOut: string;
  isHoliday: boolean;
  overrideOtMin?: number | null;
}): ComputedAttendance & { error?: string } {
  const shiftNetMin = durationMin(opts.shift.startTime, opts.shift.endTime, opts.shift.breakMin);
  const startMin = toMinutes(opts.shift.startTime);
  const wraps = crossesMidnight(opts.shift.startTime, opts.shift.endTime);
  const endMin = toMinutes(opts.shift.endTime) + (wraps ? 1440 : 0);

  const base: ComputedAttendance = {
    checkIn: "",
    checkOut: "",
    workedMin: 0,
    lateMin: 0,
    earlyLeaveMin: 0,
    otAutoMin: 0,
    otMin: 0,
    shiftDurationMin: shiftNetMin,
  };

  const hasIn = isValidTime(opts.checkIn);
  const hasOut = isValidTime(opts.checkOut);
  const workedOnOffDay = opts.status === "weekly_off" || opts.isHoliday;

  // absent and leave never accrue hours, whatever times were sent.
  const punchesForbidden = opts.status === "absent" || opts.status === "leave";
  // A holiday or weekly off usually accrues nothing, but if HR punched the
  // operator in they did work the day, and every minute then counts as overtime.
  const punchesOptional = opts.status === "holiday" || opts.status === "weekly_off";

  if (punchesForbidden) return base;
  if (punchesOptional && !hasIn && !hasOut) return base;

  // present and half_day must be backed by real times, otherwise a "present"
  // record with zero hours would quietly corrupt the salary run.
  if (!hasIn) return { ...base, error: "Check-in time is required" };
  if (!hasOut) return { ...base, error: "Check-out time is required" };

  const inMin = toMinutes(opts.checkIn);
  const outMin = normalizeOut(toMinutes(opts.checkOut), inMin);
  const workedMin = Math.max(0, outMin - inMin);

  const lateMin = Math.max(0, inMin - startMin);
  const earlyLeaveMin = Math.max(0, endMin - outMin);

  // The break is deducted on top of the standard day, so an 8h shift with a 30m
  // break only starts earning overtime after 8h30m on the clock.
  const otThresholdMin = STANDARD_DAY_MIN + Math.max(0, opts.shift.breakMin);
  const otAutoMin = workedOnOffDay ? workedMin : Math.max(0, workedMin - otThresholdMin);

  const otMin =
    typeof opts.overrideOtMin === "number" && opts.overrideOtMin >= 0
      ? Math.min(opts.overrideOtMin, workedMin)
      : otAutoMin;

  return {
    checkIn: opts.checkIn,
    checkOut: opts.checkOut,
    workedMin,
    lateMin,
    earlyLeaveMin,
    otAutoMin,
    otMin,
    shiftDurationMin: shiftNetMin,
  };
}

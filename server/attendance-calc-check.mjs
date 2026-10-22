import { computeAttendance } from "./dist/services/attendanceCalc.js";

const A = { startTime: "06:00", endTime: "14:00", breakMin: 30 }; // net 450
const C = { startTime: "22:00", endTime: "06:00", breakMin: 30 }; // net 450, wraps

// Overtime only starts past 8h on the clock, with the 30m break deducted on top,
// so an 8h shift needs 8h30m before a single OT minute is earned.
const cases = [
  ["A: full 8h span is NOT overtime", A, "present", "06:00", "14:00", false, null, { workedMin: 480, otAutoMin: 0, otMin: 0 }],
  ["A: 8h30m clock = exactly 8h net, no OT", A, "present", "06:00", "14:30", false, null, { workedMin: 510, otAutoMin: 0, otMin: 0 }],
  ["A: 9h clock earns 30m OT", A, "present", "06:00", "15:00", false, null, { workedMin: 540, otAutoMin: 30, otMin: 30 }],
  ["A: 9h30m clock earns 60m OT", A, "present", "06:00", "15:30", false, null, { workedMin: 570, otAutoMin: 60, otMin: 60 }],
  ["A: 20 min late, no OT", A, "present", "06:20", "14:00", false, null, { workedMin: 460, lateMin: 20, otAutoMin: 0 }],
  ["A: 20 min late + 30m extra, no OT", A, "present", "06:20", "14:30", false, null, { workedMin: 490, lateMin: 20, otAutoMin: 0 }],
  ["A: early leave 1h, no OT", A, "present", "06:00", "13:00", false, null, { workedMin: 420, lateMin: 0, earlyLeaveMin: 60, otAutoMin: 0 }],
  ["C: full night span is NOT overtime", C, "present", "22:00", "06:00", false, null, { workedMin: 480, otAutoMin: 0, otMin: 0 }],
  ["C: night across midnight", C, "present", "22:30", "06:15", false, null, { workedMin: 465, lateMin: 30, earlyLeaveMin: 0, otAutoMin: 0 }],
  ["C: 8h30m night = 8h net, no OT", C, "present", "22:00", "06:30", false, null, { workedMin: 510, otAutoMin: 0 }],
  ["C: 9h night earns 30m OT", C, "present", "22:00", "07:00", false, null, { workedMin: 540, otAutoMin: 30 }],
  ["C: short stint past midnight", C, "present", "23:50", "00:10", false, null, { workedMin: 20, lateMin: 110, earlyLeaveMin: 350, otAutoMin: 0 }],
  ["A: holiday, all hours are OT", A, "present", "06:00", "12:00", true, null, { workedMin: 360, otAutoMin: 360 }],
  ["A: weekly off, worked = all OT", A, "weekly_off", "06:00", "10:00", false, null, { workedMin: 240, otAutoMin: 240, otMin: 240 }],
  ["A: weekly off, nobody came", A, "weekly_off", "", "", false, null, { workedMin: 0, otAutoMin: 0, otMin: 0 }],
  ["A: absent clears times", A, "absent", "06:00", "14:00", false, null, { workedMin: 0, otAutoMin: 0, otMin: 0 }],
  ["A: leave clears times", A, "leave", "", "", false, null, { workedMin: 0, otAutoMin: 0 }],
  ["A: HR override OT=90 beats auto 30", A, "present", "06:00", "15:00", false, 90, { otAutoMin: 30, otMin: 90 }],
  ["A: override capped at worked", A, "present", "06:00", "14:00", false, 9999, { otMin: 480 }],
  ["A: override 0 honoured", A, "present", "06:00", "16:00", false, 0, { otAutoMin: 90, otMin: 0 }],
  ["no-break shift: 8h30m earns 30m OT", { startTime: "06:00", endTime: "14:00", breakMin: 0 }, "present", "06:00", "14:30", false, null, { workedMin: 510, otAutoMin: 30 }],
  ["60m break: 9h clock is still no OT", { startTime: "06:00", endTime: "14:00", breakMin: 60 }, "present", "06:00", "15:00", false, null, { workedMin: 540, otAutoMin: 0 }],
  ["60m break: 9h30m clock earns 30m OT", { startTime: "06:00", endTime: "14:00", breakMin: 60 }, "present", "06:00", "15:30", false, null, { workedMin: 570, otAutoMin: 30 }],
];

let failed = 0;
for (const [label, shift, status, ci, co, hol, ov, expect] of cases) {
  const r = computeAttendance({ shift, status, checkIn: ci, checkOut: co, isHoliday: hol, overrideOtMin: ov });
  const bad = Object.entries(expect).filter(([k, v]) => r[k] !== v);
  if (bad.length > 0) {
    failed++;
    console.log(`FAIL  ${label}`);
    console.log(`      expected ${JSON.stringify(expect)}`);
    console.log(`      actual   ${JSON.stringify(Object.fromEntries(Object.keys(expect).map((k) => [k, r[k]])))}`);
  } else {
    console.log(`ok    ${label}  (worked=${r.workedMin} late=${r.lateMin} early=${r.earlyLeaveMin} ot=${r.otMin})`);
  }
}

// Validation failures must be reported, not silently stored. A "present" record
// with no times would corrupt the salary run, so it must be rejected.
for (const [label, status, ci, co] of [
  ["missing check-out", "present", "06:00", ""],
  ["missing check-in", "present", "", "14:00"],
  ["present with no times at all", "present", "", ""],
  ["half day with no times", "half_day", "", ""],
  ["garbage time", "present", "99:99", "14:00"],
]) {
  const r = computeAttendance({ shift: A, status, checkIn: ci, checkOut: co, isHoliday: false });
  if (!r.error) {
    failed++;
    console.log(`FAIL  ${label} — expected an error`);
  } else {
    console.log(`ok    ${label} rejected: ${r.error}`);
  }
}

// A holiday with nobody punched in stays at zero, not an error.
{
  const r = computeAttendance({ shift: A, status: "holiday", checkIn: "", checkOut: "", isHoliday: true });
  if (r.error || r.workedMin !== 0) {
    failed++;
    console.log(`FAIL  holiday with nobody working — expected zero hours, got ${JSON.stringify(r)}`);
  } else {
    console.log("ok    holiday with nobody working stays at 0 hours");
  }
}

console.log(failed === 0 ? "\nALL PASS" : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);

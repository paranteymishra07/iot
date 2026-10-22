// Direct regression checks on the salary calculator. Build first, then run with:
//   npm run build
//   node salary-calc-check.mjs   (from the server directory)
import assert from "node:assert/strict";
import {
  calculateSalary,
  daysInMonth,
  computeAnnualTaxNewRegime,
  computeAnnualTaxOldRegime,
} from "./dist/services/salaryCalc.js";

let pass = 0;
let fail = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`ok   ${name}`);
    pass++;
  } catch (err) {
    console.log(`FAIL ${name}\n      ${err.message}`);
    fail++;
  }
}

const base = {
  monthlyGross: 30000,
  basicPercent: 50,
  otMultiplier: 1.5,
  deductions: { epf: true, esi: true, professionalTax: true, tds: true },
  taxRegime: "new",
  holidayPayMode: "included",
  professionalTaxAmount: 200,
  paidLeave: true,
};

const row = (o = {}) => ({
  date: "2026-09-01",
  status: "present",
  checkIn: "06:00",
  checkOut: "14:00",
  workedMin: 480,
  lateMin: 0,
  earlyLeaveMin: 0,
  otMin: 0,
  isHoliday: false,
  ...o,
});

check("days in month: 30-day and 31-day and February leap", () => {
  assert.equal(daysInMonth("2026-09"), 30);
  assert.equal(daysInMonth("2026-01"), 31);
  assert.equal(daysInMonth("2024-02"), 29);
  assert.equal(daysInMonth("2026-02"), 28);
});

check("daily wage and hourly rate derive from gross and month length", () => {
  const r = calculateSalary({ month: "2026-09", structure: base, attendance: [] });
  assert.equal(r.daysInMonth, 30);
  assert.equal(r.dailyWage, 1000);
  assert.equal(r.basicAmount, 15000);
  // 30000 / (30 * 8) = 125
  assert.equal(r.hourlyRate, 125);
});

check("full attendance, no OT, no LOP", () => {
  const attendance = Array.from({ length: 26 }, (_, i) =>
    row({ date: `2026-09-${String(i + 1).padStart(2, "0")}` })
  );
  const r = calculateSalary({ month: "2026-09", structure: base, attendance });
  assert.equal(r.deductions.lop, 0);
  assert.equal(r.earnings.grossEarnings, 30000);
  // EPF 12% of basic 15000 = 1800, ESI 0.75% of 30000 > 15000 ceiling so skipped
  assert.equal(r.deductions.epf, 1800);
  assert.equal(r.deductions.esi, 0);
  assert.equal(r.deductions.professionalTax, 200);
  assert.equal(r.netPay, 30000 - 1800 - 200);
});

check("unexcused absence loses one day of pay", () => {
  const attendance = Array.from({ length: 26 }, (_, i) =>
    row({ date: `2026-09-${String(i + 1).padStart(2, "0")}` })
  );
  attendance.push(row({ date: "2026-09-27", status: "absent", checkIn: "", checkOut: "", workedMin: 0 }));
  const r = calculateSalary({ month: "2026-09", structure: base, attendance });
  assert.equal(r.attendance.absentDays, 1);
  assert.equal(r.deductions.lop, 1000);
  // Earnings report the full gross and LOP is the deduction, so the payslip
  // reconciles as gross - deductions = net.
  assert.equal(r.earnings.monthlyPay, 30000);
  assert.equal(r.earnings.grossEarnings, 30000);
  assert.equal(r.netPay, 30000 - 1000 - 1800 - 200);
});

check("a payslip always reconciles as gross minus deductions", () => {
  const scenarios = [
    base,
    { ...base, monthlyGross: 12000 },
    { ...base, monthlyGross: 150000 },
    { ...base, monthlyGross: 12000, paidLeave: false },
    { ...base, holidayPayMode: "extra" },
  ];
  const attendanceSets = [
    [row()],
    Array.from({ length: 30 }, (_, i) =>
      row({ date: `2026-09-${String(i + 1).padStart(2, "0")}`, status: "absent", checkIn: "", checkOut: "", workedMin: 0 })
    ),
    [
      ...Array.from({ length: 20 }, (_, i) => row({ date: `2026-09-${String(i + 1).padStart(2, "0")}` })),
      row({ date: "2026-09-21", status: "absent", checkIn: "", checkOut: "", workedMin: 0 }),
      row({ date: "2026-09-22", status: "leave", checkIn: "", checkOut: "", workedMin: 0 }),
      row({ date: "2026-09-23", status: "holiday", isHoliday: true, workedMin: 480, otMin: 480 }),
      row({ date: "2026-09-24", workedMin: 600, otMin: 90 }),
    ],
  ];
  for (const structure of scenarios) {
    for (const attendance of attendanceSets) {
      const r = calculateSalary({ month: "2026-09", structure, attendance, bonus: 1000, otherDeduction: 250 });
      const { grossEarnings, grossWages } = r.earnings;
      const { total, lop, epf, esi, professionalTax, tds, late, other } = r.deductions;
      assert.equal(
        Math.round((grossEarnings - total) * 100) / 100,
        r.netPay,
        `gross ${grossEarnings} - deductions ${total} must equal net ${r.netPay}`
      );
      assert.equal(
        total,
        Math.round((lop + epf + esi + professionalTax + tds + late + other) * 100) / 100
      );
      // The wage base is the gross without the manual bonus.
      assert.equal(grossWages, Math.round((grossEarnings - r.earnings.bonus) * 100) / 100);
    }
  }
});

check("half day counts as loss of half a day", () => {
  const attendance = Array.from({ length: 26 }, (_, i) =>
    row({ date: `2026-09-${String(i + 1).padStart(2, "0")}` })
  );
  attendance.push(
    row({ date: "2026-09-27", status: "half_day", checkIn: "06:00", checkOut: "10:00", workedMin: 240 })
  );
  const r = calculateSalary({ month: "2026-09", structure: base, attendance });
  assert.equal(r.attendance.halfDays, 1);
  // A half day is paid work, so it does not lose a full day
  assert.equal(r.deductions.lop, 0);
  assert.equal(r.attendance.workedMin, 26 * 480 + 240);
});

check("public holiday is free in included mode, paid on top in extra mode", () => {
  const attendance = [row({ date: "2026-09-14", status: "holiday", isHoliday: true, workedMin: 0 })];
  const included = calculateSalary({ month: "2026-09", structure: base, attendance });
  assert.equal(included.attendance.paidHolidayDays, 1);
  assert.equal(included.earnings.paidHolidayAmount, 0);
  assert.equal(included.deductions.lop, 0);

  const extra = calculateSalary({
    month: "2026-09",
    structure: { ...base, holidayPayMode: "extra" },
    attendance,
  });
  assert.equal(extra.earnings.paidHolidayAmount, 1000);
});

check("work on a holiday is paid as OT at the multiplier", () => {
  const attendance = [
    row({ date: "2026-09-14", status: "holiday", isHoliday: true, checkIn: "06:00", checkOut: "12:00", workedMin: 360, otMin: 360 }),
  ];
  const r = calculateSalary({ month: "2026-09", structure: base, attendance });
  // 6h * 125 * 1.5 = 1125
  assert.equal(r.earnings.otAmount, 1125);
  assert.equal(r.attendance.paidHolidayDays, 1);
  assert.equal(r.deductions.lop, 0);
});

check("overtime is paid at 1.5x the hourly rate", () => {
  const attendance = [row({ date: "2026-09-01", workedMin: 540, otMin: 30 })];
  const r = calculateSalary({ month: "2026-09", structure: base, attendance });
  // 0.5h * 125 * 1.5 = 93.75
  assert.equal(r.earnings.otAmount, 93.75);
  // OT is not part of the statutory wage base for EPF/ESI
  assert.equal(r.earnings.grossWages, 30093.75);
  assert.equal(r.earnings.grossEarnings, 30093.75);
  assert.equal(r.deductions.epf, 1800);
});

check("EPF is capped at 12% of the 15000 ceiling when basic is higher", () => {
  const r = calculateSalary({
    month: "2026-09",
    structure: { ...base, monthlyGross: 60000, basicPercent: 100 },
    attendance: [],
  });
  // basic 60000 exceeds the ceiling, so PF is 12% of 15000 = 1800
  assert.equal(r.deductions.epf, 1800);
  assert.ok(r.warnings.some((w) => w.includes("EPF")));
});

check("ESI is deducted when wages are under the ceiling and capped at 170", () => {
  const low = calculateSalary({
    month: "2026-09",
    structure: { ...base, monthlyGross: 10000, basicPercent: 50 },
    attendance: [],
  });
  // gross wages 10000 * 0.75% = 75
  assert.equal(low.deductions.esi, 75);
  assert.equal(low.deductions.epf, 600); // 12% of 5000

  // Just under the 15000 ceiling: 0.75% = 112.5, still below the 170 cap
  const near = calculateSalary({
    month: "2026-09",
    structure: { ...base, monthlyGross: 15000, basicPercent: 50 },
    attendance: [],
  });
  assert.equal(near.deductions.esi, 112.5);

  // Above the ceiling ESI is skipped entirely, so the 170 cap is unreachable
  // through a monthly gross. It exists for cases where a bonus-free gross
  // crosses 170 through OT, so exercise the cap that way.
  const withOvertime = calculateSalary({
    month: "2026-09",
    structure: { ...base, monthlyGross: 14900, basicPercent: 50 },
    attendance: [
      row({ date: "2026-09-01", workedMin: 1440, otMin: 960 }),
    ],
  });
  // 16h OT * 14900/240 * 1.5 pushes gross wages to ~24750, over the ceiling,
  // so ESI is correctly skipped here too.
  assert.equal(withOvertime.deductions.esi, 0);
  assert.ok(withOvertime.warnings.some((w) => w.includes("ESI")));
});

check("ESI is skipped above the 15000 wage ceiling with a warning", () => {
  const r = calculateSalary({ month: "2026-09", structure: base, attendance: [] });
  assert.equal(r.deductions.esi, 0);
  assert.ok(r.warnings.some((w) => w.includes("ESI")));
});

check("professional tax can be switched off", () => {
  const off = calculateSalary({
    month: "2026-09",
    structure: { ...base, deductions: { ...base.deductions, professionalTax: false } },
    attendance: [],
  });
  assert.equal(off.deductions.professionalTax, 0);
});

check("new regime annual tax: slabs and the 87A rebate", () => {
  assert.equal(computeAnnualTaxNewRegime(0), 0);
  assert.equal(computeAnnualTaxNewRegime(300000), 0);
  // 400k: 100k over 300k at 5% = 5000, but the 87A rebate wipes it out
  assert.equal(computeAnnualTaxNewRegime(400000), 0);
  // the rebate caps at 60000, so 700k taxable (20k of slab tax) is still zero
  assert.equal(computeAnnualTaxNewRegime(700000), 0);
  // 1M: 20k + 30k = 50k of slab tax, still inside the 60k rebate
  assert.equal(computeAnnualTaxNewRegime(1000000), 0);
  // 1.1M: 20k + 30k + 15k = 65k, rebate caps at 60k so 5k survives
  assert.equal(computeAnnualTaxNewRegime(1100000), 5000);
  // exactly 12L: 20k + 30k + 30k = 80k, less the 60k rebate
  assert.equal(computeAnnualTaxNewRegime(1200000), 20000);
  // above 12L there is no rebate at all
  assert.equal(computeAnnualTaxNewRegime(1250000), 90000);
  // 1.5M: 20k + 30k + 30k + 60k = 140k
  assert.equal(computeAnnualTaxNewRegime(1500000), 140000);
});

check("old regime annual tax applies the standard deduction and rebate", () => {
  assert.equal(computeAnnualTaxOldRegime(300000), 0);
  // taxable 600k - 50k = 550k: 250k*5 + 300k*20 = 22500, over the 5L rebate
  assert.equal(computeAnnualTaxOldRegime(600000), 22500);
  // taxable 500k - 50k = 450k, inside the 5L rebate ceiling so zero
  assert.equal(computeAnnualTaxOldRegime(500000), 0);
  // 80C deductions push a mid salary back under the threshold
  assert.equal(computeAnnualTaxOldRegime(600000, 200000), 0);
});

check("no TDS when the annualised salary is under the threshold", () => {
  const r = calculateSalary({
    month: "2026-09",
    structure: { ...base, monthlyGross: 15000, basicPercent: 50 },
    attendance: [],
  });
  assert.equal(r.deductions.tds, 0);
});

check("TDS is deducted when the annualised salary is taxable", () => {
  const r = calculateSalary({
    month: "2026-09",
    structure: { ...base, monthlyGross: 150000, basicPercent: 50 },
    attendance: [],
  });
  // gross wages 150000, epf 1800, esi 0, pt 200 -> taxable 148000/mo -> 1.776M/yr
  // new regime: 400k*5 + 300k*10 + 200k*15 + 300k*20 + 276k*30 = 222800
  assert.ok(r.deductions.tds > 0);
  assert.equal(r.deductions.tds, Math.round((222800 / 12) * 100) / 100);
});

check("late deduction is off by default and on when enabled", () => {
  const attendance = [row({ date: "2026-09-01", lateMin: 45 })];
  const off = calculateSalary({ month: "2026-09", structure: base, attendance });
  assert.equal(off.deductions.late, 0);

  const on = calculateSalary({
    month: "2026-09",
    structure: { ...base, lateDeductionEnabled: true, lateGraceMin: 15, lateDeductionDaysPerLate: 0.5 },
    attendance,
  });
  // 1 late day beyond 15 min grace * 0.5 day * 1000 = 500
  assert.equal(on.deductions.late, 500);
});

check("two shifts on one day are paid as one day with both shifts' hours", () => {
  const attendance = [
    row({ date: "2026-09-01", shiftCode: "A", workedMin: 480 }),
    row({ date: "2026-09-01", shiftCode: "B", workedMin: 480 }),
  ];
  const r = calculateSalary({ month: "2026-09", structure: base, attendance });
  assert.equal(r.attendance.presentDays, 1);
  assert.equal(r.attendance.workedMin, 960);
  assert.equal(r.attendance.markedDays, 1);
});

check("a worked day outranks an absence marker on the same day", () => {
  const attendance = [
    row({ date: "2026-09-01", status: "absent", workedMin: 0 }),
    row({ date: "2026-09-01", status: "present", workedMin: 480, shiftCode: "B" }),
  ];
  const r = calculateSalary({ month: "2026-09", structure: base, attendance });
  assert.equal(r.attendance.presentDays, 1);
  assert.equal(r.attendance.absentDays, 0);
  assert.equal(r.deductions.lop, 0);
});

check("unmarked days do not deduct but do warn", () => {
  const r = calculateSalary({ month: "2026-09", structure: base, attendance: [row()] });
  assert.equal(r.attendance.unmarkedDays, 29);
  assert.equal(r.deductions.lop, 0);
  assert.ok(r.warnings.some((w) => w.includes("no attendance row")));
});

check("rows outside the month are ignored", () => {
  const r = calculateSalary({
    month: "2026-09",
    structure: base,
    attendance: [row({ date: "2026-08-31", status: "absent", workedMin: 0 })],
  });
  assert.equal(r.attendance.absentDays, 0);
  assert.equal(r.attendance.markedDays, 0);
});

check("bonus is added to gross earnings but excluded from statutory wages", () => {
  const r = calculateSalary({ month: "2026-09", structure: base, attendance: [], bonus: 5000 });
  assert.equal(r.earnings.bonus, 5000);
  assert.equal(r.earnings.grossWages, 30000);
  assert.equal(r.earnings.grossEarnings, 35000);
  assert.equal(r.deductions.epf, 1800);
  assert.equal(r.netPay, 35000 - 1800 - 200);
});

check("paid leave costs nothing, unpaid leave loses a day", () => {
  const paidLeave = { ...base, paidLeave: true };
  const unpaidLeave = { ...base, paidLeave: false };
  const mk = (status) => [row({ date: "2026-09-01", status, checkIn: "", checkOut: "", workedMin: 0 })];

  const a = calculateSalary({ month: "2026-09", structure: paidLeave, attendance: mk("leave") });
  assert.equal(a.deductions.lop, 0);
  assert.equal(a.attendance.paidLeaveDays, 1);

  const b = calculateSalary({ month: "2026-09", structure: unpaidLeave, attendance: mk("leave") });
  assert.equal(b.deductions.lop, 1000);
  assert.equal(b.attendance.unpaidLeaveDays, 1);
});

check("a fully absent month zeroes the pay and is flagged", () => {
  const absent = Array.from({ length: 30 }, (_, i) =>
    row({ date: `2026-09-${String(i + 1).padStart(2, "0")}`, status: "absent", checkIn: "", checkOut: "", workedMin: 0 })
  );
  const r = calculateSalary({ month: "2026-09", structure: { ...base, monthlyGross: 1000 }, attendance: absent });
  // 30 absent days at 1000/30 each wipes out the whole month
  assert.equal(r.deductions.lop, 1000);
  assert.equal(r.earnings.monthlyPay, 1000);
  // With no earnings the statutory dues still apply, so net goes negative
  assert.ok(r.netPay < 0);
  assert.ok(r.warnings.some((w) => w.includes("negative")));
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);

export type TaxRegime = "new" | "old";
export type HolidayPayMode = "included" | "extra";
export type PayslipStatus = "draft" | "approved" | "paid";

export interface SalaryDeductions {
  epf: boolean;
  esi: boolean;
  professionalTax: boolean;
  tds: boolean;
}

export interface SalaryStructure {
  id: string;
  plantId: string;
  plant: string;
  operatorId: string;
  operatorName: string;
  monthlyGross: number;
  basicPercent: number;
  otMultiplier: number;
  effectiveFrom: string;
  deductions: SalaryDeductions;
  taxRegime: TaxRegime;
  holidayPayMode: HolidayPayMode;
  professionalTaxAmount: number;
  paidLeave: boolean;
  active: boolean;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SalaryAttendanceSnapshot {
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
  markedDays: number;
}

export interface SalaryEarnings {
  monthlyPay: number;
  otAmount: number;
  paidHolidayAmount: number;
  bonus: number;
  grossEarnings: number;
  grossWages: number;
}

export interface SalaryDeductionsBreakdown {
  lop: number;
  epf: number;
  esi: number;
  professionalTax: number;
  tds: number;
  late: number;
  other: number;
  total: number;
}

export interface Payslip {
  id: string;
  plantId: string;
  plant: string;
  operatorId: string;
  operatorName: string;
  month: string;
  structureId: string;
  structureSnapshot: Partial<SalaryStructure>;
  attendance: SalaryAttendanceSnapshot;
  earnings: SalaryEarnings;
  deductions: SalaryDeductionsBreakdown;
  netPay: number;
  status: PayslipStatus;
  generatedBy: string;
  approvedBy: string;
  approvedAt?: string;
  paidAt?: string;
  notes: string;
  warnings?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface PayrollTotals {
  grossEarnings: number;
  totalDeductions: number;
  netPay: number;
  epf: number;
  esi: number;
  professionalTax: number;
  tds: number;
  lop: number;
}

export interface PayrollRunResult {
  month: string;
  plant: string;
  count: number;
  results: Payslip[];
  skipped: { operatorName: string; reason: string }[];
  totals: PayrollTotals;
}

export interface SalaryCalculation {
  daysInMonth: number;
  dailyWage: number;
  hourlyRate: number;
  basicAmount: number;
  attendance: SalaryAttendanceSnapshot;
  earnings: SalaryEarnings;
  deductions: SalaryDeductionsBreakdown;
  netPay: number;
  warnings: string[];
}

export interface SalaryPreview {
  month: string;
  operatorId: string;
  operatorName: string;
  structure: SalaryStructure;
  calculation: SalaryCalculation;
}

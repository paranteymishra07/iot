import mongoose, { Schema, Document } from "mongoose";

export const PAYSLIP_STATUSES = ["draft", "approved", "paid"] as const;
export type PayslipStatus = (typeof PAYSLIP_STATUSES)[number];

// Everything a payslip needs is frozen onto the document at run time. A payslip
// is a payroll record: later attendance edits or salary revisions must not
// silently rewrite money that has already been approved or paid.
export interface IAttendanceSnapshot {
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

export interface IEarnings {
  monthlyPay: number;
  otAmount: number;
  paidHolidayAmount: number;
  bonus: number;
  grossEarnings: number; // what the employee earned
  grossWages: number; // statutory wage base for PF/ESI, excludes bonus
}

export interface IDeductionsBreakdown {
  lop: number;
  epf: number;
  esi: number;
  professionalTax: number;
  tds: number;
  late: number;
  other: number;
  total: number;
}

export interface IPayslip extends Document {
  id: string;
  plantId: mongoose.Types.ObjectId;
  plant: string; // denormalized
  operatorId: mongoose.Types.ObjectId;
  operatorName: string;
  month: string; // "YYYY-MM"
  structureId: mongoose.Types.ObjectId;
  structureSnapshot: Record<string, unknown>;
  attendance: IAttendanceSnapshot;
  earnings: IEarnings;
  deductions: IDeductionsBreakdown;
  netPay: number;
  warnings: string[];
  status: PayslipStatus;
  generatedBy: string;
  approvedBy: string;
  approvedAt?: Date;
  paidAt?: Date;
  notes: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const PayslipSchema = new Schema<IPayslip>(
  {
    plantId: { type: Schema.Types.ObjectId, ref: "Plant", required: true },
    plant: { type: String, default: "" },
    operatorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    operatorName: { type: String, default: "" },
    month: { type: String, required: true },
    structureId: { type: Schema.Types.ObjectId, ref: "SalaryStructure" },
    structureSnapshot: { type: Schema.Types.Mixed, default: {} },
    attendance: {
      presentDays: { type: Number, default: 0 },
      halfDays: { type: Number, default: 0 },
      absentDays: { type: Number, default: 0 },
      paidLeaveDays: { type: Number, default: 0 },
      unpaidLeaveDays: { type: Number, default: 0 },
      paidHolidayDays: { type: Number, default: 0 },
      weeklyOffDays: { type: Number, default: 0 },
      lateDays: { type: Number, default: 0 },
      lateMin: { type: Number, default: 0 },
      workedMin: { type: Number, default: 0 },
      otMin: { type: Number, default: 0 },
      unmarkedDays: { type: Number, default: 0 },
      markedDays: { type: Number, default: 0 },
    },
    earnings: {
      monthlyPay: { type: Number, default: 0 },
      otAmount: { type: Number, default: 0 },
      paidHolidayAmount: { type: Number, default: 0 },
      bonus: { type: Number, default: 0 },
      grossEarnings: { type: Number, default: 0 },
      grossWages: { type: Number, default: 0 },
    },
    deductions: {
      lop: { type: Number, default: 0 },
      epf: { type: Number, default: 0 },
      esi: { type: Number, default: 0 },
      professionalTax: { type: Number, default: 0 },
      tds: { type: Number, default: 0 },
      late: { type: Number, default: 0 },
      other: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },
    netPay: { type: Number, default: 0 },
    // Frozen at generation time so a later re-fetch still explains the figures.
    warnings: { type: [String], default: [] },
    status: { type: String, enum: PAYSLIP_STATUSES, default: "draft" },
    generatedBy: { type: String, default: "" },
    approvedBy: { type: String, default: "" },
    approvedAt: { type: Date },
    paidAt: { type: Date },
    notes: { type: String, default: "" },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// One payslip per operator per month. Re-running payroll replaces the draft, but
// an approved or paid month is never silently overwritten.
PayslipSchema.index({ operatorId: 1, month: 1 }, { unique: true });
PayslipSchema.index({ plantId: 1, month: 1 });
PayslipSchema.index({ plantId: 1, month: 1, status: 1 });

PayslipSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

export const Payslip = mongoose.model<IPayslip>("Payslip", PayslipSchema);

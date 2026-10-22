import mongoose, { Schema, Document } from "mongoose";

// Statutory deduction switches. Defaults follow a standard Indian plant
// establishment: EPF always, ESI only under the wage ceiling, professional tax
// per state slab, and TDS only once the annualised salary is taxable.
export interface IDeductions {
  epf: boolean;
  esi: boolean;
  professionalTax: boolean;
  tds: boolean;
}

export const TAX_REGIMES = ["new", "old"] as const;
export type TaxRegime = (typeof TAX_REGIMES)[number];

export const HOLIDAY_PAY_MODES = ["included", "extra"] as const;
export type HolidayPayMode = (typeof HOLIDAY_PAY_MODES)[number];

// Overtime is never a statutory "wage" for PF/ESI, so it is tracked apart from
// the basic and reported separately on the payslip.
export interface ISalaryStructure extends Document {
  id: string;
  plantId: mongoose.Types.ObjectId;
  plant: string; // denormalized
  operatorId: mongoose.Types.ObjectId;
  operatorName: string;
  monthlyGross: number; // fixed pay for the month, in INR
  basicPercent: number; // PF/ESI basic as a share of monthlyGross
  otMultiplier: number; // overtime paid at this multiple of the hourly rate
  effectiveFrom: string; // "YYYY-MM-DD", structure applies from this date
  deductions: IDeductions;
  taxRegime: TaxRegime;
  // "included" (default): monthlyGross already covers the calendar month, so a
  // paid holiday simply costs nothing. "extra": paid holidays are added on top.
  holidayPayMode: HolidayPayMode;
  professionalTaxAmount: number; // flat monthly slab, e.g. 200 in Maharashtra
  paidLeave: boolean; // is a `leave` day paid or does it become loss of pay
  active: boolean;
  notes: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const SalaryStructureSchema = new Schema<ISalaryStructure>(
  {
    plantId: { type: Schema.Types.ObjectId, ref: "Plant", required: true },
    plant: { type: String, default: "" },
    operatorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    operatorName: { type: String, default: "" },
    monthlyGross: { type: Number, required: true, min: 0 },
    basicPercent: { type: Number, default: 50, min: 0, max: 100 },
    otMultiplier: { type: Number, default: 1.5, min: 1 },
    effectiveFrom: { type: String, required: true },
    deductions: {
      epf: { type: Boolean, default: true },
      esi: { type: Boolean, default: true },
      professionalTax: { type: Boolean, default: true },
      tds: { type: Boolean, default: true },
    },
    taxRegime: { type: String, enum: TAX_REGIMES, default: "new" },
    holidayPayMode: { type: String, enum: HOLIDAY_PAY_MODES, default: "included" },
    professionalTaxAmount: { type: Number, default: 200, min: 0 },
    paidLeave: { type: Boolean, default: true },
    active: { type: Boolean, default: true },
    notes: { type: String, default: "" },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// A structure can be revised over time, so history is kept by effective date and
// the payroll run picks the newest one at or before the month being paid.
SalaryStructureSchema.index({ operatorId: 1, effectiveFrom: -1 });
SalaryStructureSchema.index({ plantId: 1, effectiveFrom: -1 });
SalaryStructureSchema.index(
  { operatorId: 1, effectiveFrom: 1 },
  { unique: true }
);

SalaryStructureSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

export const SalaryStructure = mongoose.model<ISalaryStructure>(
  "SalaryStructure",
  SalaryStructureSchema
);

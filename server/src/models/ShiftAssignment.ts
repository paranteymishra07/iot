import mongoose, { Schema, Document } from "mongoose";
import { ref, refId } from "./ref.js";

export type RosterStatus = "planned" | "confirmed" | "completed";

export interface IShiftAssignment extends Document {
  id: string;
  plantId: string;
  plant: string; // denormalized plant name, same convention as ProductionLog
  shiftId: string;
  shiftName: string;
  operatorId: string;
  operatorName: string;
  date: string; // "YYYY-MM-DD"
  status: RosterStatus;
  notes: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const ShiftAssignmentSchema = new Schema<IShiftAssignment>(
  {
    plantId: ref("Plant", { required: true }),
    plant: { type: String, default: "" },
    shiftId: ref("Shift", { required: true }),
    shiftName: { type: String, default: "" },
    operatorId: ref("User", { required: true }),
    operatorName: { type: String, default: "" },
    date: { type: String, required: true },
    status: { type: String, enum: ["planned", "confirmed", "completed"], default: "planned" },
    notes: { type: String, default: "" },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

ShiftAssignmentSchema.index({ plantId: 1, shiftId: 1, operatorId: 1, date: 1 }, { unique: true });
ShiftAssignmentSchema.index({ plantId: 1, date: 1 });
ShiftAssignmentSchema.index({ operatorId: 1, date: 1 });

ShiftAssignmentSchema.virtual("id").get(function (this: IShiftAssignment) {
  return this._id.toHexString();
});

ShiftAssignmentSchema.virtual("plantIdStr").get(function (this: IShiftAssignment) {
  return refId(this.plantId);
});

ShiftAssignmentSchema.virtual("shiftIdStr").get(function (this: IShiftAssignment) {
  return refId(this.shiftId);
});

ShiftAssignmentSchema.virtual("operatorIdStr").get(function (this: IShiftAssignment) {
  return refId(this.operatorId);
});

export const ShiftAssignment = mongoose.model<IShiftAssignment>("ShiftAssignment", ShiftAssignmentSchema);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(value: unknown): boolean {
  return typeof value === "string" && DATE_RE.test(value) && !Number.isNaN(new Date(value).getTime());
}

// Roster dates are calendar days, so walk them in local time rather than UTC —
// toISOString() would shift the day for plants east of Greenwich.
function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function eachDate(from: string, to: string, maxDays = 62): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  while (cursor <= end && dates.length < maxDays) {
    dates.push(ymd(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

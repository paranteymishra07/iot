import mongoose, { Schema, Document } from "mongoose";
import { ref, refId } from "./ref.js";

export interface IShift extends Document {
  id: string;
  plantId: string;
  name: string;
  code: string;
  startTime: string; // "HH:MM" 24h
  endTime: string; // "HH:MM" 24h
  breakMin: number;
  order: number;
  active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const ShiftSchema = new Schema<IShift>(
  {
    plantId: ref("Plant", { required: true }),
    name: { type: String, required: true },
    code: { type: String, required: true, trim: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    breakMin: { type: Number, default: 0, min: 0 },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

ShiftSchema.index({ plantId: 1, code: 1 }, { unique: true });
ShiftSchema.index({ plantId: 1, order: 1 });

ShiftSchema.virtual("id").get(function (this: IShift) {
  return this._id.toHexString();
});

ShiftSchema.virtual("plantIdStr").get(function (this: IShift) {
  return refId(this.plantId);
});

export const Shift = mongoose.model<IShift>("Shift", ShiftSchema);

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(value: unknown): boolean {
  return typeof value === "string" && TIME_RE.test(value);
}

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function crossesMidnight(startTime: string, endTime: string): boolean {
  return toMinutes(endTime) <= toMinutes(startTime);
}

export function durationMin(startTime: string, endTime: string, breakMin = 0): number {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  const span = end > start ? end - start : 24 * 60 - start + end;
  return Math.max(0, span - breakMin);
}

export const DEFAULT_SHIFT_TEMPLATES = [
  { code: "A", name: "Shift A (Morning)", startTime: "06:00", endTime: "14:00", breakMin: 30 },
  { code: "B", name: "Shift B (Afternoon)", startTime: "14:00", endTime: "22:00", breakMin: 30 },
  { code: "C", name: "Shift C (Night)", startTime: "22:00", endTime: "06:00", breakMin: 30 },
];

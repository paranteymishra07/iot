import mongoose, { Schema, Document } from "mongoose";
import { ref, refId } from "./ref.js";

export const HOLIDAY_TYPES = ["public", "restricted", "company"] as const;
export type HolidayType = (typeof HOLIDAY_TYPES)[number];

export interface IHoliday extends Document {
  id: string;
  plantId: string;
  plant: string; // denormalized
  date: string; // "YYYY-MM-DD"
  name: string; // "Diwali", "Company Annual Day"
  type: HolidayType;
  notes: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const HolidaySchema = new Schema<IHoliday>(
  {
    plantId: ref("Plant", { required: true }),
    plant: { type: String, default: "" },
    date: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: HOLIDAY_TYPES, default: "public" },
    notes: { type: String, default: "" },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// A plant can only declare one holiday per calendar day.
HolidaySchema.index({ plantId: 1, date: 1 }, { unique: true });
HolidaySchema.index({ plantId: 1, date: 1 });

HolidaySchema.virtual("id").get(function (this: IHoliday) {
  return this._id.toHexString();
});

HolidaySchema.virtual("plantIdStr").get(function (this: IHoliday) {
  return refId(this.plantId);
});

export const Holiday = mongoose.model<IHoliday>("Holiday", HolidaySchema);

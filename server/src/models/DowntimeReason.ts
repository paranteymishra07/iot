import mongoose, { Schema, Document } from "mongoose";

export interface IDowntimeReason extends Document {
  id: string;
  label: string;
  category: string;
  active: boolean;
}

const DowntimeReasonSchema = new Schema<IDowntimeReason>(
  {
    label: { type: String, required: true, unique: true },
    category: { type: String, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

DowntimeReasonSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

export const DowntimeReason = mongoose.model<IDowntimeReason>("DowntimeReason", DowntimeReasonSchema);

export const DEFAULT_DOWNTIME_REASONS = [
  { label: "No Operator", category: "Operator" },
  { label: "No Material", category: "Material" },
  { label: "Preventive Maintenance", category: "Maintenance" },
  { label: "Training", category: "Operator" },
  { label: "Machine Cleaning", category: "Maintenance" },
  { label: "Monthly Inventory", category: "Other" },
  { label: "No Tool", category: "Tooling" },
  { label: "NPD", category: "Engineering" },
  { label: "New Tool Trial", category: "Tooling" },
  { label: "New Part Setting", category: "Setup" },
  { label: "Setting Time", category: "Setup" },
  { label: "Quality Hold", category: "Quality" },
  { label: "Machine Breakdown", category: "Breakdown" },
  { label: "Tool Change", category: "Tooling" },
  { label: "Tool Breakage", category: "Tooling" },
  { label: "Corner Change", category: "Tooling" },
  { label: "Low Air Pressure", category: "Utility" },
  { label: "Fixture Breakdown", category: "Breakdown" },
];

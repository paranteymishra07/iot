import mongoose, { Schema, Document } from "mongoose";

export interface IAlarm extends Document {
  id: string;
  machineId: string;
  machineName: string;
  plant: string;
  line: string;
  severity: "critical" | "warning" | "info";
  status: "active" | "acknowledged" | "resolved";
  title: string;
  message: string;
  value: string;
  threshold: string;
  timestamp: Date;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
}

const AlarmSchema = new Schema<IAlarm>(
  {
    machineId: { type: String, required: true },
    machineName: { type: String, required: true },
    plant: { type: String, required: true },
    line: { type: String, required: true },
    severity: { type: String, enum: ["critical", "warning", "info"], required: true },
    status: { type: String, enum: ["active", "acknowledged", "resolved"], default: "active" },
    title: { type: String, required: true },
    message: { type: String, required: true },
    value: { type: String, required: true },
    threshold: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    acknowledgedBy: { type: String },
    acknowledgedAt: { type: Date },
    resolvedAt: { type: Date },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

AlarmSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

export const Alarm = mongoose.model<IAlarm>("Alarm", AlarmSchema);

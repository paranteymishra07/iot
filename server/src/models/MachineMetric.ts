import mongoose, { Schema, Document } from "mongoose";

export type MetricStatus = "running" | "idle" | "down" | "maintenance";

export interface IMachineMetric extends Document {
  machineId: string;
  machineName: string;
  plant: string;
  line: string;
  status: MetricStatus;
  manualStatus: boolean;
  plannedTimeMin: number;
  downtimeMin: number;
  idealCycleTimeSec: number;
  totalUnits: number;
  goodUnits: number;
  sensor: {
    temperature: number;
    vibration: number;
    load: number;
    speed: number;
    power: number;
    pressure?: number;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export interface OEEBreakdown {
  oee: number;
  availability: number;
  performance: number;
  quality: number;
}

export function computeOEE(m: Pick<IMachineMetric, "plannedTimeMin" | "downtimeMin" | "idealCycleTimeSec" | "totalUnits" | "goodUnits">): OEEBreakdown {
  const plannedTimeMin = Math.max(0, m.plannedTimeMin || 0);
  const operatingTimeMin = Math.max(0, plannedTimeMin - (m.downtimeMin || 0));

  const availability = plannedTimeMin > 0 ? (operatingTimeMin / plannedTimeMin) * 100 : 0;
  const operatingTimeSec = operatingTimeMin * 60;

  const idealTimeSec = m.idealCycleTimeSec > 0 ? (m.totalUnits || 0) * m.idealCycleTimeSec : 0;
  const performance = operatingTimeSec > 0 ? (idealTimeSec / operatingTimeSec) * 100 : 0;

  const quality = m.totalUnits > 0 ? ((m.goodUnits || 0) / m.totalUnits) * 100 : 0;

  const clamp = (v: number) => Math.min(100, Math.max(0, v));
  const a = clamp(availability);
  const p = clamp(performance);
  const q = clamp(quality);
  const oee = (a / 100) * (p / 100) * (q / 100) * 100;

  return { oee, availability: a, performance: p, quality: q };
}

export interface MachineMetricDoc extends IMachineMetric {
  oee: OEEBreakdown;
}

const MachineMetricSchema = new Schema<IMachineMetric>(
  {
    machineId: { type: String, required: true, unique: true },
    machineName: { type: String, required: true },
    plant: { type: String, required: true },
    line: { type: String, required: true },
    status: { type: String, enum: ["running", "idle", "down", "maintenance"], default: "idle" },
    manualStatus: { type: Boolean, default: false },
    plannedTimeMin: { type: Number, required: true },
    downtimeMin: { type: Number, required: true },
    idealCycleTimeSec: { type: Number, required: true },
    totalUnits: { type: Number, required: true },
    goodUnits: { type: Number, required: true },
    sensor: {
      temperature: { type: Number, default: 0 },
      vibration: { type: Number, default: 0 },
      load: { type: Number, default: 0 },
      speed: { type: Number, default: 0 },
      power: { type: Number, default: 0 },
      pressure: { type: Number },
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

MachineMetricSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

export const MachineMetric = mongoose.model<IMachineMetric>("MachineMetric", MachineMetricSchema);

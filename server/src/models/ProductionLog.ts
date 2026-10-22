import mongoose, { Schema, Document } from "mongoose";

export type LogStatus = "running" | "idle" | "down" | "maintenance";

export interface IProductionLog extends Document {
  id: string;
  machineId: string;
  machineName: string;
  operatorId: string;
  operatorName: string;
  plant: string;
  line: string;
  date: string;
  status: LogStatus;
  manualStatus: boolean;
  manualStatusAt: Date | null;
  dailyTarget: number;
  totalUnits: number;
  goodUnits: number;
  rejects: number;
  cycleTimeSec: number;
  cycleTimeThreshold: number;
  plannedTimeMin: number;
  downtimeMin: number;
  downtimeReasonId: string;
  downtimeReasonLabel: string;
  lastProducedAt: Date;
  updatedAt?: Date;
  createdAt?: Date;
}

export interface DayEfficiency {
  efficiency: number;
  availability: number;
  performance: number;
  quality: number;
  totalUnits: number;
  goodUnits: number;
  rejects: number;
  dailyTarget: number;
  downtimeMin: number;
}

const ProductionLogSchema = new Schema<IProductionLog>(
  {
    machineId: { type: String, required: true },
    machineName: { type: String, default: "" },
    operatorId: { type: String, required: true },
    operatorName: { type: String, default: "" },
    plant: { type: String, default: "" },
    line: { type: String, default: "" },
    date: { type: String, required: true },
    status: { type: String, enum: ["running", "idle", "down", "maintenance"], default: "running" },
    manualStatus: { type: Boolean, default: false },
    manualStatusAt: { type: Date, default: null },
    dailyTarget: { type: Number, default: 0 },
    totalUnits: { type: Number, default: 0 },
    goodUnits: { type: Number, default: 0 },
    rejects: { type: Number, default: 0 },
    cycleTimeSec: { type: Number, default: 0 },
    cycleTimeThreshold: { type: Number, default: 0 },
    plannedTimeMin: { type: Number, default: 0 },
    downtimeMin: { type: Number, default: 0 },
    downtimeReasonId: { type: String, default: "" },
    downtimeReasonLabel: { type: String, default: "" },
    lastProducedAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

ProductionLogSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

ProductionLogSchema.index({ machineId: 1, date: 1 }, { unique: true });

export function computeDayEfficiency(
  plannedTimeMin: number,
  downtimeMin: number,
  totalUnits: number,
  goodUnits: number,
  dailyTarget: number,
  cycleTimeSec: number,
  cycleTimeThreshold?: number
): Omit<DayEfficiency, "totalUnits" | "goodUnits" | "rejects" | "dailyTarget" | "downtimeMin"> {
  const planned = Math.max(0, plannedTimeMin || 0);
  const down = Math.max(0, downtimeMin || 0);
  const operating = Math.max(0, planned - down);

  const availability = planned > 0 ? (operating / planned) * 100 : 0;

  const operatingSec = operating * 60;
  const idealCycle = (cycleTimeThreshold && cycleTimeThreshold > 0 ? cycleTimeThreshold : cycleTimeSec) || cycleTimeSec;
  const idealTimeSec = idealCycle > 0 ? (totalUnits || 0) * idealCycle : 0;
  const performance = operatingSec > 0 ? (idealTimeSec / operatingSec) * 100 : 0;

  const quality = totalUnits > 0 ? ((goodUnits || 0) / totalUnits) * 100 : 0;

  const clamp = (v: number) => Math.min(100, Math.max(0, v));
  const a = clamp(availability);
  const p = clamp(performance);
  const q = clamp(quality);
  const oee = (a / 100) * (p / 100) * (q / 100) * 100;

  const targetEfficiency = dailyTarget > 0 ? ((totalUnits || 0) / dailyTarget) * 100 : 0;

  const efficiency = 0.7 * oee + 0.3 * clamp(targetEfficiency);

  return {
    efficiency,
    availability: a,
    performance: p,
    quality: q,
  };
}

export const ProductionLog = mongoose.model<IProductionLog>("ProductionLog", ProductionLogSchema);

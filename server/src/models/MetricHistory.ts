import mongoose, { Schema, Document } from "mongoose";

export interface IMetricHistory extends Document {
  machineId: string;
  machineName: string;
  plant: string;
  line: string;
  hour: Date;
  status?: string;
  oee?: number;
  availability?: number;
  performance?: number;
  quality?: number;
  totalUnits?: number;
  baseTotalUnits?: number;
  deltaUnits?: number;
  temperature?: number;
  power?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const MetricHistorySchema = new Schema<IMetricHistory>(
  {
    machineId: { type: String, required: true },
    machineName: { type: String, required: true },
    plant: { type: String, required: true },
    line: { type: String, required: true },
    hour: { type: Date, required: true },
    status: { type: String },
    oee: { type: Number, default: 0 },
    availability: { type: Number, default: 0 },
    performance: { type: Number, default: 0 },
    quality: { type: Number, default: 0 },
    totalUnits: { type: Number, default: 0 },
    baseTotalUnits: { type: Number, default: 0 },
    deltaUnits: { type: Number, default: 0 },
    temperature: { type: Number, default: 0 },
    power: { type: Number, default: 0 },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

MetricHistorySchema.index({ machineId: 1, hour: 1 }, { unique: true });

MetricHistorySchema.virtual("id").get(function () {
  return this._id.toHexString();
});

export const MetricHistory = mongoose.model<IMetricHistory>("MetricHistory", MetricHistorySchema);

export function hourBucket(d: Date = new Date()): Date {
  const t = new Date(d);
  t.setMinutes(0, 0, 0);
  return t;
}

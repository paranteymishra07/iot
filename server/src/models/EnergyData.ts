import mongoose, { Schema, Document } from "mongoose";

export interface IEnergyData extends Document {
  id: string;
  machineId: string;
  machineName: string;
  plant: string;
  line: string;
  todayKwh: number;
  costInr: number;
  peakDemand: number;
  kwhPerUnit: number;
}

const EnergyDataSchema = new Schema<IEnergyData>(
  {
    machineId: { type: String, required: true },
    machineName: { type: String, required: true },
    plant: { type: String, required: true },
    line: { type: String, required: true },
    todayKwh: { type: Number, required: true },
    costInr: { type: Number, required: true },
    peakDemand: { type: Number, required: true },
    kwhPerUnit: { type: Number, required: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

EnergyDataSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

export const EnergyData = mongoose.model<IEnergyData>("EnergyData", EnergyDataSchema);

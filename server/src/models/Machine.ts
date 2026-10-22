import mongoose, { Schema, Document } from "mongoose";
import { ref, refId } from "./ref.js";

// `Omit` is needed because a machine has a "model" field, which would otherwise
// collide with the `model()` method inherited from Mongoose's Document.
export interface IMachine extends Omit<Document, "model"> {
  id: string;
  lineId: string;
  name: string;
  type: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  ipAddress: string;
  status: "active" | "inactive";
  installDate: string;
  threshold: number; // target/ideal cycle time (sec) - fixed baseline for efficiency
  cycleTime: number; // nominal production cycle time (sec) - fixed for this machine
}

const MachineSchema = new Schema<IMachine>(
  {
    lineId: ref("Line", { required: true }),
    name: { type: String, required: true },
    type: { type: String, required: true },
    manufacturer: { type: String, required: true },
    model: { type: String, required: true },
    serialNumber: { type: String, required: true },
    ipAddress: { type: String, required: true },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    installDate: { type: String, required: true },
    threshold: { type: Number, default: 0, min: 0 },
    cycleTime: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

MachineSchema.virtual("id").get(function (this: IMachine) {
  return this._id.toHexString();
});

MachineSchema.virtual("lineIdStr").get(function (this: IMachine) {
  return refId(this.lineId);
});

export const Machine = mongoose.model<IMachine>("Machine", MachineSchema);

import mongoose, { Schema, Document } from "mongoose";
import { ref, refId } from "./ref.js";

export interface IPlant extends Document {
  id: string;
  companyId: string;
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  status: "active" | "inactive";
}

const PlantSchema = new Schema<IPlant>(
  {
    companyId: ref("Company", { required: true }),
    name: { type: String, required: true },
    code: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

PlantSchema.virtual("id").get(function (this: IPlant) {
  return this._id.toHexString();
});

PlantSchema.virtual("companyIdStr").get(function (this: IPlant) {
  return refId(this.companyId);
});

export const Plant = mongoose.model<IPlant>("Plant", PlantSchema);

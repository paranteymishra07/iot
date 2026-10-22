import mongoose, { Schema, Document } from "mongoose";
import { ref, refId } from "./ref.js";

export interface ILine extends Document {
  id: string;
  plantId: string;
  name: string;
  code: string;
  description: string;
  status: "active" | "inactive";
}

const LineSchema = new Schema<ILine>(
  {
    plantId: ref("Plant", { required: true }),
    name: { type: String, required: true },
    code: { type: String, required: true },
    description: { type: String, default: "" },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

LineSchema.virtual("id").get(function (this: ILine) {
  return this._id.toHexString();
});

LineSchema.virtual("plantIdStr").get(function (this: ILine) {
  return refId(this.plantId);
});

export const Line = mongoose.model<ILine>("Line", LineSchema);

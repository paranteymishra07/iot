import mongoose, { Schema, Document } from "mongoose";

export interface ICompany extends Document {
  id: string;
  name: string;
  code: string;
  address: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  status: "active" | "inactive";
}

const CompanySchema = new Schema<ICompany>(
  {
    name: { type: String, required: true, unique: true },
    code: { type: String, required: true },
    address: { type: String, required: true },
    contactPerson: { type: String, required: true },
    contactEmail: { type: String, required: true },
    contactPhone: { type: String, required: true },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

CompanySchema.virtual("id").get(function () {
  return this._id.toHexString();
});

export const Company = mongoose.model<ICompany>("Company", CompanySchema);

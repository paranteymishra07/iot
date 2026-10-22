import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  id: string;
  name: string;
  email: string;
  password: string;
  role: string;
  company: string;
  plant: string;
  status: "active" | "inactive";
  lastLogin: string;
  assignedMachineIds: string[];
  assignedLine: string;
  dailyTarget: number;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, required: true },
    company: { type: String, required: true },
    plant: { type: String, required: true },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    lastLogin: { type: String, default: "Never" },
    assignedMachineIds: { type: [String], default: [] },
    assignedLine: { type: String, default: "" },
    dailyTarget: { type: Number, default: 0 },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

UserSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

export const User = mongoose.model<IUser>("User", UserSchema);

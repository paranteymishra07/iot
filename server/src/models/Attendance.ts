import mongoose, { Schema, Document } from "mongoose";
import { ref, refId } from "./ref.js";

export const ATTENDANCE_STATUSES = [
  "present",
  "absent",
  "half_day",
  "leave",
  "holiday",
  "weekly_off",
] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

// Statuses that mean the operator was not on the floor, so punch times are
// meaningless and get cleared on write.
export const NO_PUNCH_STATUSES: AttendanceStatus[] = ["absent", "leave", "holiday", "weekly_off"];

export interface IAttendance extends Document {
  id: string;
  plantId: string;
  plant: string; // denormalized, same convention as ShiftAssignment / ProductionLog
  shiftId: string;
  shiftName: string;
  shiftCode: string;
  operatorId: string;
  operatorName: string;
  date: string; // "YYYY-MM-DD"
  status: AttendanceStatus;
  checkIn: string; // "HH:MM" 24h, "" when not punched
  checkOut: string;
  workedMin: number; // derived: punch-out minus punch-in
  lateMin: number; // derived: minutes after shift start
  earlyLeaveMin: number; // derived: minutes before shift end
  otAutoMin: number; // derived overtime, kept for transparency
  otMin: number; // effective overtime = otOverrideMin when set, else otAutoMin
  otOverrideMin: number | null; // HR override, null when auto
  shiftStartTime: string;
  shiftEndTime: string;
  shiftDurationMin: number; // net of break
  isHoliday: boolean;
  holidayName: string;
  notes: string;
  markedBy: string; // HR user name
  createdAt?: Date;
  updatedAt?: Date;
}

const AttendanceSchema = new Schema<IAttendance>(
  {
    plantId: ref("Plant", { required: true }),
    plant: { type: String, default: "" },
    shiftId: ref("Shift", { required: true }),
    shiftName: { type: String, default: "" },
    shiftCode: { type: String, default: "" },
    operatorId: ref("User", { required: true }),
    operatorName: { type: String, default: "" },
    date: { type: String, required: true },
    status: { type: String, enum: ATTENDANCE_STATUSES, default: "present" },
    checkIn: { type: String, default: "" },
    checkOut: { type: String, default: "" },
    workedMin: { type: Number, default: 0 },
    lateMin: { type: Number, default: 0 },
    earlyLeaveMin: { type: Number, default: 0 },
    otAutoMin: { type: Number, default: 0 },
    otMin: { type: Number, default: 0 },
    otOverrideMin: { type: Number, default: null },
    shiftStartTime: { type: String, default: "" },
    shiftEndTime: { type: String, default: "" },
    shiftDurationMin: { type: Number, default: 0 },
    isHoliday: { type: Boolean, default: false },
    holidayName: { type: String, default: "" },
    notes: { type: String, default: "" },
    markedBy: { type: String, default: "" },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// One attendance record per operator per shift per day — the upsert key.
AttendanceSchema.index({ plantId: 1, shiftId: 1, operatorId: 1, date: 1 }, { unique: true });
AttendanceSchema.index({ plantId: 1, date: 1 });
AttendanceSchema.index({ operatorId: 1, date: 1 });
// Feeds the later salary run: one operator's whole month in a single query.
AttendanceSchema.index({ operatorId: 1, date: 1, status: 1 });

AttendanceSchema.virtual("id").get(function (this: IAttendance) {
  return this._id.toHexString();
});

// Written out explicitly rather than in a loop so the `this` typing matches the
// other models in this project.
AttendanceSchema.virtual("plantIdStr").get(function (this: IAttendance) {
  return refId(this.plantId);
});

AttendanceSchema.virtual("shiftIdStr").get(function (this: IAttendance) {
  return refId(this.shiftId);
});

AttendanceSchema.virtual("operatorIdStr").get(function (this: IAttendance) {
  return refId(this.operatorId);
});

export const Attendance = mongoose.model<IAttendance>("Attendance", AttendanceSchema);

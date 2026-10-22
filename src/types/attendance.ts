export type AttendanceStatus = "present" | "absent" | "half_day" | "leave" | "holiday" | "weekly_off";

export const ATTENDANCE_STATUS_OPTIONS: { value: AttendanceStatus; label: string; color: string }[] = [
  { value: "present", label: "Present", color: "text-status-running" },
  { value: "half_day", label: "Half Day", color: "text-brand-primary" },
  { value: "absent", label: "Absent", color: "text-status-down" },
  { value: "leave", label: "Leave", color: "text-status-idle" },
  { value: "holiday", label: "Holiday", color: "text-brand-accent" },
  { value: "weekly_off", label: "Weekly Off", color: "text-muted-foreground" },
];

export interface AttendanceRecord {
  id: string;
  plantId: string;
  plant: string;
  shiftId: string;
  shiftName: string;
  shiftCode: string;
  operatorId: string;
  operatorName: string;
  date: string;
  status: AttendanceStatus;
  checkIn: string;
  checkOut: string;
  workedMin: number;
  lateMin: number;
  earlyLeaveMin: number;
  otAutoMin: number;
  otMin: number;
  otOverrideMin: number | null;
  shiftStartTime: string;
  shiftEndTime: string;
  shiftDurationMin: number;
  isHoliday: boolean;
  holidayName: string;
  notes: string;
  markedBy: string;
  marked: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface DayShift {
  id: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMin: number;
}

export interface DayOperator {
  operatorId: string;
  operatorName: string;
  slots: AttendanceRecord[];
}

export interface AttendanceDay {
  date: string;
  plant: { id: string; name: string };
  isHoliday: boolean;
  holidayName: string;
  shifts: DayShift[];
  operators: DayOperator[];
  totals: {
    rostered: number;
    marked: number;
    present: number;
    absent: number;
    leave: number;
    halfDay: number;
    otMin: number;
    lateMin: number;
  };
}

export interface MarkAttendancePayload {
  plantId: string;
  shiftId: string;
  operatorId: string;
  date: string;
  status: AttendanceStatus;
  checkIn: string;
  checkOut: string;
  otOverrideMin: number | null;
  notes?: string;
  markedBy?: string;
}

export type HolidayType = "public" | "restricted" | "company";

export interface Holiday {
  id: string;
  plantId: string;
  plant: string;
  date: string;
  name: string;
  type: HolidayType;
  notes: string;
  createdAt?: string;
}

export const HOLIDAY_TYPE_OPTIONS: { value: HolidayType; label: string }[] = [
  { value: "public", label: "Public" },
  { value: "restricted", label: "Restricted" },
  { value: "company", label: "Company" },
];

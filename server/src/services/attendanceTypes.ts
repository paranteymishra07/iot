/**
 * Shared shape of an attendance row as far as payroll is concerned. Kept local
 * so the calculation service does not depend on the Mongoose model, which lets
 * the regression script exercise it directly.
 */
export interface AttendanceRecordLike {
  date: string;
  status: string;
  checkIn: string;
  checkOut: string;
  workedMin: number;
  lateMin: number;
  earlyLeaveMin: number;
  otMin: number;
  isHoliday: boolean;
  holidayName?: string;
  shiftCode?: string;
}

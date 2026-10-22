export type RosterStatus = "planned" | "confirmed" | "completed";

export interface Shift {
  id: string;
  plantId: string;
  name: string;
  code: string;
  startTime: string; // "HH:MM" 24h
  endTime: string; // "HH:MM" 24h
  breakMin: number;
  order: number;
  active: boolean;
  durationMin: number;
  crossesMidnight: boolean;
  createdAt?: string;
}

export interface ShiftAssignment {
  id: string;
  plantId: string;
  plant: string;
  shiftId: string;
  shiftName: string;
  operatorId: string;
  operatorName: string;
  date: string; // "YYYY-MM-DD"
  status: RosterStatus;
  notes: string;
  createdAt?: string;
}

export interface RosterRange {
  from: string;
  to: string;
  assignments: ShiftAssignment[];
}

export type ShiftDraft = Pick<Shift, "plantId" | "name" | "code" | "startTime" | "endTime" | "breakMin" | "active"> & {
  order?: number;
};

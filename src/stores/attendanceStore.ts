import { create } from "zustand";
import { api } from "@/lib/api";
import type { AttendanceDay, AttendanceRecord, Holiday, HolidayType, MarkAttendancePayload } from "@/types/attendance";

interface AttendanceState {
  day: AttendanceDay | null;
  holidays: Holiday[];
  loading: boolean;
  saving: Record<string, boolean>;
  fetchDay: (plantId: string, date: string) => Promise<void>;
  fetchHolidays: (plantId: string, year?: number) => Promise<void>;
  mark: (payload: MarkAttendancePayload) => Promise<AttendanceRecord>;
  markBulk: (payload: {
    plantId: string;
    shiftId: string;
    date: string;
    status: string;
    checkIn?: string;
    checkOut?: string;
    operatorIds: string[];
    markedBy?: string;
  }) => Promise<{ marked: number; failed: { operatorId: string; error?: string }[] }>;
  clear: (id: string) => Promise<void>;
  createHoliday: (payload: { plantId: string; date: string; name: string; type: HolidayType; notes?: string }) => Promise<void>;
  updateHoliday: (id: string, updates: { date?: string; name?: string; type?: HolidayType; notes?: string }) => Promise<void>;
  deleteHoliday: (id: string) => Promise<void>;
}

const slotKey = (plantId: string, shiftId: string, operatorId: string, date: string) =>
  `${plantId}|${shiftId}|${operatorId}|${date}`;

export const useAttendanceStore = create<AttendanceState>((set) => ({
  day: null,
  holidays: [],
  loading: false,
  saving: {},

  fetchDay: async (plantId, date) => {
    if (!plantId) return;
    set({ loading: true });
    try {
      const res = await api.get<AttendanceDay>("/attendance/day", { params: { plantId, date } });
      set({ day: res.data, loading: false });
    } catch (err) {
      set({ day: null, loading: false });
      throw err;
    }
  },

  fetchHolidays: async (plantId, year) => {
    if (!plantId) return;
    const params: Record<string, string> = { plantId };
    if (year) params.year = String(year);
    const res = await api.get<Holiday[]>("/holidays", { params });
    set({ holidays: res.data });
  },

  mark: async (payload) => {
    const key = slotKey(payload.plantId, payload.shiftId, payload.operatorId, payload.date);
    set((s) => ({ saving: { ...s.saving, [key]: true } }));
    try {
      const res = await api.post<AttendanceRecord>("/attendance", payload);
      set((s) => {
        if (!s.day) return { saving: { ...s.saving, [key]: false } };
        const operators = s.day.operators.map((op) => {
          if (op.operatorId !== payload.operatorId) return op;
          const slots = op.slots.map((slot) =>
            slot.shiftId === payload.shiftId && slot.date === payload.date
              ? { ...slot, ...res.data, marked: true }
              : slot
          );
          return { ...op, slots };
        });
        const slots = operators.flatMap((o) => o.slots);
        return {
          day: {
            ...s.day,
            operators,
            totals: {
              ...s.day.totals,
              marked: slots.filter((sl) => sl.marked).length,
              present: slots.filter((sl) => sl.status === "present").length,
              absent: slots.filter((sl) => sl.status === "absent").length,
              leave: slots.filter((sl) => sl.status === "leave").length,
              halfDay: slots.filter((sl) => sl.status === "half_day").length,
              otMin: slots.reduce((sum, sl) => sum + sl.otMin, 0),
              lateMin: slots.reduce((sum, sl) => sum + sl.lateMin, 0),
            },
          },
          saving: { ...s.saving, [key]: false },
        };
      });
      return res.data;
    } catch (err) {
      set((s) => ({ saving: { ...s.saving, [key]: false } }));
      throw err;
    }
  },

  markBulk: async (payload) => {
    const res = await api.post<{ marked: number; failed: { operatorId: string; error?: string }[] }>(
      "/attendance/bulk",
      payload
    );
    return res.data;
  },

  clear: async (id) => {
    await api.delete(`/attendance/${id}`);
  },

  createHoliday: async (payload) => {
    await api.post("/holidays", payload);
  },

  updateHoliday: async (id, updates) => {
    await api.put(`/holidays/${id}`, updates);
  },

  deleteHoliday: async (id) => {
    await api.delete(`/holidays/${id}`);
  },
}));

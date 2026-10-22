import { create } from "zustand";
import { api } from "@/lib/api";
import type { Shift, ShiftAssignment, ShiftDraft, RosterStatus } from "@/types/shift";

interface ShiftState {
  shifts: Shift[];
  assignments: ShiftAssignment[];
  loaded: boolean;
  fetchShifts: (plantId?: string, all?: boolean) => Promise<void>;
  fetchRoster: (plantId: string | undefined, from: string, to: string) => Promise<void>;
  createShift: (draft: ShiftDraft) => Promise<void>;
  updateShift: (id: string, updates: Partial<ShiftDraft>) => Promise<void>;
  deleteShift: (id: string) => Promise<void>;
  assignOperator: (payload: { plantId: string; shiftId: string; operatorId: string; date: string }) => Promise<void>;
  updateAssignment: (id: string, updates: { status?: RosterStatus; notes?: string }) => Promise<void>;
  unassignOperator: (id: string) => Promise<void>;
  bulkAssign: (payload: {
    plantId: string;
    shiftId: string;
    operatorIds: string[];
    from: string;
    to: string;
    mode: "add" | "remove";
  }) => Promise<number>;
}

export const useShiftStore = create<ShiftState>((set) => ({
  shifts: [],
  assignments: [],
  loaded: false,

  fetchShifts: async (plantId, all = true) => {
    const params: Record<string, string> = { all: all ? "1" : "0" };
    if (plantId) params.plantId = plantId;
    const res = await api.get<Shift[]>("/shifts", { params });
    set({ shifts: res.data, loaded: true });
  },

  fetchRoster: async (plantId, from, to) => {
    const params: Record<string, string> = { from, to };
    if (plantId) params.plantId = plantId;
    const res = await api.get<{ from: string; to: string; assignments: ShiftAssignment[] }>("/shifts/roster", { params });
    set({ assignments: res.data.assignments });
  },

  createShift: async (draft) => {
    const res = await api.post<Shift>("/shifts", draft);
    set((s) => ({ shifts: [...s.shifts, res.data] }));
  },

  updateShift: async (id, updates) => {
    const res = await api.put<Shift>(`/shifts/${id}`, updates);
    set((s) => ({ shifts: s.shifts.map((sh) => (sh.id === id ? res.data : sh)) }));
  },

  deleteShift: async (id) => {
    await api.delete(`/shifts/${id}`);
    set((s) => ({ shifts: s.shifts.filter((sh) => sh.id !== id) }));
  },

  assignOperator: async (payload) => {
    const res = await api.post<ShiftAssignment>("/shifts/roster", payload);
    set((s) => {
      const rest = s.assignments.filter((a) => a.id !== res.data.id);
      return { assignments: [...rest, res.data].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)) };
    });
  },

  updateAssignment: async (id, updates) => {
    const res = await api.put<ShiftAssignment>(`/shifts/roster/${id}`, updates);
    set((s) => ({ assignments: s.assignments.map((a) => (a.id === id ? res.data : a)) }));
  },

  unassignOperator: async (id) => {
    await api.delete(`/shifts/roster/${id}`);
    set((s) => ({ assignments: s.assignments.filter((a) => a.id !== id) }));
  },

  bulkAssign: async (payload) => {
    const res = await api.post<{ mode: string; count: number }>("/shifts/roster/bulk", payload);
    return res.data.count;
  },
}));

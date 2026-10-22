import { create } from "zustand";
import { api } from "@/lib/api";
import type { Alarm } from "@/types/alarm";

interface AlarmState {
  alarms: Alarm[];
  loaded: boolean;
  fetchAlarms: () => Promise<void>;
  acknowledgeAlarm: (id: string, by: string) => Promise<void>;
  resolveAlarm: (id: string) => Promise<void>;
  activeCount: () => number;
}

export const useAlarmStore = create<AlarmState>((set, get) => ({
  alarms: [],
  loaded: false,

  fetchAlarms: async () => {
    const res = await api.get<Alarm[]>("/alarms");
    set({ alarms: res.data, loaded: true });
  },

  acknowledgeAlarm: async (id, by) => {
    const res = await api.put<Alarm>(`/alarms/${id}`, {
      status: "acknowledged",
      acknowledgedBy: by,
      acknowledgedAt: new Date().toISOString(),
    });
    set((state) => ({
      alarms: state.alarms.map((a) => (a.id === id ? res.data : a)),
    }));
  },

  resolveAlarm: async (id) => {
    const res = await api.put<Alarm>(`/alarms/${id}`, {
      status: "resolved",
      resolvedAt: new Date().toISOString(),
    });
    set((state) => ({
      alarms: state.alarms.map((a) => (a.id === id ? res.data : a)),
    }));
  },

  activeCount: () => get().alarms.filter((a) => a.status === "active").length,
}));

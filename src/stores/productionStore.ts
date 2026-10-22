import { create } from "zustand";
import { api } from "@/lib/api";
import type { OperatorDashboard, DayEfficiencySummary, DowntimeReason, ProductionLog } from "@/types/production";

interface ProductionState {
  dashboard: OperatorDashboard | null;
  reasons: DowntimeReason[];
  dailySummary: DayEfficiencySummary | null;
  loaded: boolean;
  fetchDashboard: (operatorId: string) => Promise<void>;
  fetchDailySummary: (operatorId: string, date?: string) => Promise<void>;
  fetchReasons: () => Promise<void>;
  logProduction: (payload: Partial<ProductionLog> & { machineId: string; operatorId: string }) => Promise<ProductionLog>;
  setStatus: (machineId: string, status: ProductionLog["status"], downtimeReasonId?: string, downtimeReasonLabel?: string) => Promise<ProductionLog>;
}

export const useProductionStore = create<ProductionState>((set) => ({
  dashboard: null,
  reasons: [],
  dailySummary: null,
  loaded: false,

  fetchDashboard: async (operatorId) => {
    const res = await api.get<OperatorDashboard>(`/production/dashboard/${operatorId}`);
    set({ dashboard: res.data, loaded: true });
  },

  fetchDailySummary: async (operatorId, date) => {
    const res = await api.get<DayEfficiencySummary>(`/production/daily/${operatorId}`, { params: { date } });
    set({ dailySummary: res.data });
  },

  fetchReasons: async () => {
    const res = await api.get<DowntimeReason[]>("/downtime-reasons");
    set({ reasons: res.data });
  },

  logProduction: async (payload) => {
    const res = await api.post<ProductionLog>("/production/log", payload);
    return res.data;
  },

  setStatus: async (machineId, status, downtimeReasonId, downtimeReasonLabel) => {
    const res = await api.post<ProductionLog>("/production/status", { machineId, status, downtimeReasonId, downtimeReasonLabel });
    return res.data;
  },
}));

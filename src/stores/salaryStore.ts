import { create } from "zustand";
import { api } from "@/lib/api";
import type { Payslip, PayrollRunResult, SalaryPreview, SalaryStructure } from "@/types/salary";

interface SalaryState {
  structures: SalaryStructure[];
  payslips: Payslip[];
  loadedStructures: boolean;
  loadedPayslips: boolean;

  fetchStructures: (params?: { plantId?: string; operatorId?: string }) => Promise<void>;
  createStructure: (payload: Record<string, unknown>) => Promise<SalaryStructure>;
  updateStructure: (id: string, payload: Record<string, unknown>) => Promise<void>;
  deleteStructure: (id: string) => Promise<void>;

  fetchPayslips: (params?: { plantId?: string; month?: string; status?: string }) => Promise<void>;
  runPayroll: (payload: Record<string, unknown>) => Promise<PayrollRunResult>;
  previewSalary: (payload: Record<string, unknown>) => Promise<SalaryPreview>;
  setPayslipStatus: (id: string, status: string, approvedBy?: string) => Promise<void>;
  deletePayslip: (id: string) => Promise<void>;
}

export const useSalaryStore = create<SalaryState>((set) => ({
  structures: [],
  payslips: [],
  loadedStructures: false,
  loadedPayslips: false,

  fetchStructures: async (params = {}) => {
    const res = await api.get<SalaryStructure[]>("/salary/structures", { params });
    set({ structures: res.data ?? [], loadedStructures: true });
  },

  createStructure: async (payload) => {
    const res = await api.post<SalaryStructure>("/salary/structures", payload);
    set((s) => ({ structures: [res.data, ...s.structures] }));
    return res.data;
  },

  updateStructure: async (id, payload) => {
    const res = await api.put<SalaryStructure>(`/salary/structures/${id}`, payload);
    set((s) => ({ structures: s.structures.map((x) => (x.id === id ? res.data : x)) }));
  },

  deleteStructure: async (id) => {
    await api.delete(`/salary/structures/${id}`);
    set((s) => ({ structures: s.structures.filter((x) => x.id !== id) }));
  },

  fetchPayslips: async (params = {}) => {
    const res = await api.get<Payslip[]>("/salary/payslips", { params });
    set({ payslips: res.data ?? [], loadedPayslips: true });
  },

  runPayroll: async (payload) => {
    const res = await api.post<PayrollRunResult>("/salary/run", payload);
    return res.data;
  },

  previewSalary: async (payload) => {
    const res = await api.post<SalaryPreview>("/salary/preview", payload);
    return res.data;
  },

  setPayslipStatus: async (id, status, approvedBy) => {
    const res = await api.put<Payslip>(`/salary/payslips/${id}/status`, { status, approvedBy });
    set((s) => ({ payslips: s.payslips.map((p) => (p.id === id ? res.data : p)) }));
  },

  deletePayslip: async (id) => {
    await api.delete(`/salary/payslips/${id}`);
    set((s) => ({ payslips: s.payslips.filter((p) => p.id !== id) }));
  },
}));

import { create } from "zustand";
import type { Machine } from "@/types/machine";
import { INITIAL_MACHINES } from "@/constants/mockData";

interface MachineState {
  machines: Machine[];
  updateMachine: (id: string, updates: Partial<Machine>) => void;
  getMachine: (id: string) => Machine | undefined;
}

export const useMachineStore = create<MachineState>((set, get) => ({
  machines: INITIAL_MACHINES,

  updateMachine: (id, updates) =>
    set((state) => ({
      machines: state.machines.map((m) =>
        m.id === id ? { ...m, ...updates, lastUpdate: new Date() } : m
      ),
    })),

  getMachine: (id) => get().machines.find((m) => m.id === id),
}));

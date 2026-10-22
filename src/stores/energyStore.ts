import { create } from "zustand";
import { api } from "@/lib/api";
import type { EnergyData } from "@/types/energy";

interface EnergyState {
  energyData: EnergyData[];
  loaded: boolean;
  fetchEnergy: () => Promise<void>;
}

export const useEnergyStore = create<EnergyState>((set) => ({
  energyData: [],
  loaded: false,

  fetchEnergy: async () => {
    const res = await api.get<EnergyData[]>("/energy");
    set({ energyData: res.data, loaded: true });
  },
}));

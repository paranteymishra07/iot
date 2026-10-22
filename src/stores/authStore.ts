import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api, setToken } from "@/lib/api";
import type { User } from "@/types/auth";

/** The login endpoint returns the raw user document plus a session token. */
interface LoginResponse {
  id: string;
  name: string;
  email: string;
  role: string;
  company: string;
  plant: string;
  token?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  selectedOEM: string;
  selectedPlant: string;
  selectedLine: string;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  setSelectedPlant: (plant: string) => void;
  setSelectedLine: (line: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
  user: null,
  isAuthenticated: false,
  selectedOEM: "ABC Manufacturing",
  selectedPlant: "Mumbai Plant",
  selectedLine: "All Lines",

  login: async (email, password) => {
    try {
      const res = await api.post<LoginResponse>("/auth/login", { email, password });
      const u = res.data;
      const mapped: User = {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role as User["role"],
        oem: u.company,
        plant: u.plant,
      };
      setToken(u.token ?? null);
      set({ user: mapped, isAuthenticated: true });
      return true;
    } catch {
      return false;
    }
  },

    logout: () => {
      setToken(null);
      set({ user: null, isAuthenticated: false });
    },
    setSelectedPlant: (plant) => set({ selectedPlant: plant }),
    setSelectedLine: (line) => set({ selectedLine: line }),
    }),
    {
      name: "bytematrix-auth",
      partialize: (s) => ({
        user: s.user,
        isAuthenticated: s.isAuthenticated,
        selectedOEM: s.selectedOEM,
        selectedPlant: s.selectedPlant,
        selectedLine: s.selectedLine,
      }),
    }
  )
);

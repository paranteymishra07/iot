import { create } from "zustand";
import { api } from "@/lib/api";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: string;
  company: string;
  plant: string;
  status: "active" | "inactive";
  lastLogin: string;
  assignedMachineIds?: string[];
  assignedLine?: string;
  dailyTarget?: number;
}

interface UserState {
  users: AppUser[];
  loaded: boolean;
  fetchUsers: () => Promise<void>;
  addUser: (user: Omit<AppUser, "id"> & { password: string }) => Promise<AppUser>;
  updateUser: (id: string, updates: Partial<AppUser>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  assignUser: (id: string, updates: Partial<Pick<AppUser, "assignedMachineIds" | "assignedLine" | "dailyTarget">>) => Promise<void>;
}

export const useUserStore = create<UserState>((set) => ({
  users: [],
  loaded: false,

  fetchUsers: async () => {
    const res = await api.get<AppUser[]>("/users");
    set({ users: res.data, loaded: true });
  },

  addUser: async (user) => {
    const res = await api.post<AppUser>("/users", user);
    set((s) => ({ users: [res.data, ...s.users] }));
    return res.data;
  },

  updateUser: async (id, updates) => {
    const res = await api.put<AppUser>(`/users/${id}`, updates);
    set((s) => ({ users: s.users.map((u) => (u.id === id ? res.data : u)) }));
  },

  deleteUser: async (id) => {
    await api.delete(`/users/${id}`);
    set((s) => ({ users: s.users.filter((u) => u.id !== id) }));
  },

  assignUser: async (id, updates) => {
    const res = await api.put<AppUser>(`/users/${id}/assignment`, updates);
    set((s) => ({ users: s.users.map((u) => (u.id === id ? res.data : u)) }));
  },
}));

import { create } from "zustand";
import { api } from "@/lib/api";
import type { ManufacturingCompany, PlantLocation, ProductionLine, MachineMaster } from "@/types/masterData";

function extractId(val: unknown): string {
  if (typeof val === "string") return val;
  if (val && typeof val === "object" && "_id" in val) return (val as { _id: string })._id;
  return "";
}

interface MasterDataState {
  companies: ManufacturingCompany[];
  plants: PlantLocation[];
  lines: ProductionLine[];
  machines: MachineMaster[];
  loaded: boolean;

  fetchAll: () => Promise<void>;

  addCompany: (company: Omit<ManufacturingCompany, "id" | "createdAt">) => Promise<void>;
  updateCompany: (id: string, updates: Partial<ManufacturingCompany>) => Promise<void>;
  deleteCompany: (id: string) => Promise<void>;

  addPlant: (plant: Omit<PlantLocation, "id" | "createdAt">) => Promise<void>;
  updatePlant: (id: string, updates: Partial<PlantLocation>) => Promise<void>;
  deletePlant: (id: string) => Promise<void>;

  addLine: (line: Omit<ProductionLine, "id" | "createdAt">) => Promise<void>;
  updateLine: (id: string, updates: Partial<ProductionLine>) => Promise<void>;
  deleteLine: (id: string) => Promise<void>;

  addMachine: (machine: Omit<MachineMaster, "id">) => Promise<void>;
  updateMachine: (id: string, updates: Partial<MachineMaster>) => Promise<void>;
  deleteMachine: (id: string) => Promise<void>;

  getPlantsByCompany: (companyId: string) => PlantLocation[];
  getLinesByPlant: (plantId: string) => ProductionLine[];
  getMachinesByLine: (lineId: string) => MachineMaster[];
}

export const useMasterDataStore = create<MasterDataState>((set, get) => ({
  companies: [],
  plants: [],
  lines: [],
  machines: [],
  loaded: false,

  fetchAll: async () => {
    const [companies, plants, lines, machines] = await Promise.all([
      api.get<unknown[]>("/companies"),
      api.get<unknown[]>("/plants"),
      api.get<unknown[]>("/lines"),
      api.get<unknown[]>("/machines"),
    ]);
    set({
      companies: companies.data.map((c: any) => ({
        id: c.id || c._id,
        name: c.name,
        code: c.code,
        address: c.address,
        contactPerson: c.contactPerson,
        contactEmail: c.contactEmail,
        contactPhone: c.contactPhone,
        status: c.status,
        createdAt: c.createdAt,
      })),
      plants: plants.data.map((p: any) => ({
        id: p.id || p._id,
        companyId: extractId(p.companyId),
        name: p.name,
        code: p.code,
        address: p.address,
        city: p.city,
        state: p.state,
        status: p.status,
        createdAt: p.createdAt,
      })),
      lines: lines.data.map((l: any) => ({
        id: l.id || l._id,
        plantId: extractId(l.plantId),
        name: l.name,
        code: l.code,
        description: l.description,
        status: l.status,
        createdAt: l.createdAt,
      })),
      machines: machines.data.map((m: any) => ({
        id: m.id || m._id,
        lineId: extractId(m.lineId),
        name: m.name,
        type: m.type,
        manufacturer: m.manufacturer,
        model: m.model,
        serialNumber: m.serialNumber,
        ipAddress: m.ipAddress,
        status: m.status,
        installDate: m.installDate,
        threshold: m.threshold ?? 0,
        cycleTime: m.cycleTime ?? 0,
      })),
      loaded: true,
    });
  },

  addCompany: async (company) => {
    const res = await api.post<any>("/companies", company);
    const d = res.data;
    set((s) => ({ companies: [{ id: d.id || d._id, name: d.name, code: d.code, address: d.address, contactPerson: d.contactPerson, contactEmail: d.contactEmail, contactPhone: d.contactPhone, status: d.status, createdAt: d.createdAt }, ...s.companies] }));
  },
  updateCompany: async (id, updates) => {
    const res = await api.put<any>(`/companies/${id}`, updates);
    const d = res.data;
    const normalized = { id: d.id || d._id, name: d.name, code: d.code, address: d.address, contactPerson: d.contactPerson, contactEmail: d.contactEmail, contactPhone: d.contactPhone, status: d.status, createdAt: d.createdAt };
    set((s) => ({ companies: s.companies.map((c) => (c.id === id ? normalized : c)) }));
  },
  deleteCompany: async (id) => {
    await api.delete(`/companies/${id}`);
    set((s) => ({ companies: s.companies.filter((c) => c.id !== id) }));
  },

  addPlant: async (plant) => {
    const res = await api.post<any>("/plants", plant);
    const d = res.data;
    set((s) => ({ plants: [{ id: d.id || d._id, companyId: extractId(d.companyId), name: d.name, code: d.code, address: d.address, city: d.city, state: d.state, status: d.status, createdAt: d.createdAt }, ...s.plants] }));
  },
  updatePlant: async (id, updates) => {
    const res = await api.put<any>(`/plants/${id}`, updates);
    const d = res.data;
    const normalized = { id: d.id || d._id, companyId: extractId(d.companyId), name: d.name, code: d.code, address: d.address, city: d.city, state: d.state, status: d.status, createdAt: d.createdAt };
    set((s) => ({ plants: s.plants.map((p) => (p.id === id ? normalized : p)) }));
  },
  deletePlant: async (id) => {
    await api.delete(`/plants/${id}`);
    set((s) => ({ plants: s.plants.filter((p) => p.id !== id) }));
  },

  addLine: async (line) => {
    const res = await api.post<any>("/lines", line);
    const d = res.data;
    set((s) => ({ lines: [{ id: d.id || d._id, plantId: extractId(d.plantId), name: d.name, code: d.code, description: d.description, status: d.status, createdAt: d.createdAt }, ...s.lines] }));
  },
  updateLine: async (id, updates) => {
    const res = await api.put<any>(`/lines/${id}`, updates);
    const d = res.data;
    const normalized = { id: d.id || d._id, plantId: extractId(d.plantId), name: d.name, code: d.code, description: d.description, status: d.status, createdAt: d.createdAt };
    set((s) => ({ lines: s.lines.map((l) => (l.id === id ? normalized : l)) }));
  },
  deleteLine: async (id) => {
    await api.delete(`/lines/${id}`);
    set((s) => ({ lines: s.lines.filter((l) => l.id !== id) }));
  },

  addMachine: async (machine) => {
    const res = await api.post<any>("/machines", machine);
    const d = res.data;
    set((s) => ({ machines: [{ id: d.id || d._id, lineId: extractId(d.lineId), name: d.name, type: d.type, manufacturer: d.manufacturer, model: d.model, serialNumber: d.serialNumber, ipAddress: d.ipAddress, status: d.status, installDate: d.installDate, threshold: d.threshold ?? 0, cycleTime: d.cycleTime ?? 0 }, ...s.machines] }));
  },
  updateMachine: async (id, updates) => {
    const res = await api.put<any>(`/machines/${id}`, updates);
    const d = res.data;
    const normalized = { id: d.id || d._id, lineId: extractId(d.lineId), name: d.name, type: d.type, manufacturer: d.manufacturer, model: d.model, serialNumber: d.serialNumber, ipAddress: d.ipAddress, status: d.status, installDate: d.installDate, threshold: d.threshold ?? 0, cycleTime: d.cycleTime ?? 0 };
    set((s) => ({ machines: s.machines.map((m) => (m.id === id ? normalized : m)) }));
  },
  deleteMachine: async (id) => {
    await api.delete(`/machines/${id}`);
    set((s) => ({ machines: s.machines.filter((m) => m.id !== id) }));
  },

  getPlantsByCompany: (companyId) => get().plants.filter((p) => p.companyId === companyId),
  getLinesByPlant: (plantId) => get().lines.filter((l) => l.plantId === plantId),
  getMachinesByLine: (lineId) => get().machines.filter((m) => m.lineId === lineId),
}));

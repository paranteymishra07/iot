import { useState } from "react";
import { Cog, Plus, Edit2, Trash2, Search } from "lucide-react";
import { useMasterDataStore } from "@/stores/masterDataStore";
import { useAuthStore } from "@/stores/authStore";
import type { MachineMaster } from "@/types/masterData";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const EMPTY_MACHINE: Omit<MachineMaster, "id"> = {
  lineId: "",
  name: "",
  type: "",
  manufacturer: "",
  model: "",
  serialNumber: "",
  ipAddress: "",
  status: "active",
  installDate: "",
  threshold: 0,
  cycleTime: 0,
};

const MACHINE_TYPES = ["CNC Machine", "Hydraulic Press", "Welding Robot", "Assembly Station", "Lathe Machine", "Milling Machine", "Grinding Machine", "Injection Moulding", "Laser Cutter", "Conveyor"];

export default function MachinesMasterPage() {
  const { companies, plants, lines, machines, addMachine, updateMachine, deleteMachine } = useMasterDataStore();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === "super_admin";
  const isOemAdmin = user?.role === "oem_admin";
  const myCompany = isOemAdmin ? companies.find((c) => c.name === user?.oem) : null;
  const myPlantIds = myCompany ? plants.filter((p) => p.companyId === myCompany.id).map((p) => p.id) : [];
  const myLineIds = isOemAdmin ? lines.filter((l) => myPlantIds.includes(l.plantId)).map((l) => l.id) : [];

  const scopedMachines = isOemAdmin ? machines.filter((m) => myLineIds.includes(m.lineId)) : machines;
  const scopedLines = isOemAdmin ? lines.filter((l) => myPlantIds.includes(l.plantId)) : lines;
  const scopedPlants = isOemAdmin ? plants.filter((p) => p.companyId === myCompany?.id) : plants;

  const [search, setSearch] = useState("");
  const [filterCompany, setFilterCompany] = useState("all");
  const [filterPlant, setFilterPlant] = useState("all");
  const [filterLine, setFilterLine] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MachineMaster | null>(null);
  const [form, setForm] = useState(EMPTY_MACHINE);

  const availablePlants = filterCompany === "all" ? scopedPlants : scopedPlants.filter((p) => p.companyId === filterCompany);
  const availableLines = filterPlant === "all" ? scopedLines : scopedLines.filter((l) => l.plantId === filterPlant);

  const filtered = scopedMachines.filter((m) => {
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase()) || m.type.toLowerCase().includes(search.toLowerCase()) || m.serialNumber.toLowerCase().includes(search.toLowerCase());
    const matchLine = filterLine === "all" || m.lineId === filterLine;
    return matchSearch && matchLine;
  });

  const getLineName = (lineId: string) => lines.find((l) => l.id === lineId)?.name || "Unknown";
  const getPlantName = (lineId: string) => {
    const line = lines.find((l) => l.id === lineId);
    return line ? plants.find((p) => p.id === line.plantId)?.name || "Unknown" : "Unknown";
  };

  const openAdd = () => { setEditing(null); setForm(EMPTY_MACHINE); setDialogOpen(true); };
  const openEdit = (m: MachineMaster) => { setEditing(m); setForm({ lineId: m.lineId, name: m.name, type: m.type, manufacturer: m.manufacturer, model: m.model, serialNumber: m.serialNumber, ipAddress: m.ipAddress, status: m.status, installDate: m.installDate, threshold: m.threshold ?? 0, cycleTime: m.cycleTime ?? 0 }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.name.trim() || !form.lineId) { toast.error("Name and Production Line are required"); return; }
    try {
      if (editing) {
        await updateMachine(editing.id, form);
        toast.success("Machine updated");
      } else {
        await addMachine(form);
        toast.success("Machine created");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Failed to save machine");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await deleteMachine(id);
      toast.success(`Deleted ${name}`);
    } catch {
      toast.error("Failed to delete machine");
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Machine Master</h1>
          <p className="text-xs text-muted-foreground">Manage machine registrations and specifications</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 text-xs font-medium bg-brand-primary hover:bg-brand-primary/90 text-white px-3 py-2 rounded-md transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add Machine
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="industrial-card p-3">
          <div className="text-lg font-mono font-bold text-white">{scopedMachines.length}</div>
          <div className="text-[10px] text-muted-foreground">Total Machines</div>
        </div>
        <div className="industrial-card p-3">
          <div className="text-lg font-mono font-bold text-status-running">{scopedMachines.filter((m) => m.status === "active").length}</div>
          <div className="text-[10px] text-muted-foreground">Active</div>
        </div>
        <div className="industrial-card p-3">
          <div className="text-lg font-mono font-bold text-muted-foreground">{scopedMachines.filter((m) => m.status === "inactive").length}</div>
          <div className="text-[10px] text-muted-foreground">Inactive</div>
        </div>
        <div className="industrial-card p-3">
          <div className="text-lg font-mono font-bold text-brand-primary">{new Set(scopedMachines.map((m) => m.type)).size}</div>
          <div className="text-[10px] text-muted-foreground">Machine Types</div>
        </div>
      </div>

      <div className="industrial-card">
        <div className="px-4 py-3 border-b border-industrial-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">All Machines ({filtered.length})</h3>
          <div className="flex items-center gap-2">
            {isSuperAdmin && (
              <select value={filterCompany} onChange={(e) => { setFilterCompany(e.target.value); setFilterPlant("all"); setFilterLine("all"); }} className="bg-industrial-surface border border-industrial-border rounded-md px-2 py-1.5 text-xs text-white focus:outline-none focus:border-brand-primary">
                <option value="all">All Companies</option>
                {companies.filter((c) => c.status === "active").map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
            <select value={filterPlant} onChange={(e) => { setFilterPlant(e.target.value); setFilterLine("all"); }} className="bg-industrial-surface border border-industrial-border rounded-md px-2 py-1.5 text-xs text-white focus:outline-none focus:border-brand-primary">
              <option value="all">All Plants</option>
              {availablePlants.filter((p) => p.status === "active").map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <select value={filterLine} onChange={(e) => setFilterLine(e.target.value)} className="bg-industrial-surface border border-industrial-border rounded-md px-2 py-1.5 text-xs text-white focus:outline-none focus:border-brand-primary">
              <option value="all">All Lines</option>
              {availableLines.filter((l) => l.status === "active").map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="bg-industrial-surface border border-industrial-border rounded-md pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-brand-primary w-36" />
            </div>
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-industrial-border">
              {["Machine", "Type", "Manufacturer", "Serial No.", "Line", "Cycle Time", "Threshold", "Status", "Actions"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id} className="border-b border-industrial-border/40 hover:bg-industrial-hover transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-status-idle/20 border border-status-idle/30 flex items-center justify-center">
                      <Cog className="w-4 h-4 text-status-idle" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{m.name}</div>
                      <div className="text-[10px] text-muted-foreground">{m.model}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded border text-brand-primary border-brand-primary/30 bg-brand-primary/10">{m.type}</span>
                </td>
                <td className="px-4 py-3 text-xs text-white">{m.manufacturer}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{m.serialNumber}</td>
                <td className="px-4 py-3 text-xs text-white">{getLineName(m.lineId)}</td>
                <td className="px-4 py-3 font-mono text-xs text-white">{m.cycleTime ?? 0}s</td>
                <td className="px-4 py-3 font-mono text-xs text-brand-primary">{m.threshold ?? 0}s</td>
                <td className="px-4 py-3">
                  <span className={cn("flex items-center gap-1.5 text-xs font-medium", m.status === "active" ? "text-status-running" : "text-muted-foreground")}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", m.status === "active" ? "bg-status-running" : "bg-muted-foreground")} />
                    {m.status === "active" ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(m)} className="text-muted-foreground hover:text-brand-primary transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(m.id, m.name)} className="text-muted-foreground hover:text-status-down transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-xs text-muted-foreground">No machines found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setDialogOpen(false)}>
          <div className="bg-[#0f1525] border border-industrial-border rounded-xl w-full max-w-lg p-5 space-y-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-bold text-white">{editing ? "Edit Machine" : "Add Machine"}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Production Line *</label>
                <select value={form.lineId} onChange={(e) => setForm({ ...form, lineId: e.target.value })} className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary">
                  <option value="">Select Line</option>
                  {scopedLines.filter((l) => l.status === "active").map((l) => (
                    <option key={l.id} value={l.id}>{l.name} ({getPlantName(l.id)})</option>
                  ))}
                </select>
              </div>
              {([
                { key: "name", label: "Machine Name", required: true },
                { key: "type", label: "Type", type: "select" },
                { key: "manufacturer", label: "Manufacturer" },
                { key: "model", label: "Model" },
                { key: "serialNumber", label: "Serial Number" },
                { key: "ipAddress", label: "IP Address" },
                { key: "installDate", label: "Install Date", type: "date" },
                { key: "cycleTime", label: "Cycle Time (sec)", type: "number" },
                { key: "threshold", label: "Threshold (sec)", type: "number" },
              ] as const).map(({ key, label, required, type }) => (
                <div key={key}>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">{label}{required && " *"}</label>
                  {type === "select" ? (
                    <select value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary">
                      <option value="">Select Type</option>
                      {MACHINE_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  ) : type === "date" ? (
                    <input type="date" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary" />
                  ) : type === "number" ? (
                    <input type="number" min={0} step="any" value={form[key]} onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) || 0 })} className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-brand-primary" />
                  ) : (
                    <input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-brand-primary" />
                  )}
                </div>
              ))}
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as "active" | "inactive" })} className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setDialogOpen(false)} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-white transition-colors">Cancel</button>
              <button onClick={handleSave} className="px-4 py-1.5 text-xs font-medium bg-brand-primary hover:bg-brand-primary/90 text-white rounded-md transition-colors">{editing ? "Update" : "Create"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

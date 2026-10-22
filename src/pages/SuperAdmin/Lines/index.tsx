import { useState } from "react";
import { GitBranch, Plus, Edit2, Trash2, Search } from "lucide-react";
import { useMasterDataStore } from "@/stores/masterDataStore";
import { useAuthStore } from "@/stores/authStore";
import type { ProductionLine } from "@/types/masterData";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const EMPTY_LINE: Omit<ProductionLine, "id" | "createdAt"> = {
  plantId: "",
  name: "",
  code: "",
  description: "",
  status: "active",
};

export default function LinesPage() {
  const { companies, plants, lines, machines, addLine, updateLine, deleteLine } = useMasterDataStore();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === "super_admin";
  const isOemAdmin = user?.role === "oem_admin";
  const myCompany = isOemAdmin ? companies.find((c) => c.name === user?.oem) : null;
  const myPlantIds = myCompany ? plants.filter((p) => p.companyId === myCompany.id).map((p) => p.id) : [];

  const [search, setSearch] = useState("");
  const [filterCompany, setFilterCompany] = useState("all");
  const [filterPlant, setFilterPlant] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProductionLine | null>(null);
  const [form, setForm] = useState(EMPTY_LINE);

  const scopedLines = isOemAdmin ? lines.filter((l) => myPlantIds.includes(l.plantId)) : lines;
  const scopedPlants = isOemAdmin ? plants.filter((p) => p.companyId === myCompany?.id) : plants;
  const availablePlants = filterCompany === "all" ? scopedPlants : scopedPlants.filter((p) => p.companyId === filterCompany);

  const filtered = scopedLines.filter((l) => {
    const matchSearch = l.name.toLowerCase().includes(search.toLowerCase()) || l.code.toLowerCase().includes(search.toLowerCase());
    const matchPlant = filterPlant === "all" || l.plantId === filterPlant;
    return matchSearch && matchPlant;
  });

  const getPlantName = (plantId: string) => plants.find((p) => p.id === plantId)?.name || "Unknown";
  const getCompanyName = (plantId: string) => {
    const plant = plants.find((p) => p.id === plantId);
    return plant ? companies.find((c) => c.id === plant.companyId)?.name || "Unknown" : "Unknown";
  };

  const openAdd = () => { setEditing(null); setForm(EMPTY_LINE); setDialogOpen(true); };
  const openEdit = (l: ProductionLine) => { setEditing(l); setForm({ plantId: l.plantId, name: l.name, code: l.code, description: l.description, status: l.status }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim() || !form.plantId) { toast.error("Name, Code, and Plant are required"); return; }
    try {
      if (editing) {
        await updateLine(editing.id, form);
        toast.success("Line updated");
      } else {
        await addLine(form);
        toast.success("Line created");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Failed to save line");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const hasMachines = machines.some((m) => m.lineId === id);
    if (hasMachines) { toast.error("Cannot delete: line has machines assigned"); return; }
    try {
      await deleteLine(id);
      toast.success(`Deleted ${name}`);
    } catch {
      toast.error("Failed to delete line");
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Production Lines</h1>
          <p className="text-xs text-muted-foreground">Manage production lines across plants</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 text-xs font-medium bg-brand-primary hover:bg-brand-primary/90 text-white px-3 py-2 rounded-md transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add Line
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="industrial-card p-3">
          <div className="text-lg font-mono font-bold text-white">{scopedLines.length}</div>
          <div className="text-[10px] text-muted-foreground">Total Lines</div>
        </div>
        <div className="industrial-card p-3">
          <div className="text-lg font-mono font-bold text-status-running">{scopedLines.filter((l) => l.status === "active").length}</div>
          <div className="text-[10px] text-muted-foreground">Active</div>
        </div>
        <div className="industrial-card p-3">
          <div className="text-lg font-mono font-bold text-brand-accent">{isOemAdmin ? machines.filter((m) => myPlantIds.some((pid) => scopedLines.some((l) => l.plantId === pid && l.id === m.lineId))).length : machines.length}</div>
          <div className="text-[10px] text-muted-foreground">Machines Assigned</div>
        </div>
      </div>

      <div className="industrial-card">
        <div className="px-4 py-3 border-b border-industrial-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">All Lines ({filtered.length})</h3>
          <div className="flex items-center gap-2">
            {isSuperAdmin && (
              <select value={filterCompany} onChange={(e) => { setFilterCompany(e.target.value); setFilterPlant("all"); }} className="bg-industrial-surface border border-industrial-border rounded-md px-2 py-1.5 text-xs text-white focus:outline-none focus:border-brand-primary">
                <option value="all">All Companies</option>
                {companies.filter((c) => c.status === "active").map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
            <select value={filterPlant} onChange={(e) => setFilterPlant(e.target.value)} className="bg-industrial-surface border border-industrial-border rounded-md px-2 py-1.5 text-xs text-white focus:outline-none focus:border-brand-primary">
              <option value="all">All Plants</option>
              {availablePlants.filter((p) => p.status === "active").map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
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
              {(isOemAdmin
                ? ["Line", "Code", "Plant", "Machines", "Status", "Actions"]
                : ["Line", "Code", "Plant", "Company", "Machines", "Status", "Actions"]
              ).map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.id} className="border-b border-industrial-border/40 hover:bg-industrial-hover transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-status-running/20 border border-status-running/30 flex items-center justify-center">
                      <GitBranch className="w-4 h-4 text-status-running" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{l.name}</div>
                      <div className="text-[10px] text-muted-foreground">{l.description || "No description"}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-brand-accent">{l.code}</td>
                <td className="px-4 py-3 text-xs text-white">{getPlantName(l.plantId)}</td>
                {!isOemAdmin && <td className="px-4 py-3 text-xs text-muted-foreground">{getCompanyName(l.plantId)}</td>}
                <td className="px-4 py-3">
                  <span className="text-xs font-mono text-white bg-industrial-surface px-2 py-0.5 rounded border border-industrial-border">
                    {machines.filter((m) => m.lineId === l.id).length}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={cn("flex items-center gap-1.5 text-xs font-medium", l.status === "active" ? "text-status-running" : "text-muted-foreground")}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", l.status === "active" ? "bg-status-running" : "bg-muted-foreground")} />
                    {l.status === "active" ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(l)} className="text-muted-foreground hover:text-brand-primary transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(l.id, l.name)} className="text-muted-foreground hover:text-status-down transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={isOemAdmin ? 6 : 7} className="px-4 py-8 text-center text-xs text-muted-foreground">No lines found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setDialogOpen(false)}>
          <div className="bg-[#0f1525] border border-industrial-border rounded-xl w-full max-w-lg p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-bold text-white">{editing ? "Edit Line" : "Add Line"}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Plant *</label>
                <select value={form.plantId} onChange={(e) => setForm({ ...form, plantId: e.target.value })} className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary">
                  <option value="">Select Plant</option>
                  {scopedPlants.filter((p) => p.status === "active").map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as "active" | "inactive" })} className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              {([
                { key: "name", label: "Line Name", required: true },
                { key: "code", label: "Code", required: true },
              ] as const).map(({ key, label, required }) => (
                <div key={key}>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">{label}{required && " *"}</label>
                  <input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-brand-primary" />
                </div>
              ))}
              <div className="col-span-2">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-brand-primary resize-none" />
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

import { useState } from "react";
import { MapPin, Plus, Edit2, Trash2, Search, Building2 } from "lucide-react";
import { useMasterDataStore } from "@/stores/masterDataStore";
import { useAuthStore } from "@/stores/authStore";
import type { PlantLocation } from "@/types/masterData";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const EMPTY_PLANT: Omit<PlantLocation, "id" | "createdAt"> = {
  companyId: "",
  name: "",
  code: "",
  address: "",
  city: "",
  state: "",
  status: "active",
};

export default function PlantsPage() {
  const { companies, plants, lines, addPlant, updatePlant, deletePlant } = useMasterDataStore();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === "super_admin";
  const isOemAdmin = user?.role === "oem_admin";
  const myCompany = isOemAdmin ? companies.find((c) => c.name === user?.oem) : null;

  const [search, setSearch] = useState("");
  const [filterCompany, setFilterCompany] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PlantLocation | null>(null);
  const [form, setForm] = useState(EMPTY_PLANT);

  const scopedPlants = isOemAdmin && myCompany ? plants.filter((p) => p.companyId === myCompany.id) : plants;

  const filtered = scopedPlants.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase());
    const matchCompany = isSuperAdmin ? (filterCompany === "all" || p.companyId === filterCompany) : true;
    return matchSearch && matchCompany;
  });

  const getCompanyName = (companyId: string) => companies.find((c) => c.id === companyId)?.name || "Unknown";

  const openAdd = () => { setEditing(null); setForm({ ...EMPTY_PLANT, companyId: myCompany?.id || "" }); setDialogOpen(true); };
  const openEdit = (p: PlantLocation) => { setEditing(p); setForm({ companyId: p.companyId, name: p.name, code: p.code, address: p.address, city: p.city, state: p.state, status: p.status }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) { toast.error("Name and Code are required"); return; }
    if (!form.companyId && isSuperAdmin) { toast.error("Company is required"); return; }
    const companyId = form.companyId || myCompany?.id || "";
    const saveData = { ...form, companyId };
    try {
      if (editing) {
        await updatePlant(editing.id, saveData);
        toast.success("Plant updated");
      } else {
        await addPlant(saveData);
        toast.success("Plant created");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Failed to save plant");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const hasLines = lines.some((l) => l.plantId === id);
    if (hasLines) { toast.error("Cannot delete: plant has production lines assigned"); return; }
    try {
      await deletePlant(id);
      toast.success(`Deleted ${name}`);
    } catch {
      toast.error("Failed to delete plant");
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Plant Locations</h1>
          <p className="text-xs text-muted-foreground">Manage manufacturing plant locations</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 text-xs font-medium bg-brand-primary hover:bg-brand-primary/90 text-white px-3 py-2 rounded-md transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add Plant
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="industrial-card p-3">
          <div className="text-lg font-mono font-bold text-white">{scopedPlants.length}</div>
          <div className="text-[10px] text-muted-foreground">Total Plants</div>
        </div>
        <div className="industrial-card p-3">
          <div className="text-lg font-mono font-bold text-status-running">{scopedPlants.filter((p) => p.status === "active").length}</div>
          <div className="text-[10px] text-muted-foreground">Active</div>
        </div>
        <div className="industrial-card p-3">
          <div className="text-lg font-mono font-bold text-brand-primary">{new Set(scopedPlants.map((p) => p.state)).size}</div>
          <div className="text-[10px] text-muted-foreground">States Covered</div>
        </div>
      </div>

      <div className="industrial-card">
        <div className="px-4 py-3 border-b border-industrial-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">All Plants ({filtered.length})</h3>
          <div className="flex items-center gap-2">
            {isSuperAdmin && (
              <select value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)} className="bg-industrial-surface border border-industrial-border rounded-md px-2 py-1.5 text-xs text-white focus:outline-none focus:border-brand-primary">
                <option value="all">All Companies</option>
                {companies.filter((c) => c.status === "active").map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="bg-industrial-surface border border-industrial-border rounded-md pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-brand-primary w-40" />
            </div>
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-industrial-border">
              {["Plant", "Code", "Company", "City", "State", "Status", "Actions"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b border-industrial-border/40 hover:bg-industrial-hover transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-brand-accent/20 border border-brand-accent/30 flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-brand-accent" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{p.name}</div>
                      <div className="text-[10px] text-muted-foreground truncate max-w-[180px]">{p.address}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-brand-accent">{p.code}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 text-xs text-white">
                    <Building2 className="w-3 h-3 text-muted-foreground" />
                    {getCompanyName(p.companyId)}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-white">{p.city}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{p.state}</td>
                <td className="px-4 py-3">
                  <span className={cn("flex items-center gap-1.5 text-xs font-medium", p.status === "active" ? "text-status-running" : "text-muted-foreground")}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", p.status === "active" ? "bg-status-running" : "bg-muted-foreground")} />
                    {p.status === "active" ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(p)} className="text-muted-foreground hover:text-brand-primary transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(p.id, p.name)} className="text-muted-foreground hover:text-status-down transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-xs text-muted-foreground">No plants found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setDialogOpen(false)}>
          <div className="bg-[#0f1525] border border-industrial-border rounded-xl w-full max-w-lg p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-bold text-white">{editing ? "Edit Plant" : "Add Plant"}</h2>
            <div className="grid grid-cols-2 gap-3">
              {isSuperAdmin && (
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Company *</label>
                  <select value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })} className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary">
                    <option value="">Select Company</option>
                    {companies.filter((c) => c.status === "active").map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as "active" | "inactive" })} className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              {([
                { key: "name", label: "Plant Name", required: true },
                { key: "code", label: "Code", required: true },
                { key: "address", label: "Address", span: true },
                { key: "city", label: "City" },
                { key: "state", label: "State" },
              ] as const).map(({ key, label, required, span }) => (
                <div key={key} className={span ? "col-span-2" : ""}>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">{label}{required && " *"}</label>
                  <input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-brand-primary" />
                </div>
              ))}
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

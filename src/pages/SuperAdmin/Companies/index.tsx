import { useState } from "react";
import { Building2, Plus, Edit2, Trash2, Search } from "lucide-react";
import { useMasterDataStore } from "@/stores/masterDataStore";
import type { ManufacturingCompany } from "@/types/masterData";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const EMPTY_COMPANY: Omit<ManufacturingCompany, "id" | "createdAt"> = {
  name: "",
  code: "",
  address: "",
  contactPerson: "",
  contactEmail: "",
  contactPhone: "",
  status: "active",
};

export default function CompaniesPage() {
  const { companies, plants, addCompany, updateCompany, deleteCompany } = useMasterDataStore();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ManufacturingCompany | null>(null);
  const [form, setForm] = useState(EMPTY_COMPANY);

  const filtered = companies.filter(
    (c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => { setEditing(null); setForm(EMPTY_COMPANY); setDialogOpen(true); };
  const openEdit = (c: ManufacturingCompany) => { setEditing(c); setForm({ name: c.name, code: c.code, address: c.address, contactPerson: c.contactPerson, contactEmail: c.contactEmail, contactPhone: c.contactPhone, status: c.status }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) { toast.error("Name and Code are required"); return; }
    try {
      if (editing) {
        await updateCompany(editing.id, form);
        toast.success("Company updated");
      } else {
        await addCompany(form);
        toast.success("Company created");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Failed to save company");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const hasPlants = plants.some((p) => p.companyId === id);
    if (hasPlants) { toast.error("Cannot delete: company has plants assigned"); return; }
    try {
      await deleteCompany(id);
      toast.success(`Deleted ${name}`);
    } catch {
      toast.error("Failed to delete company");
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Manufacturing Companies</h1>
          <p className="text-xs text-muted-foreground">Manage company master data</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 text-xs font-medium bg-brand-primary hover:bg-brand-primary/90 text-white px-3 py-2 rounded-md transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add Company
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="industrial-card p-3">
          <div className="text-lg font-mono font-bold text-white">{companies.length}</div>
          <div className="text-[10px] text-muted-foreground">Total Companies</div>
        </div>
        <div className="industrial-card p-3">
          <div className="text-lg font-mono font-bold text-status-running">{companies.filter((c) => c.status === "active").length}</div>
          <div className="text-[10px] text-muted-foreground">Active</div>
        </div>
        <div className="industrial-card p-3">
          <div className="text-lg font-mono font-bold text-muted-foreground">{companies.filter((c) => c.status === "inactive").length}</div>
          <div className="text-[10px] text-muted-foreground">Inactive</div>
        </div>
      </div>

      <div className="industrial-card">
        <div className="px-4 py-3 border-b border-industrial-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">All Companies ({filtered.length})</h3>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="bg-industrial-surface border border-industrial-border rounded-md pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-brand-primary w-48" />
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-industrial-border">
              {["Company", "Code", "Contact", "Phone", "Status", "Actions"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-b border-industrial-border/40 hover:bg-industrial-hover transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-brand-primary/20 border border-brand-primary/30 flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-brand-primary" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{c.name}</div>
                      <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">{c.address}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-brand-accent">{c.code}</td>
                <td className="px-4 py-3">
                  <div className="text-xs text-white">{c.contactPerson}</div>
                  <div className="text-[10px] text-muted-foreground">{c.contactEmail}</div>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{c.contactPhone}</td>
                <td className="px-4 py-3">
                  <span className={cn("flex items-center gap-1.5 text-xs font-medium", c.status === "active" ? "text-status-running" : "text-muted-foreground")}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", c.status === "active" ? "bg-status-running" : "bg-muted-foreground")} />
                    {c.status === "active" ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(c)} className="text-muted-foreground hover:text-brand-primary transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(c.id, c.name)} className="text-muted-foreground hover:text-status-down transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-muted-foreground">No companies found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setDialogOpen(false)}>
          <div className="bg-[#0f1525] border border-industrial-border rounded-xl w-full max-w-lg p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-bold text-white">{editing ? "Edit Company" : "Add Company"}</h2>
            <div className="grid grid-cols-2 gap-3">
              {([
                { key: "name", label: "Company Name", required: true },
                { key: "code", label: "Code", required: true },
                { key: "address", label: "Address", span: true },
                { key: "contactPerson", label: "Contact Person" },
                { key: "contactEmail", label: "Contact Email" },
                { key: "contactPhone", label: "Phone" },
              ] as const).map(({ key, label, required, span }) => (
                <div key={key} className={span ? "col-span-2" : ""}>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">{label}{required && " *"}</label>
                  <input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-brand-primary" />
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

import { useState, useEffect } from "react";
import { AlertTriangle, Plus, Edit2, Trash2, Search, Power } from "lucide-react";
import { api } from "@/lib/api";
import type { DowntimeReason } from "@/types/production";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const EMPTY_FORM = { label: "", category: "" };

const CATEGORY_SUGGESTIONS = ["Operator", "Material", "Maintenance", "Tooling", "Engineering", "Setup", "Quality", "Breakdown", "Utility", "Other"];

export default function DowntimeReasonsPage() {
  const [reasons, setReasons] = useState<DowntimeReason[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DowntimeReason | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = async () => {
    try {
      const res = await api.get<DowntimeReason[]>("/downtime-reasons?all=1");
      setReasons(res.data);
    } catch {
      toast.error("Failed to load downtime reasons");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = reasons.filter((r) =>
    r.label.toLowerCase().includes(search.toLowerCase()) ||
    r.category.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = reasons.filter((r) => r.active).length;
  const categories = new Set(reasons.map((r) => r.category));

  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setDialogOpen(true); };
  const openEdit = (r: DowntimeReason) => { setEditing(r); setForm({ label: r.label, category: r.category }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.label.trim() || !form.category.trim()) { toast.error("Label and Category are required"); return; }
    try {
      if (editing) {
        await api.put(`/downtime-reasons/${editing.id}`, { label: form.label.trim(), category: form.category.trim() });
        toast.success("Reason updated");
      } else {
        await api.post("/downtime-reasons", { label: form.label.trim(), category: form.category.trim() });
        toast.success("Reason created");
      }
      setDialogOpen(false);
      load();
    } catch {
      toast.error("Failed to save reason");
    }
  };

  const toggleActive = async (r: DowntimeReason) => {
    try {
      await api.put(`/downtime-reasons/${r.id}`, { active: !r.active });
      toast.success(r.active ? `${r.label} deactivated` : `${r.label} activated`);
      load();
    } catch {
      toast.error("Failed to update reason");
    }
  };

  const handleDelete = async (r: DowntimeReason) => {
    try {
      await api.delete(`/downtime-reasons/${r.id}`);
      toast.success(`Deleted ${r.label}`);
      load();
    } catch {
      toast.error("Failed to delete reason");
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Downtime Reasons</h1>
          <p className="text-xs text-muted-foreground">Manage downtime reasons operators can select</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 text-xs font-medium bg-brand-primary hover:bg-brand-primary/90 text-white px-3 py-2 rounded-md transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add Reason
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="industrial-card p-3">
          <div className="text-lg font-mono font-bold text-white">{reasons.length}</div>
          <div className="text-[10px] text-muted-foreground">Total Reasons</div>
        </div>
        <div className="industrial-card p-3">
          <div className="text-lg font-mono font-bold text-status-running">{activeCount}</div>
          <div className="text-[10px] text-muted-foreground">Active</div>
        </div>
        <div className="industrial-card p-3">
          <div className="text-lg font-mono font-bold text-brand-primary">{categories.size}</div>
          <div className="text-[10px] text-muted-foreground">Categories</div>
        </div>
      </div>

      <div className="industrial-card">
        <div className="px-4 py-3 border-b border-industrial-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">All Reasons ({filtered.length})</h3>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="bg-industrial-surface border border-industrial-border rounded-md pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-brand-primary w-44" />
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-industrial-border">
              {["Reason", "Category", "Status", "Actions"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-industrial-border/40 hover:bg-industrial-hover transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-status-idle/20 border border-status-idle/30 flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4 text-status-idle" />
                    </div>
                    <span className="text-sm font-semibold text-white">{r.label}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded border text-brand-primary border-brand-primary/30 bg-brand-primary/10">{r.category}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={cn("flex items-center gap-1.5 text-xs font-medium", r.active ? "text-status-running" : "text-muted-foreground")}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", r.active ? "bg-status-running" : "bg-muted-foreground")} />
                    {r.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleActive(r)} title={r.active ? "Deactivate" : "Activate"} className="text-muted-foreground hover:text-status-running transition-colors"><Power className="w-3.5 h-3.5" /></button>
                    <button onClick={() => openEdit(r)} className="text-muted-foreground hover:text-brand-primary transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(r)} className="text-muted-foreground hover:text-status-down transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-xs text-muted-foreground">No reasons found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setDialogOpen(false)}>
          <div className="bg-[#0f1525] border border-industrial-border rounded-xl w-full max-w-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-bold text-white">{editing ? "Edit Reason" : "Add Reason"}</h2>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Reason Label *</label>
                <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. No Operator" className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-brand-primary" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Category *</label>
                <input
                  list="reason-categories"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="e.g. Operator"
                  className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-brand-primary"
                />
                <datalist id="reason-categories">
                  {CATEGORY_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
                </datalist>
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

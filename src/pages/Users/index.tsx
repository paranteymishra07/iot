import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Users, Plus, Shield, Edit2, Trash2, Search } from "lucide-react";
import { useUserStore, type AppUser } from "@/stores/userStore";
import { useMasterDataStore } from "@/stores/masterDataStore";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const ROLE_CONFIG: Record<string, { label: string; cls: string }> = {
  super_admin: { label: "Super Admin", cls: "text-status-down border-status-down/40 bg-status-down/10" },
  oem_admin: { label: "OEM Admin", cls: "text-status-idle border-status-idle/40 bg-status-idle/10" },
  plant_manager: { label: "Plant Manager", cls: "text-brand-primary border-brand-primary/40 bg-brand-primary/10" },
  production_manager: { label: "Production Mgr", cls: "text-brand-accent border-brand-accent/40 bg-brand-accent/10" },
  maintenance_manager: { label: "Maintenance Mgr", cls: "text-status-running border-status-running/40 bg-status-running/10" },
  hr: { label: "HR", cls: "text-brand-accent border-brand-accent/40 bg-brand-accent/10" },
  operator: { label: "Operator", cls: "text-white border-industrial-border bg-industrial-surface" },
  viewer: { label: "Viewer", cls: "text-muted-foreground border-industrial-border/40 bg-transparent" },
};

const ROLES = ["oem_admin", "plant_manager", "production_manager", "maintenance_manager", "hr", "operator", "viewer"];

const EMPTY_FORM = { name: "", email: "", password: "", role: "plant_manager", company: "", plant: "Mumbai Plant", status: "active" as "active" | "inactive", dailyTarget: 0, assignedMachineIds: [] as string[] };

export default function UsersPage() {
  const { users, addUser, updateUser, deleteUser, assignUser } = useUserStore();
  const companies = useMasterDataStore((s) => s.companies);
  const plants = useMasterDataStore((s) => s.plants);
  const masterMachines = useMasterDataStore((s) => s.machines);
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === "super_admin";

  // HR manages operators through /hr/operators. This page grants roles and
  // cross-plant access, so it stays closed to HR even if the URL is typed.
  if (user?.role === "hr") return <Navigate to="/hr/operators" replace />;

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const activeCompanies = companies.filter((c) => c.status === "active");
  const filteredPlants = form.company
    ? plants.filter((p) => p.companyId === activeCompanies.find((c) => c.name === form.company)?.id && p.status === "active")
    : plants.filter((p) => p.status === "active");

  const filtered = users.filter(
    (u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, company: isSuperAdmin ? "" : user?.oem || "" });
    setDialogOpen(true);
  };
  const openEdit = (u: AppUser) => {
    setEditing(u);
    setForm({ name: u.name, email: u.email, password: "", role: u.role, company: u.company, plant: u.plant, status: u.status, dailyTarget: u.dailyTarget || 0, assignedMachineIds: u.assignedMachineIds || [] });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) { toast.error("Name and Email are required"); return; }
    if (!editing && !form.password.trim()) { toast.error("Password is required for new users"); return; }
    if (isSuperAdmin && !form.company.trim()) { toast.error("Company is required"); return; }
    try {
      let savedId: string | undefined = editing?.id;
      if (editing) {
        const { password, ...rest } = form;
        const payload: any = { ...rest };
        if (password.trim()) payload.password = password;
        await updateUser(editing.id, payload);
        toast.success("User updated");
      } else {
        const { dailyTarget, assignedMachineIds, ...rest } = form;
        const created = await addUser({ ...rest, lastLogin: "Never" });
        savedId = created.id;
        toast.success("User created");
      }
      if (savedId && form.role === "operator") {
        await assignUser(savedId, {
          dailyTarget: Number(form.dailyTarget) || 0,
          assignedMachineIds: form.assignedMachineIds,
        });
      }
      setDialogOpen(false);
    } catch {
      toast.error("Failed to save user");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await deleteUser(id);
      toast.success(`Deleted ${name}`);
    } catch {
      toast.error("Failed to delete user");
    }
  };

  const roleCounts = users.reduce((acc, u) => { acc[u.role] = (acc[u.role] || 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Users & Roles</h1>
          <p className="text-xs text-muted-foreground">Manage platform access and permissions</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 text-xs font-medium bg-brand-primary hover:bg-brand-primary/90 text-white px-3 py-2 rounded-md transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add User
        </button>
      </div>

      {/* Role Cards */}
      <div className="grid grid-cols-4 gap-3">
        {Object.entries(ROLE_CONFIG).slice(0, 4).map(([role, cfg]) => (
          <div key={role} className="industrial-card p-3">
            <div className="flex items-center gap-2 mb-1">
              <Shield className={cn("w-3.5 h-3.5", cfg.cls.split(" ")[0])} />
              <span className="text-xs font-semibold text-white">{cfg.label}</span>
            </div>
            <div className="text-lg font-mono font-bold text-white">
              {roleCounts[role] || 0}
            </div>
            <div className="text-[10px] text-muted-foreground">users</div>
          </div>
        ))}
      </div>

      {/* Users Table */}
      <div className="industrial-card">
        <div className="px-4 py-3 border-b border-industrial-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">All Users ({users.length})</h3>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users..."
              className="bg-industrial-surface border border-industrial-border rounded-md pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-brand-primary w-48"
            />
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-industrial-border">
              {["User", "Role", "Company", "Plant", "Status", "Last Login", "Actions"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const roleCfg = ROLE_CONFIG[u.role] || { label: u.role, cls: "text-white border-industrial-border bg-industrial-surface" };
              return (
                <tr key={u.id} className="border-b border-industrial-border/40 hover:bg-industrial-hover transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-brand-primary/20 border border-brand-primary/30 flex items-center justify-center text-xs font-bold text-brand-primary">
                        {u.name[0]}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">{u.name}</div>
                        <div className="text-[10px] text-muted-foreground">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded border", roleCfg.cls)}>{roleCfg.label}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{u.company || "--"}</td>
                  <td className="px-4 py-3 text-xs text-white">{u.plant}</td>
                  <td className="px-4 py-3">
                    <span className={cn("flex items-center gap-1.5 text-xs font-medium", u.status === "active" ? "text-status-running" : "text-muted-foreground")}>
                      <span className={cn("w-1.5 h-1.5 rounded-full", u.status === "active" ? "bg-status-running" : "bg-muted-foreground")} />
                      {u.status === "active" ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{u.lastLogin}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(u)} className="text-muted-foreground hover:text-brand-primary transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(u.id, u.name)} className="text-muted-foreground hover:text-status-down transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-xs text-muted-foreground">No users found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setDialogOpen(false)}>
          <div className="bg-[#0f1525] border border-industrial-border rounded-xl w-full max-w-lg p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-bold text-white">{editing ? "Edit User" : "Add User"}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Full Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-brand-primary" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Email *</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-brand-primary" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Password {editing ? "(leave blank to keep current)" : "*"}</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={editing ? "••••••••" : ""} className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-brand-primary" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Role</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary">
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_CONFIG[r]?.label || r}</option>
                  ))}
                </select>
              </div>
              {isSuperAdmin && (
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Company *</label>
                  <select value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value, plant: "" })} className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary">
                    <option value="">Select Company</option>
                    {activeCompanies.map((c) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Plant</label>
                <select value={form.plant} onChange={(e) => setForm({ ...form, plant: e.target.value })} className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary">
                  <option value="">Select Plant</option>
                  <option value="All Plants">All Plants</option>
                  {filteredPlants.map((p) => (
                    <option key={p.id} value={p.name}>{p.name}</option>
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
            </div>

            {form.role === "operator" && (
              <>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Daily Target (units)</label>
                  <input
                    type="number"
                    value={form.dailyTarget}
                    onChange={(e) => setForm({ ...form, dailyTarget: Number(e.target.value) })}
                    className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Assigned Machines</label>
                  <div className="max-h-40 overflow-y-auto border border-industrial-border rounded-md divide-y divide-industrial-border/40">
                    {masterMachines.length === 0 && (
                      <div className="px-3 py-4 text-center text-[11px] text-muted-foreground">No machines configured</div>
                    )}
                    {masterMachines.map((m) => {
                      const checked = form.assignedMachineIds.includes(m.id);
                      return (
                        <label key={m.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-industrial-hover">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                assignedMachineIds: e.target.checked
                                  ? [...form.assignedMachineIds, m.id]
                                  : form.assignedMachineIds.filter((id) => id !== m.id),
                              })
                            }
                            className="accent-brand-primary"
                          />
                          <span className="text-xs text-white">{m.name}</span>
                          <span className="text-[10px] text-muted-foreground ml-auto">{m.type}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
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

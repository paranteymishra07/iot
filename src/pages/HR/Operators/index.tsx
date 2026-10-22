import { useEffect, useMemo, useState } from "react";
import { UserPlus, Edit2, Trash2, X, Users, Search, ShieldAlert } from "lucide-react";
import { useUserStore, type AppUser } from "@/stores/userStore";
import { usePlantScope } from "@/hooks/usePlantScope";
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const EMPTY = { name: "", email: "", password: "", status: "active" as "active" | "inactive" };

export default function HrOperatorsPage() {
  const { canManage, plant, availablePlants, plantId, setPlantId } = usePlantScope();
  const { users, fetchUsers, loaded, addUser, updateUser, deleteUser } = useUserStore();
  const currentUser = useAuthStore((s) => s.user);

  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loaded) fetchUsers().catch(() => {});
  }, [loaded]);

  // HR only ever manages operators, and only inside the plant it is scoped to.
  const operators = useMemo(() => {
    return users
      .filter((u) => u.role === "operator")
      .filter((u) => (plantId ? u.plant === plant?.name : true))
      .filter((u) => (search ? `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase()) : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [users, plantId, plant, search]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setDialog(true);
  };

  const openEdit = (u: AppUser) => {
    setEditing(u);
    setForm({ name: u.name, email: u.email, password: "", status: u.status });
    setDialog(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Enter the operator's name");
    if (!form.email.trim()) return toast.error("Enter an email");
    if (!editing && form.password.length < 4) return toast.error("Set an initial password (4+ characters)");
    if (!plant) return toast.error("No plant selected");

    setBusy(true);
    try {
      if (editing) {
        // A blank password field means "keep the current password".
        const updates: Partial<AppUser> = {
          name: form.name.trim(),
          email: form.email.trim(),
          status: form.status,
        };
        if (form.password) (updates as Record<string, unknown>).password = form.password;
        await updateUser(editing.id, updates);
        toast.success("Operator updated");
      } else {
        await addUser({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          // The role is fixed: HR manages operators, it does not mint other roles.
          role: "operator",
          company: "",
          plant: plant.name,
          status: form.status,
          lastLogin: "Never",
          assignedMachineIds: [],
          dailyTarget: 0,
        });
        toast.success("Operator added");
      }
      setDialog(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to save operator");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (u: AppUser) => {
    setBusy(true);
    try {
      await deleteUser(u.id);
      toast.success("Operator removed");
    } catch {
      toast.error("Failed to remove operator");
    } finally {
      setBusy(false);
    }
  };

  if (!canManage) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground text-xs">Operator management is available to HR and plant managers</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Manage Operators</h1>
          <p className="text-xs text-muted-foreground">
            Workforce records used for rostering, attendance and salary
          </p>
        </div>
        <div className="flex items-center gap-2">
          {availablePlants.length > 1 && (
            <select
              value={plantId}
              onChange={(e) => setPlantId(e.target.value)}
              className="bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
            >
              {availablePlants.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 text-[11px] font-medium text-brand-primary border border-brand-primary/40 hover:bg-brand-primary/10 px-3 py-2 rounded-md transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" /> Add Operator
          </button>
        </div>
      </div>

      <div className="industrial-card p-3 flex items-center gap-3">
        <Search className="w-3.5 h-3.5 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email"
          className="flex-1 bg-transparent text-xs text-white focus:outline-none placeholder:text-muted-foreground"
        />
        <span className="text-[10px] text-muted-foreground">
          {operators.length} operator{operators.length === 1 ? "" : "s"} in {plant?.name}
        </span>
      </div>

      <div className="industrial-card">
        {operators.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <Users className="w-6 h-6 text-muted-foreground mx-auto" />
            <p className="text-xs text-white">No operators in {plant?.name} yet</p>
            <p className="text-[10px] text-muted-foreground">Add operators here, then roster them onto shifts.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-industrial-border">
                  {["Name", "Email", "Plant", "Status", "Last Login", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {operators.map((u) => (
                  <tr key={u.id} className="border-b border-industrial-border/40 hover:bg-industrial-hover transition-colors">
                    <td className="px-4 py-2.5 text-xs font-medium text-white">{u.name}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{u.plant}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          "text-[10px] px-2 py-0.5 rounded border font-medium",
                          u.status === "active"
                            ? "text-status-running border-status-running/30 bg-status-running/10"
                            : "text-muted-foreground border-industrial-border bg-industrial-surface"
                        )}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[10px] text-muted-foreground">{u.lastLogin || "Never"}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(u)} className="text-muted-foreground hover:text-brand-primary transition-colors" title="Edit">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => remove(u)} disabled={busy} className="text-muted-foreground hover:text-status-down transition-colors" title="Remove">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="flex items-start gap-2 text-[10px] text-muted-foreground/70">
        <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
        Operators created here get the operator role only. Role and plant assignment for admin, manager and HR
        accounts stay under Users &amp; Roles.
      </p>

      {dialog && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="industrial-card w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">{editing ? "Edit Operator" : "Add Operator"}</h3>
              <button onClick={() => setDialog(false)} className="text-muted-foreground hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">
                  {editing ? "New Password (leave blank to keep)" : "Initial Password"}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as "active" | "inactive" })}
                  className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="text-[10px] text-muted-foreground">
                Role: <span className="text-brand-primary font-mono">operator</span> · Plant:{" "}
                <span className="text-white">{plant?.name}</span>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setDialog(false)} className="text-[11px] px-4 py-2 rounded-md text-muted-foreground hover:text-white transition-colors">
                Cancel
              </button>
              <button
                onClick={save}
                disabled={busy}
                className="text-[11px] font-medium px-4 py-2 rounded-md bg-brand-primary text-white hover:bg-brand-primary/80 transition-colors disabled:opacity-50"
              >
                {busy ? "Saving..." : editing ? "Save Changes" : "Add Operator"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

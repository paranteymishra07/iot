import { useEffect, useMemo, useState } from "react";
import {
  Clock, Plus, Edit2, Trash2, Search, CalendarDays, ChevronLeft, ChevronRight,
  UserPlus, X, Copy, Power, Users,
} from "lucide-react";
import { useUserStore } from "@/stores/userStore";
import { useShiftStore } from "@/stores/shiftStore";
import { usePlantScope } from "@/hooks/usePlantScope";
import type { Shift } from "@/types/shift";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const EMPTY_SHIFT = { plantId: "", name: "", code: "", startTime: "06:00", endTime: "14:00", breakMin: 30, active: true };

function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(d: Date): Date {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

function fmtRange(from: string, to: string): string {
  const pretty = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return `${d} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m) - 1]} ${y}`;
  };
  return `${pretty(from)} – ${pretty(to)}`;
}

function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

export default function ShiftsPage() {
  const users = useUserStore((s) => s.users);
  const { shifts, assignments, fetchShifts, fetchRoster, createShift, updateShift, deleteShift, assignOperator, unassignOperator, bulkAssign } =
    useShiftStore();
  const { canManage, availablePlants, plantId, setPlantId, plant } = usePlantScope();

  const [tab, setTab] = useState<"shifts" | "roster">("shifts");
  const [search, setSearch] = useState("");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [busyCell, setBusyCell] = useState<string | null>(null);

  const [shiftDialog, setShiftDialog] = useState(false);
  const [editing, setEditing] = useState<Shift | null>(null);
  const [form, setForm] = useState(EMPTY_SHIFT);

  const [assignTarget, setAssignTarget] = useState<{ shift: Shift; date: string } | null>(null);
  const [assignForm, setAssignForm] = useState({ operatorId: "", wholeWeek: false });

  const plantShifts = useMemo(
    () => shifts.filter((s) => s.plantId === plantId).sort((a, b) => a.order - b.order || a.code.localeCompare(b.code)),
    [shifts, plantId]
  );
  const operators = useMemo(
    () => users.filter((u) => u.role === "operator" && (!plant || u.plant === plant.name)),
    [users, plant]
  );

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekFrom = ymd(weekStart);
  const weekTo = ymd(addDays(weekStart, 6));
  const todayStr = ymd(new Date());

  useEffect(() => {
    if (!plantId) return;
    fetchShifts(plantId);
    fetchRoster(plantId, weekFrom, weekTo);
  }, [plantId, weekFrom, weekTo]);

  const cellKey = (shiftId: string, date: string) => `${shiftId}|${date}`;

  const rosteredFor = useMemo(() => {
    const map = new Map<string, typeof assignments>();
    for (const a of assignments) {
      const key = cellKey(a.shiftId, a.date);
      map.set(key, [...(map.get(key) || []), a]);
    }
    return map;
  }, [assignments]);

  const weekOperatorIds = useMemo(() => new Set(assignments.map((a) => a.operatorId)), [assignments]);
  const uncoveredCells = useMemo(
    () => plantShifts.filter((s) => weekDays.some((d) => (rosteredFor.get(cellKey(s.id, ymd(d))) || []).length === 0)).length,
    [plantShifts, weekDays, rosteredFor]
  );

  const filteredShifts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return plantShifts;
    return plantShifts.filter((s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q));
  }, [plantShifts, search]);

  const weekRosterCount = (shiftId: string) =>
    assignments.filter((a) => a.shiftId === shiftId && a.date >= weekFrom && a.date <= weekTo).length;

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY_SHIFT, plantId });
    setShiftDialog(true);
  };

  const openEdit = (s: Shift) => {
    setEditing(s);
    setForm({ plantId: s.plantId, name: s.name, code: s.code, startTime: s.startTime, endTime: s.endTime, breakMin: s.breakMin, active: s.active });
    setShiftDialog(true);
  };

  const handleSaveShift = async () => {
    if (!form.name.trim() || !form.code.trim()) { toast.error("Name and Code are required"); return; }
    if (!form.plantId) { toast.error("Select a plant"); return; }
    try {
      if (editing) {
        await updateShift(editing.id, { ...form, order: editing.order });
        toast.success("Shift updated");
      } else {
        await createShift(form);
        toast.success("Shift created");
      }
      setShiftDialog(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to save shift");
    }
  };

  const handleDeleteShift = async (s: Shift) => {
    try {
      await deleteShift(s.id);
      toast.success(`Deleted ${s.name}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to delete shift");
    }
  };

  const toggleActive = async (s: Shift) => {
    try {
      await updateShift(s.id, { active: !s.active });
      toast.success(s.active ? `${s.code} deactivated` : `${s.code} activated`);
    } catch {
      toast.error("Failed to update shift");
    }
  };

  const openAssign = (shift: Shift, date: string) => {
    setAssignTarget({ shift, date });
    setAssignForm({ operatorId: "", wholeWeek: false });
  };

  const handleAssign = async () => {
    if (!assignTarget || !assignForm.operatorId) { toast.error("Select an operator"); return; }
    const { shift, date } = assignTarget;
    setBusyCell(cellKey(shift.id, date));
    try {
      if (assignForm.wholeWeek) {
        const count = await bulkAssign({ plantId, shiftId: shift.id, operatorIds: [assignForm.operatorId], from: weekFrom, to: weekTo, mode: "add" });
        toast.success(`Assigned to ${count} day(s) this week`);
      } else {
        await assignOperator({ plantId, shiftId: shift.id, operatorId: assignForm.operatorId, date });
        toast.success("Operator assigned");
      }
      setAssignTarget(null);
      await fetchRoster(plantId, weekFrom, weekTo);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to assign operator");
    } finally {
      setBusyCell(null);
    }
  };

  const handleUnassign = async (assignmentId: string) => {
    setBusyCell(assignmentId);
    try {
      await unassignOperator(assignmentId);
      await fetchRoster(plantId, weekFrom, weekTo);
    } catch {
      toast.error("Failed to remove operator");
    } finally {
      setBusyCell(null);
    }
  };

  const copyLastWeek = async () => {
    const prevFrom = ymd(addDays(weekStart, -7));
    const prevTo = ymd(addDays(weekStart, -1));
    try {
      const res = await api.get<{ assignments: { shiftId: string; operatorId: string }[] }>("/shifts/roster", {
        params: { plantId, from: prevFrom, to: prevTo },
      });
      const prev = res.data.assignments || [];
      if (prev.length === 0) { toast.error("No roster found in the previous week"); return; }

      const byShift = new Map<string, string[]>();
      for (const a of prev) {
        if (!byShift.has(a.shiftId)) byShift.set(a.shiftId, []);
        if (!byShift.get(a.shiftId)!.includes(a.operatorId)) byShift.get(a.shiftId)!.push(a.operatorId);
      }

      const results = await Promise.all(
        Array.from(byShift.entries())
          .filter(([shiftId]) => plantShifts.some((s) => s.id === shiftId))
          .map(([shiftId, operatorIds]) =>
            bulkAssign({ plantId, shiftId, operatorIds, from: weekFrom, to: weekTo, mode: "add" })
          )
      );
      const added = results.reduce((a, b) => a + b, 0);
      await fetchRoster(plantId, weekFrom, weekTo);
      toast.success(added > 0 ? `Copied ${added} assignment(s) from last week` : "Already up to date");
    } catch {
      toast.error("Failed to copy last week");
    }
  };

  if (!canManage) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-muted-foreground mb-2">You do not have access to shift management</p>
          <p className="text-xs text-muted-foreground/70">Available to super admin, OEM admin and plant manager roles</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Shift Management</h1>
          <p className="text-xs text-muted-foreground">Manage plant shifts and assign operators plant-wise</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={plantId}
            onChange={(e) => setPlantId(e.target.value)}
            className="bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
          >
            {availablePlants.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {tab === "shifts" && (
            <button onClick={openAdd} className="flex items-center gap-1.5 text-xs font-medium bg-brand-primary hover:bg-brand-primary/90 text-white px-3 py-2 rounded-md transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add Shift
            </button>
          )}
        </div>
      </div>

      {!plant && (
        <div className="industrial-card p-8 text-center text-xs text-muted-foreground">No plant available for your role</div>
      )}

      {plant && (
        <>
          <div className="grid grid-cols-4 gap-3">
            <div className="industrial-card p-3">
              <div className="text-lg font-mono font-bold text-white">{plantShifts.length}</div>
              <div className="text-[10px] text-muted-foreground">Shifts at {plant.name}</div>
            </div>
            <div className="industrial-card p-3">
              <div className="text-lg font-mono font-bold text-status-running">{plantShifts.filter((s) => s.active).length}</div>
              <div className="text-[10px] text-muted-foreground">Active</div>
            </div>
            <div className="industrial-card p-3">
              <div className="text-lg font-mono font-bold text-brand-primary">{weekOperatorIds.size}</div>
              <div className="text-[10px] text-muted-foreground">Operators rostered this week</div>
            </div>
            <div className="industrial-card p-3">
              <div className={cn("text-lg font-mono font-bold", uncoveredCells > 0 ? "text-status-down" : "text-status-running")}>
                {uncoveredCells}
              </div>
              <div className="text-[10px] text-muted-foreground">Shifts with an empty day</div>
            </div>
          </div>

          <div className="flex items-center gap-1 border-b border-industrial-border">
            {(["shifts", "roster"] as const).map((key) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors",
                  tab === key ? "border-brand-primary text-white" : "border-transparent text-muted-foreground hover:text-white"
                )}
              >
                {key === "shifts" ? <Clock className="w-3.5 h-3.5" /> : <CalendarDays className="w-3.5 h-3.5" />}
                {key === "shifts" ? "Shifts" : "Roster"}
              </button>
            ))}
          </div>

          {tab === "shifts" && (
            <div className="industrial-card">
              <div className="px-4 py-3 border-b border-industrial-border flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Shifts ({filteredShifts.length})</h3>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="bg-industrial-surface border border-industrial-border rounded-md pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-brand-primary w-44" />
                </div>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-industrial-border">
                    {["Shift", "Window", "Duration", "Break", "Rostered (week)", "Status", "Actions"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredShifts.map((s) => (
                    <tr key={s.id} className="border-b border-industrial-border/40 hover:bg-industrial-hover transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-brand-primary/15 border border-brand-primary/30 flex items-center justify-center">
                            <span className="text-[11px] font-bold text-brand-primary font-mono">{s.code}</span>
                          </div>
                          <span className="text-sm font-semibold text-white">{s.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-white">{s.startTime} – {s.endTime}</span>
                        {s.crossesMidnight && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded border border-status-idle/40 bg-status-idle/10 text-status-idle">+1 day</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-white">{fmtDuration(s.durationMin)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{s.breakMin}m</td>
                      <td className="px-4 py-3 font-mono text-xs text-white">{weekRosterCount(s.id)}</td>
                      <td className="px-4 py-3">
                        <span className={cn("flex items-center gap-1.5 text-xs font-medium", s.active ? "text-status-running" : "text-muted-foreground")}>
                          <span className={cn("w-1.5 h-1.5 rounded-full", s.active ? "bg-status-running" : "bg-muted-foreground")} />
                          {s.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => toggleActive(s)} title={s.active ? "Deactivate" : "Activate"} className="text-muted-foreground hover:text-status-running transition-colors"><Power className="w-3.5 h-3.5" /></button>
                          <button onClick={() => openEdit(s)} className="text-muted-foreground hover:text-brand-primary transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDeleteShift(s)} className="text-muted-foreground hover:text-status-down transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredShifts.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-xs text-muted-foreground">No shifts found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === "roster" && (
            <div className="industrial-card">
              <div className="px-4 py-3 border-b border-industrial-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="p-1 rounded text-muted-foreground hover:text-white hover:bg-industrial-hover transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                  <span className="text-sm font-semibold text-white min-w-[190px] text-center">{fmtRange(weekFrom, weekTo)}</span>
                  <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="p-1 rounded text-muted-foreground hover:text-white hover:bg-industrial-hover transition-colors"><ChevronRight className="w-4 h-4" /></button>
                  <button onClick={() => setWeekStart(startOfWeek(new Date()))} className="text-[11px] text-brand-primary hover:text-brand-accent transition-colors">This week</button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">{operators.length} operator(s) at {plant.name}</span>
                  <button onClick={copyLastWeek} className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-white border border-industrial-border rounded-md px-2.5 py-1.5 transition-colors">
                    <Copy className="w-3 h-3" /> Copy last week
                  </button>
                </div>
              </div>

              {plantShifts.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-muted-foreground">No shifts configured for this plant yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px]">
                    <thead>
                      <tr className="border-b border-industrial-border">
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-[180px]">Shift</th>
                        {weekDays.map((d, i) => {
                          const isToday = ymd(d) === todayStr;
                          return (
                            <th key={i} className="px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider">
                              <div className={cn(isToday ? "text-brand-primary" : "text-muted-foreground")}>{DAY_LABELS[i]}</div>
                              <div className={cn("font-mono text-[10px] normal-case", isToday ? "text-brand-primary" : "text-muted-foreground/60")}>
                                {String(d.getDate()).padStart(2, "0")}/{String(d.getMonth() + 1).padStart(2, "0")}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {plantShifts.map((s) => (
                        <tr key={s.id} className="border-b border-industrial-border/40 align-top">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold font-mono text-brand-primary">{s.code}</span>
                              <span className="text-xs font-semibold text-white truncate">{s.name}</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                              {s.startTime}–{s.endTime}{s.crossesMidnight ? " (+1d)" : ""}
                            </div>
                          </td>
                          {weekDays.map((d) => {
                            const date = ymd(d);
                            const cell = rosteredFor.get(cellKey(s.id, date)) || [];
                            const key = cellKey(s.id, date);
                            return (
                              <td key={date} className="px-2 py-2">
                                <div className="min-h-[54px] rounded-md border border-industrial-border/60 bg-industrial-surface/40 p-1 space-y-1">
                                  {cell.map((a) => (
                                    <div key={a.id} className="flex items-center gap-1 group">
                                      <span className="flex-1 truncate text-[10px] text-white bg-brand-primary/15 border border-brand-primary/25 rounded px-1.5 py-0.5" title={a.operatorName}>
                                        {a.operatorName}
                                      </span>
                                      <button
                                        onClick={() => handleUnassign(a.id)}
                                        disabled={busyCell === a.id}
                                        title="Remove"
                                        className="text-muted-foreground hover:text-status-down opacity-0 group-hover:opacity-100 transition-opacity"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ))}
                                  <button
                                    onClick={() => openAssign(s, date)}
                                    disabled={busyCell === key}
                                    className="w-full text-[10px] text-muted-foreground/70 hover:text-brand-primary border border-dashed border-industrial-border rounded py-1 flex items-center justify-center gap-1 transition-colors"
                                  >
                                    <Plus className="w-3 h-3" /> Add
                                  </button>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {shiftDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShiftDialog(false)}>
          <div className="bg-[#0f1525] border border-industrial-border rounded-xl w-full max-w-lg p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-bold text-white">{editing ? "Edit Shift" : "Add Shift"}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Plant *</label>
                <select
                  value={form.plantId}
                  onChange={(e) => setForm({ ...form, plantId: e.target.value })}
                  disabled={!!editing}
                  className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary disabled:opacity-60"
                >
                  {availablePlants.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Code *</label>
                <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="e.g. A" className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-brand-primary" />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Shift Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Shift A (Morning)" className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-brand-primary" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Start Time *</label>
                <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">End Time *</label>
                <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Break (min)</label>
                <input type="number" min={0} value={form.breakMin} onChange={(e) => setForm({ ...form, breakMin: Number(e.target.value) })} className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Status</label>
                <select value={form.active ? "active" : "inactive"} onChange={(e) => setForm({ ...form, active: e.target.value === "active" })} className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/70">
              An end time earlier than the start time is treated as a night shift running into the next day.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShiftDialog(false)} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-white transition-colors">Cancel</button>
              <button onClick={handleSaveShift} className="px-4 py-1.5 text-xs font-medium bg-brand-primary hover:bg-brand-primary/90 text-white rounded-md transition-colors">{editing ? "Update" : "Create"}</button>
            </div>
          </div>
        </div>
      )}

      {assignTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setAssignTarget(null)}>
          <div className="bg-[#0f1525] border border-industrial-border rounded-xl w-full max-w-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-brand-primary" /> Assign Operator
            </h2>
            <div className="text-[11px] text-muted-foreground space-y-1">
              <div><span className="text-white font-medium">{assignTarget.shift.name}</span> · {assignTarget.shift.startTime}–{assignTarget.shift.endTime}</div>
              <div>{assignTarget.date}{assignForm.wholeWeek ? ` → ${weekFrom} to ${weekTo}` : ""}</div>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Operator *</label>
              <select
                value={assignForm.operatorId}
                onChange={(e) => setAssignForm({ ...assignForm, operatorId: e.target.value })}
                className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
              >
                <option value="">Select operator...</option>
                {operators.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}{o.status === "inactive" ? " (inactive)" : ""}</option>
                ))}
              </select>
              {operators.length === 0 && (
                <p className="text-[10px] text-status-idle mt-1.5 flex items-center gap-1">
                  <Users className="w-3 h-3" /> No operators exist for {plant?.name}. Create them under Users.
                </p>
              )}
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={assignForm.wholeWeek} onChange={(e) => setAssignForm({ ...assignForm, wholeWeek: e.target.checked })} className="accent-brand-primary" />
              <span className="text-xs text-white">Assign to this shift for the whole week</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setAssignTarget(null)} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-white transition-colors">Cancel</button>
              <button onClick={handleAssign} className="px-4 py-1.5 text-xs font-medium bg-brand-primary hover:bg-brand-primary/90 text-white rounded-md transition-colors">Assign</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

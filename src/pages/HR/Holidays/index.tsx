import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Plus, Edit2, Trash2, X, Info } from "lucide-react";
import { useAttendanceStore } from "@/stores/attendanceStore";
import { usePlantScope } from "@/hooks/usePlantScope";
import { HOLIDAY_TYPE_OPTIONS, type Holiday, type HolidayType } from "@/types/attendance";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const EMPTY = { date: "", name: "", type: "public" as HolidayType, notes: "" };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const TYPE_CLS: Record<HolidayType, string> = {
  public: "text-status-down border-status-down/30 bg-status-down/10",
  restricted: "text-status-idle border-status-idle/30 bg-status-idle/10",
  company: "text-brand-primary border-brand-primary/30 bg-brand-primary/10",
};

function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function HolidaysPage() {
  const { canManage, availablePlants, plantId, setPlantId, plant } = usePlantScope();
  const { holidays, fetchHolidays, createHoliday, updateHoliday, deleteHoliday } = useAttendanceStore();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<Holiday | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (plantId) fetchHolidays(plantId, year).catch(() => {});
  }, [plantId, year]);

  const byDate = useMemo(() => {
    const map = new Map<string, Holiday>();
    for (const h of holidays) map.set(h.date, h);
    return map;
  }, [holidays]);

  const yearHolidays = useMemo(
    () => holidays.filter((h) => h.date.startsWith(`${year}-`)).sort((a, b) => a.date.localeCompare(b.date)),
    [holidays, year]
  );

  // Build the month grid, Monday first, padded to whole weeks. JS Date rolls
  // over month boundaries on its own, so day 0 and day 32 do the right thing.
  const grid = useMemo(() => {
    const lead = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: { date: string; day: number; inMonth: boolean }[] = [];

    for (let i = 0; i < lead; i++) {
      const d = new Date(year, month, 1 - (lead - i));
      cells.push({ date: ymd(d), day: d.getDate(), inMonth: false });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({ date: ymd(new Date(year, month, day)), day, inMonth: true });
    }
    let pad = 1;
    while (cells.length % 7 !== 0) {
      const d = new Date(year, month, daysInMonth + pad);
      cells.push({ date: ymd(d), day: d.getDate(), inMonth: false });
      pad++;
    }
    return cells;
  }, [year, month]);

  const openCreate = (date?: string) => {
    setEditing(null);
    setForm({ date: date || "", name: "", type: "public", notes: "" });
    setDialog(true);
  };

  const openEdit = (h: Holiday) => {
    setEditing(h);
    setForm({ date: h.date, name: h.name, type: h.type, notes: h.notes });
    setDialog(true);
  };

  const save = async () => {
    if (!plantId) return;
    if (!form.date) return toast.error("Pick a date");
    if (!form.name.trim()) return toast.error("Enter a holiday name");
    setBusy(true);
    try {
      if (editing) {
        await updateHoliday(editing.id, form);
        toast.success("Holiday updated");
      } else {
        await createHoliday({ plantId, ...form });
        toast.success("Holiday added");
      }
      setDialog(false);
      await fetchHolidays(plantId, year);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to save holiday");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (h: Holiday) => {
    setBusy(true);
    try {
      await deleteHoliday(h.id);
      toast.success("Holiday removed");
      if (plantId) await fetchHolidays(plantId, year);
    } catch {
      toast.error("Failed to remove holiday");
    } finally {
      setBusy(false);
    }
  };

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  if (!canManage) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground text-xs">Holiday calendar is available to HR, plant managers and admins</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Holiday Calendar</h1>
          <p className="text-xs text-muted-foreground">Plant holidays decide when attendance counts as a holiday and when working is overtime</p>
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
          <button
            onClick={() => openCreate()}
            className="flex items-center gap-1.5 text-[11px] font-medium text-brand-primary border border-brand-primary/40 hover:bg-brand-primary/10 px-3 py-2 rounded-md transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Holiday
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 industrial-card p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => shiftMonth(-1)} className="text-muted-foreground hover:text-white text-xs px-2 py-1 transition-colors">
              {"<< Prev"}
            </button>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">{MONTHS[month]} {year}</h3>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="bg-industrial-surface border border-industrial-border rounded px-2 py-1 text-[11px] text-white focus:outline-none focus:border-brand-primary"
              >
                {[year - 1, year, year + 1].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <button onClick={() => shiftMonth(1)} className="text-muted-foreground hover:text-white text-xs px-2 py-1 transition-colors">
              {"Next >>"}
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold py-1">{d}</div>
            ))}
            {grid.map((cell, i) => {
              const holiday = byDate.get(cell.date);
              const isToday = cell.date === ymd(new Date());
              return (
                <button
                  key={`${cell.date}-${i}`}
                  onClick={() => cell.inMonth && !holiday && openCreate(cell.date)}
                  disabled={!cell.inMonth || Boolean(holiday)}
                  className={cn(
                    "min-h-[62px] rounded-md border p-1.5 text-left transition-colors",
                    cell.inMonth ? "border-industrial-border hover:border-brand-primary/50 hover:bg-industrial-hover" : "border-transparent opacity-30 cursor-default",
                    holiday && "bg-brand-primary/5 border-brand-primary/30",
                    isToday && "ring-1 ring-brand-accent/60"
                  )}
                >
                  {cell.inMonth && (
                    <>
                      <div className={cn("text-[10px] font-mono", isToday ? "text-brand-accent font-bold" : "text-muted-foreground")}>
                        {cell.day}
                      </div>
                      {holiday && (
                        <div className="mt-1 text-[9px] font-semibold text-brand-primary leading-tight truncate" title={holiday.name}>
                          {holiday.name}
                        </div>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>

          <p className="text-[10px] text-muted-foreground mt-3 flex items-center gap-1.5">
            <Info className="w-3 h-3" /> Click any empty day to add a holiday.
          </p>
        </div>

        <div className="industrial-card">
          <div className="px-4 py-3 border-b border-industrial-border flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-brand-primary" />
            <h3 className="text-sm font-semibold text-white">{year} Holidays</h3>
            <span className="ml-auto text-[10px] text-muted-foreground">{yearHolidays.length}</span>
          </div>
          <div className="max-h-[520px] overflow-y-auto">
            {yearHolidays.length === 0 ? (
              <p className="text-xs text-muted-foreground p-4 text-center">No holidays declared for {plant?.name} in {year}</p>
            ) : (
              yearHolidays.map((h) => (
                <div key={h.id} className="px-4 py-2.5 border-b border-industrial-border/40 hover:bg-industrial-hover transition-colors group">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="text-xs font-medium text-white">{h.name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {new Date(`${h.date}T00:00:00`).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}
                      </div>
                    </div>
                    <span className={cn("text-[9px] uppercase px-1.5 py-0.5 rounded border font-medium", TYPE_CLS[h.type])}>{h.type}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(h)} className="text-muted-foreground hover:text-white" title="Edit">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => remove(h)} className="text-muted-foreground hover:text-status-down" title="Delete" disabled={busy}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {dialog && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="industrial-card w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">{editing ? "Edit Holiday" : "Add Holiday"}</h3>
              <button onClick={() => setDialog(false)} className="text-muted-foreground hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">Holiday Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Diwali"
                  className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as HolidayType })}
                  className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
                >
                  {HOLIDAY_TYPE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">Notes (optional)</label>
                <input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
                />
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
                {busy ? "Saving..." : editing ? "Update Holiday" : "Add Holiday"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays, ChevronLeft, ChevronRight, CheckCheck, Save, Clock, Users,
  PartyPopper, AlertTriangle, Unlock,
} from "lucide-react";
import { useAttendanceStore } from "@/stores/attendanceStore";
import { usePlantScope } from "@/hooks/usePlantScope";
import { useAuthStore } from "@/stores/authStore";
import { ATTENDANCE_STATUS_OPTIONS, type AttendanceRecord, type AttendanceStatus } from "@/types/attendance";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

function fmtDur(min: number): string {
  if (min <= 0) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

const STATUS_CLS: Record<AttendanceStatus, string> = {
  present: "text-status-running border-status-running/40 bg-status-running/10",
  half_day: "text-brand-primary border-brand-primary/40 bg-brand-primary/10",
  absent: "text-status-down border-status-down/40 bg-status-down/10",
  leave: "text-status-idle border-status-idle/40 bg-status-idle/10",
  holiday: "text-brand-accent border-brand-accent/40 bg-brand-accent/10",
  weekly_off: "text-muted-foreground border-industrial-border bg-industrial-surface",
};

export default function AttendancePage() {
  const { canManage, availablePlants, plantId, setPlantId, plant } = usePlantScope();
  const { day, loading, saving, fetchDay, mark, markBulk, clear } = useAttendanceStore();
  const currentUser = useAuthStore((s) => s.user);

  const [date, setDate] = useState(() => ymd(new Date()));
  const [savingRow, setSavingRow] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(() => {
    if (!plantId) return;
    fetchDay(plantId, date).catch((err: any) => {
      toast.error(err?.response?.data?.error || "Failed to load attendance");
    });
  }, [plantId, date]);

  useEffect(() => {
    load();
  }, [load]);

  const shifts = day?.shifts ?? [];

  const saveSlot = async (slot: AttendanceRecord, patch: Partial<AttendanceRecord>) => {
    if (!plantId) return;
    const key = `${slot.operatorId}|${slot.shiftId}`;
    setSavingRow(key);
    try {
      await mark({
        plantId,
        shiftId: slot.shiftId,
        operatorId: slot.operatorId,
        date,
        status: patch.status ?? (slot.status || "present"),
        checkIn: patch.checkIn ?? slot.checkIn,
        checkOut: patch.checkOut ?? slot.checkOut,
        otOverrideMin: patch.otOverrideMin !== undefined ? patch.otOverrideMin : slot.otOverrideMin,
        notes: patch.notes ?? slot.notes,
        markedBy: currentUser?.name ?? "",
      });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to save attendance");
    } finally {
      setSavingRow(null);
    }
  };

  const bulkMark = async (shiftId: string, status: AttendanceStatus) => {
    if (!plantId || !day) return;
    const operatorIds = day.operators.map((o) => o.operatorId);
    if (operatorIds.length === 0) return toast.error("Nobody is rostered for this date");
    setBulkBusy(true);
    try {
      const res = await markBulk({
        plantId,
        shiftId,
        date,
        status,
        checkIn: status === "present" ? shifts.find((s) => s.id === shiftId)?.startTime ?? "" : "",
        checkOut: status === "present" ? shifts.find((s) => s.id === shiftId)?.endTime ?? "" : "",
        operatorIds,
        markedBy: currentUser?.name ?? "",
      });
      toast.success(`Marked ${res.marked} operator(s) as ${status.replace("_", " ")}`);
      if (res.failed.length > 0) toast.error(`${res.failed.length} could not be marked`);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Bulk marking failed");
    } finally {
      setBulkBusy(false);
    }
  };

  const isSaving = (slot: AttendanceRecord) => saving[`${plantId}|${slot.shiftId}|${slot.operatorId}|${date}`];

  const summary = useMemo(() => {
    if (!day) return null;
    return day.totals;
  }, [day]);

  if (!canManage) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground text-xs">Attendance marking is available to HR, plant managers and admins</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Operator Attendance</h1>
          <p className="text-xs text-muted-foreground">Punch in / punch out per shift, with overtime derived automatically</p>
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
        </div>
      </div>

      {/* Date navigation */}
      <div className="industrial-card p-3 flex flex-wrap items-center gap-3">
        <button onClick={() => setDate(ymd(addDays(new Date(`${date}T00:00:00`), -1)))} className="text-muted-foreground hover:text-white transition-colors p-1">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          <CalendarDays className="w-3.5 h-3.5 text-brand-primary" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-industrial-surface border border-industrial-border rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-primary"
          />
        </div>
        <button onClick={() => setDate(ymd(addDays(new Date(`${date}T00:00:00`), 1)))} className="text-muted-foreground hover:text-white transition-colors p-1">
          <ChevronRight className="w-4 h-4" />
        </button>
        <button onClick={() => setDate(ymd(new Date()))} className="text-[11px] text-brand-primary hover:underline">
          Today
        </button>

        {day?.isHoliday && (
          <span className="flex items-center gap-1.5 text-[11px] text-brand-accent border border-brand-accent/40 bg-brand-accent/10 px-2.5 py-1 rounded">
            <PartyPopper className="w-3.5 h-3.5" /> {day.holidayName} — any hours worked count as overtime
          </span>
        )}

        <div className="flex-1" />

        {summary && (
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
            <span><span className="text-white font-mono">{summary.marked}</span>/{summary.rostered} marked</span>
            <span className="text-status-running">Present {summary.present}</span>
            <span className="text-status-down">Absent {summary.absent}</span>
            <span className="text-status-idle">Leave {summary.leave}</span>
            <span className="text-brand-accent">OT {fmtDur(summary.otMin)}</span>
          </div>
        )}
      </div>

      {!plant && <div className="industrial-card p-8 text-center text-xs text-muted-foreground">No plant available for your role</div>}

      {plant && loading && <div className="industrial-card p-8 text-center text-xs text-muted-foreground">Loading roster…</div>}

      {plant && !loading && day && (
        <>
          {day.operators.length === 0 ? (
            <div className="industrial-card p-8 text-center space-y-2">
              <Users className="w-6 h-6 text-muted-foreground mx-auto" />
              <p className="text-xs text-white">Nobody is rostered on {date}</p>
              <p className="text-[10px] text-muted-foreground">
                Assign operators to shifts under Shift Management first, then come back to mark attendance.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {shifts.map((shift) => {
                const rows = day.operators
                  .map((op) => ({
                    operator: op,
                    slot: op.slots.find((s) => s.shiftId === shift.id),
                  }))
                  .filter((r) => r.slot);
                if (rows.length === 0) return null;

                return (
                  <div key={shift.id} className="industrial-card">
                    <div className="px-4 py-2.5 border-b border-industrial-border flex items-center gap-3">
                      <span className="text-[10px] font-bold font-mono text-brand-primary">{shift.code}</span>
                      <div>
                        <div className="text-xs font-semibold text-white">{shift.name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {shift.startTime} – {shift.endTime}
                          {shift.breakMin > 0 && ` · ${shift.breakMin}m break`}
                        </div>
                      </div>
                      <div className="ml-auto flex items-center gap-1.5">
                        <button
                          onClick={() => bulkMark(shift.id, "present")}
                          disabled={bulkBusy}
                          className="flex items-center gap-1 text-[10px] text-status-running border border-status-running/40 hover:bg-status-running/10 px-2 py-1 rounded transition-colors disabled:opacity-50"
                        >
                          <CheckCheck className="w-3 h-3" /> All present
                        </button>
                        <button
                          onClick={() => bulkMark(shift.id, "absent")}
                          disabled={bulkBusy}
                          className="flex items-center gap-1 text-[10px] text-status-down border border-status-down/40 hover:bg-status-down/10 px-2 py-1 rounded transition-colors disabled:opacity-50"
                        >
                          <AlertTriangle className="w-3 h-3" /> All absent
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[980px]">
                        <thead>
                          <tr className="border-b border-industrial-border">
                            {["Operator", "Status", "In", "Out", "Worked", "Late", "Early", "OT", "OT Override", ""].map((h) => (
                              <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map(({ operator, slot }) => slot && (
                            <AttendanceRow
                              key={`${operator.operatorId}-${shift.id}`}
                              slot={slot}
                              busy={Boolean(isSaving(slot))}
                              onSave={saveSlot}
                              onClear={async () => {
                                if (!slot.id) return;
                                try {
                                  await clear(slot.id);
                                  toast.success("Attendance cleared");
                                  load();
                                } catch {
                                  toast.error("Failed to clear attendance");
                                }
                              }}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-start gap-2 text-[10px] text-muted-foreground/70">
            <Clock className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
            <p>
              Worked hours come from the punch times. Overtime only starts once the operator is on the clock
              beyond a standard 8-hour day, and the shift break is deducted on top of that — so an 8-hour shift
              with a 30-minute break needs 8h30m on the clock before the first overtime minute is earned, and
              working the full 8-hour span is not overtime. Every worked minute counts as overtime on a holiday
              or weekly off. HR can override the overtime value per operator when reality differs from the times.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function AttendanceRow({
  slot,
  busy,
  onSave,
  onClear,
}: {
  slot: AttendanceRecord;
  busy: boolean;
  onSave: (slot: AttendanceRecord, patch: Partial<AttendanceRecord>) => Promise<void>;
  onClear: () => Promise<void>;
}) {
  const [status, setStatus] = useState<AttendanceStatus>((slot.status || "present") as AttendanceStatus);
  const [checkIn, setCheckIn] = useState(slot.checkIn || "");
  const [checkOut, setCheckOut] = useState(slot.checkOut || "");
  const [override, setOverride] = useState(slot.otOverrideMin === null ? "" : String(slot.otOverrideMin));

  // Re-sync when the server record changes underneath us (reload, bulk mark).
  useEffect(() => {
    setStatus((slot.status || "present") as AttendanceStatus);
    setCheckIn(slot.checkIn || "");
    setCheckOut(slot.checkOut || "");
    setOverride(slot.otOverrideMin === null ? "" : String(slot.otOverrideMin));
  }, [slot.id, slot.status, slot.checkIn, slot.checkOut, slot.otOverrideMin]);

  const dirty =
    status !== (slot.status || "present") ||
    checkIn !== (slot.checkIn || "") ||
    checkOut !== (slot.checkOut || "") ||
    override !== (slot.otOverrideMin === null ? "" : String(slot.otOverrideMin));

  const commit = () => {
    onSave(slot, {
      status,
      checkIn,
      checkOut,
      otOverrideMin: override === "" ? null : Number(override),
    });
  };

  const hasOverride = override !== "" && Number(override) !== slot.otAutoMin;

  return (
    <tr className={cn("border-b border-industrial-border/40 transition-colors", slot.marked ? "bg-industrial-surface/40" : "hover:bg-industrial-hover/50")}>
      <td className="px-3 py-2">
        <div className="text-xs font-medium text-white">{slot.operatorName}</div>
        {!slot.marked && <div className="text-[9px] text-status-idle">not marked</div>}
        {slot.markedBy && <div className="text-[9px] text-muted-foreground">by {slot.markedBy}</div>}
      </td>
      <td className="px-3 py-2">
        <select
          value={status}
          onChange={(e) => {
            const next = e.target.value as AttendanceStatus;
            setStatus(next);
            onSave(slot, { status: next });
          }}
          className={cn(
            "text-[10px] font-medium px-2 py-1 rounded border focus:outline-none focus:border-brand-primary",
            STATUS_CLS[status]
          )}
        >
          {ATTENDANCE_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <input
          type="time"
          value={checkIn}
          onChange={(e) => setCheckIn(e.target.value)}
          className="bg-industrial-surface border border-industrial-border rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-brand-primary w-[92px]"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="time"
          value={checkOut}
          onChange={(e) => setCheckOut(e.target.value)}
          className="bg-industrial-surface border border-industrial-border rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-brand-primary w-[92px]"
        />
      </td>
      <td className="px-3 py-2 font-mono text-[11px] text-white">{fmtDur(slot.workedMin)}</td>
      <td className="px-3 py-2 font-mono text-[11px] text-status-idle">{slot.lateMin > 0 ? fmtDur(slot.lateMin) : "—"}</td>
      <td className="px-3 py-2 font-mono text-[11px] text-status-idle">{slot.earlyLeaveMin > 0 ? fmtDur(slot.earlyLeaveMin) : "—"}</td>
      <td className="px-3 py-2 font-mono text-[11px] font-semibold text-brand-accent">
        {slot.otMin > 0 ? fmtDur(slot.otMin) : "—"}
        {hasOverride && <span className="block text-[9px] text-muted-foreground font-normal">auto {fmtDur(slot.otAutoMin)}</span>}
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          min={0}
          value={override}
          onChange={(e) => setOverride(e.target.value)}
          placeholder={String(slot.otAutoMin)}
          className="bg-industrial-surface border border-industrial-border rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-brand-primary w-[72px]"
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            onClick={commit}
            disabled={!dirty || busy}
            className="flex items-center gap-1 text-[10px] text-brand-primary border border-brand-primary/40 hover:bg-brand-primary/10 px-2 py-1 rounded transition-colors disabled:opacity-30"
            title="Save row"
          >
            <Save className="w-3 h-3" />
          </button>
          {slot.id && (
            <button
              onClick={onClear}
              className="text-muted-foreground hover:text-status-down transition-colors p-1"
              title="Clear this record"
            >
              <Unlock className="w-3 h-3" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

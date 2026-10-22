import { useEffect, useMemo, useState } from "react";
import { Download, FileBarChart, Users, CalendarDays, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { usePlantScope } from "@/hooks/usePlantScope";
import type { AttendanceRecord } from "@/types/attendance";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const today = new Date();
const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
const iso = (d: Date) => d.toISOString().slice(0, 10);

interface Row {
  operatorId: string;
  operatorName: string;
  present: number;
  absent: number;
  halfDay: number;
  leave: number;
  holiday: number;
  weeklyOff: number;
  workedMin: number;
  otMin: number;
  lateCount: number;
  lateMin: number;
}

const h = (min: number) => (min / 60).toFixed(2);

export default function HrReportsPage() {
  const { canManage, plant, plantId } = usePlantScope();
  const [from, setFrom] = useState(iso(firstOfMonth));
  const [to, setTo] = useState(iso(today));
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!plantId || !canManage) return;
    setLoading(true);
    api
      .get<AttendanceRecord[]>("/attendance", { params: { plantId, from, to } })
      .then((r) => setRecords(r.data ?? []))
      .catch(() => toast.error("Failed to load attendance for the period"))
      .finally(() => setLoading(false));
  }, [plantId, from, to, canManage]);

  const rows = useMemo<Row[]>(() => {
    const map = new Map<string, Row>();
    for (const r of records) {
      if (!map.has(r.operatorId)) {
        map.set(r.operatorId, {
          operatorId: r.operatorId,
          operatorName: r.operatorName,
          present: 0,
          absent: 0,
          halfDay: 0,
          leave: 0,
          holiday: 0,
          weeklyOff: 0,
          workedMin: 0,
          otMin: 0,
          lateCount: 0,
          lateMin: 0,
        });
      }
      const row = map.get(r.operatorId)!;
      if (r.status === "present") row.present++;
      else if (r.status === "absent") row.absent++;
      else if (r.status === "half_day") row.halfDay++;
      else if (r.status === "leave") row.leave++;
      else if (r.status === "holiday") row.holiday++;
      else if (r.status === "weekly_off") row.weeklyOff++;
      row.workedMin += r.workedMin || 0;
      row.otMin += r.otMin || 0;
      if ((r.lateMin || 0) > 0) {
        row.lateCount++;
        row.lateMin += r.lateMin;
      }
    }
    return [...map.values()].sort((a, b) => b.otMin - a.otMin || a.operatorName.localeCompare(b.operatorName));
  }, [records]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          workedMin: acc.workedMin + r.workedMin,
          otMin: acc.otMin + r.otMin,
          absent: acc.absent + r.absent,
          leave: acc.leave + r.leave,
        }),
        { workedMin: 0, otMin: 0, absent: 0, leave: 0 }
      ),
    [rows]
  );

  const exportCsv = () => {
    if (rows.length === 0) return toast.error("Nothing to export");
    const head = [
      "Operator", "Present", "Absent", "Half Day", "Leave", "Holiday", "Weekly Off",
      "Worked Hours", "Overtime Hours", "Late Count", "Late Minutes",
    ];
    const body = rows.map((r) => [
      r.operatorName, r.present, r.absent, r.halfDay, r.leave, r.holiday, r.weeklyOff,
      h(r.workedMin), h(r.otMin), r.lateCount, r.lateMin,
    ]);
    const csv = [head, ...body]
      .map((line) => line.map((c) => (typeof c === "string" && /[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-summary-${plant?.name ?? "plant"}-${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Attendance summary exported");
  };

  if (!canManage) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground text-xs">HR reports are available to HR and plant managers</p>
      </div>
    );
  }

  const stat = (icon: React.ReactNode, label: string, value: string, tone?: string) => (
    <div className="industrial-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-[10px] uppercase tracking-wider font-semibold">{label}</span>
      </div>
      <p className={cn("text-2xl font-bold text-white mt-1.5", tone)}>{value}</p>
    </div>
  );

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">HR Reports</h1>
          <p className="text-xs text-muted-foreground">Attendance and overtime summary for {plant?.name}</p>
        </div>
        <button
          onClick={exportCsv}
          className="flex items-center gap-1.5 text-[11px] font-medium text-brand-primary border border-brand-primary/40 hover:bg-brand-primary/10 px-3 py-2 rounded-md transition-colors"
        >
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      <div className="industrial-card p-3 flex items-end gap-3">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">From</label>
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            className="bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">To</label>
          <input
            type="date"
            value={to}
            min={from}
            max={iso(today)}
            onChange={(e) => setTo(e.target.value)}
            className="bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
          />
        </div>
        <span className="text-[10px] text-muted-foreground pb-2 ml-auto">
          {loading ? "Loading..." : `${records.length} marked record${records.length === 1 ? "" : "s"}`}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stat(<Users className="w-3.5 h-3.5" />, "Operators", String(rows.length))}
        {stat(<Clock className="w-3.5 h-3.5" />, "Worked Hours", h(totals.workedMin))}
        {stat(<FileBarChart className="w-3.5 h-3.5" />, "Overtime Hours", h(totals.otMin), totals.otMin > 0 ? "text-status-warning" : undefined)}
        {stat(<CalendarDays className="w-3.5 h-3.5" />, "Absent + Leave", String(totals.absent + totals.leave), totals.absent + totals.leave > 0 ? "text-status-down" : undefined)}
      </div>

      <div className="industrial-card">
        {rows.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <FileBarChart className="w-6 h-6 text-muted-foreground mx-auto" />
            <p className="text-xs text-white">No attendance marked in this period</p>
            <p className="text-[10px] text-muted-foreground">Mark attendance first, then come back for the summary.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr className="border-b border-industrial-border">
                  {["Operator", "P", "A", "HD", "L", "WO", "Worked", "Overtime", "Late"].map((hd, i) => (
                    <th
                      key={hd}
                      className={cn(
                        "px-3 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider",
                        i === 0 ? "text-left" : "text-right"
                      )}
                    >
                      {hd}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.operatorId} className="border-b border-industrial-border/40 hover:bg-industrial-hover transition-colors">
                    <td className="px-3 py-2.5 text-xs font-medium text-white">{r.operatorName}</td>
                    <td className="px-3 py-2.5 text-xs text-right text-status-running">{r.present}</td>
                    <td className={cn("px-3 py-2.5 text-xs text-right", r.absent ? "text-status-down" : "text-muted-foreground")}>{r.absent}</td>
                    <td className="px-3 py-2.5 text-xs text-right text-muted-foreground">{r.halfDay}</td>
                    <td className="px-3 py-2.5 text-xs text-right text-muted-foreground">{r.leave}</td>
                    <td className="px-3 py-2.5 text-xs text-right text-muted-foreground">{r.weeklyOff}</td>
                    <td className="px-3 py-2.5 text-xs text-right text-white">{h(r.workedMin)}</td>
                    <td className={cn("px-3 py-2.5 text-xs text-right font-medium", r.otMin > 0 ? "text-status-warning" : "text-muted-foreground")}>{h(r.otMin)}</td>
                    <td className={cn("px-3 py-2.5 text-xs text-right", r.lateCount > 0 ? "text-status-warning" : "text-muted-foreground")}>
                      {r.lateCount > 0 ? `${r.lateCount} (${r.lateMin}m)` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-industrial-border bg-industrial-surface/40">
                  <td className="px-3 py-2.5 text-xs font-semibold text-white">Total</td>
                  <td colSpan={5} />
                  <td className="px-3 py-2.5 text-xs text-right font-semibold text-white">{h(totals.workedMin)}</td>
                  <td className="px-3 py-2.5 text-xs text-right font-semibold text-status-warning">{h(totals.otMin)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground/70">
        P present · A absent · HD half day · L leave · WO weekly off. Overtime counts the HR override when one is set,
        otherwise the automatic value. Salary is calculated from these figures in the salary step.
      </p>
    </div>
  );
}

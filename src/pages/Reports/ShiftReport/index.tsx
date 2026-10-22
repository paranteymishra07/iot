import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FileText, Download, Calendar, BarChart3, ChevronRight, Info, Factory } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from "recharts";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { api } from "@/lib/api";
import { usePlantScope } from "@/hooks/usePlantScope";
import { cn, achievementPct } from "@/lib/utils";
import { toast } from "sonner";

interface MachineShiftRow {
  machineId: string;
  machineName: string;
  units: number;
  goodUnits: number;
  rejects: number;
  rejectRate: number;
  target: number;
  achievement: number;
  oee: number;
  availability: number;
  performance: number;
  quality: number;
  energyKwh: number;
  temperature: number;
}

interface ShiftReportRow {
  date: string;
  shiftId: string;
  shiftCode: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  windowLabel: string;
  durationMin: number;
  machines: number;
  plannedMachines: number;
  units: number;
  goodUnits: number;
  rejects: number;
  rejectRate: number;
  target: number;
  achievement: number;
  oee: number;
  availability: number;
  performance: number;
  quality: number;
  downtimeMin: number;
  energyKwh: number;
  temperature: number;
  machineRows: MachineShiftRow[];
}

interface ShiftReport {
  plant: { id: string; name: string };
  from: string;
  to: string;
  hourAligned: boolean;
  hasData: boolean;
  shifts: { id: string; code: string; name: string; startTime: string; endTime: string; crossesMidnight: boolean; durationMin: number }[];
  rows: ShiftReportRow[];
  totals: {
    units: number;
    goodUnits: number;
    rejects: number;
    target: number;
    achievement: number;
    oee: number;
    availability: number;
    performance: number;
    quality: number;
    downtimeMin: number;
    energyKwh: number;
    shifts: number;
  };
}

type ExportFormat = "PDF" | "Excel" | "CSV";

const OEE_COLOR = (v: number) => (v >= 85 ? "#22c55e" : v >= 65 ? "#f59e0b" : "#ef4444");
const BAR_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#06b6d4", "#ec4899"];

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

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m) - 1]} ${y}`;
}

function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

const PRESETS: { id: string; label: string; build: () => { from: string; to: string } }[] = [
  { id: "today", label: "Today", build: () => ({ from: ymd(new Date()), to: ymd(new Date()) }) },
  { id: "yesterday", label: "Yesterday", build: () => ({ from: ymd(addDays(new Date(), -1)), to: ymd(addDays(new Date(), -1)) }) },
  { id: "week", label: "This Week", build: () => ({ from: ymd(startOfWeek(new Date())), to: ymd(addDays(startOfWeek(new Date()), 6)) }) },
  { id: "last7", label: "Last 7 Days", build: () => ({ from: ymd(addDays(new Date(), -6)), to: ymd(new Date()) }) },
  { id: "last30", label: "Last 30 Days", build: () => ({ from: ymd(addDays(new Date(), -29)), to: ymd(new Date()) }) },
];

export default function ShiftReportPage() {
  const { canManage, availablePlants, plantId, setPlantId, plant } = usePlantScope();
  const [searchParams, setSearchParams] = useSearchParams();

  const [preset, setPreset] = useState("last7");
  const [from, setFrom] = useState(() => ymd(addDays(new Date(), -6)));
  const [to, setTo] = useState(() => ymd(new Date()));
  const [shiftFilter, setShiftFilter] = useState("all");
  const [report, setReport] = useState<ShiftReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ShiftReportRow | null>(null);

  const load = async () => {
    if (!plantId) return;
    setLoading(true);
    try {
      const res = await api.get<ShiftReport>("/shift-reports", { params: { plantId, from, to } });
      setReport(res.data);
    } catch (err: any) {
      setReport(null);
      toast.error(err?.response?.data?.error || "Failed to generate shift report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!plantId) return;
    setSelected(null);
    load();
  }, [plantId, from, to]);

  const rows = useMemo(() => {
    if (!report) return [];
    const withData = report.rows.filter((r) => r.machines > 0);
    const filtered = shiftFilter === "all" ? withData : withData.filter((r) => r.shiftId === shiftFilter);
    return [...filtered].sort((a, b) => (a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date)));
  }, [report, shiftFilter]);

  const chartData = useMemo(() => {
    const map = new Map<string, { shift: string; units: number; oee: number; target: number }>();
    for (const r of rows) {
      const key = r.shiftCode;
      const prev = map.get(key) || { shift: key, units: 0, oee: 0, target: 0 };
      map.set(key, { shift: key, units: prev.units + r.units, oee: Math.max(prev.oee, r.oee), target: prev.target + r.target });
    }
    return Array.from(map.values());
  }, [rows]);

  const csvEscape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const exportRows = () =>
    rows.map((r) => ({
      Date: r.date,
      Shift: `${r.shiftCode} - ${r.shiftName}`,
      Window: r.windowLabel,
      "Duration (min)": r.durationMin,
      Machines: `${r.machines}/${r.plannedMachines}`,
      Target: r.target,
      Produced: r.units,
      "Good Units": r.goodUnits,
      Rejects: r.rejects,
      "Reject Rate %": r.rejectRate,
      "Achievement %": r.achievement,
      OEE: r.oee,
      Availability: r.availability,
      Performance: r.performance,
      Quality: r.quality,
      "Downtime (min)": r.downtimeMin,
      "Energy (kWh)": r.energyKwh,
      "Avg Temp (C)": r.temperature,
    }));

  const fileStamp = `${from}_to_${to}`;

  const exportCsv = () => {
    const data = exportRows();
    const headers = data.length > 0 ? Object.keys(data[0]) : ["Date", "Shift"];
    const lines = [headers.join(","), ...data.map((row) => headers.map((h) => csvEscape((row as Record<string, unknown>)[h])).join(","))];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shift-report_${fileStamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  };

  const exportExcel = () => {
    const data = exportRows();
    const sheet = XLSX.utils.json_to_sheet(data);
    sheet["!cols"] = Object.keys(data[0] || { Date: "" }).map(() => ({ wch: 14 }));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Shift Report");
    XLSX.writeFile(book, `shift-report_${fileStamp}.xlsx`);
    toast.success("Excel downloaded");
  };

  const exportPdf = () => {
    const data = exportRows();
    const headers = ["Date", "Shift", "Window", "Target", "Produced", "Rejects", "Ach %", "OEE", "Avail", "Perf", "Qual", "DT (min)", "kWh"];
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const colWidth = (pageWidth - 40) / headers.length;

    doc.setFontSize(14);
    doc.text(`Shift-wise Performance Report — ${plant?.name ?? ""}`, 20, 24);
    doc.setFontSize(9);
    doc.text(`Range: ${fmtDate(from)} to ${fmtDate(to)}   ·   Generated: ${new Date().toLocaleString()}`, 20, 38);

    let y = 56;
    doc.setFontSize(8);
    doc.setFillColor(22, 27, 46);
    doc.rect(20, y - 10, pageWidth - 40, 16, "F");
    doc.setTextColor(241, 245, 249);
    headers.forEach((h, i) => doc.text(h, 22 + i * colWidth, y + 1));
    doc.setTextColor(0, 0, 0);
    y += 20;

    for (const row of data) {
      if (y > doc.internal.pageSize.getHeight() - 30) {
        doc.addPage();
        y = 30;
      }
      const values = [
        row.Date,
        row.Shift,
        row.Window,
        row.Target,
        row.Produced,
        row.Rejects,
        row["Achievement %"],
        row.OEE,
        row.Availability,
        row.Performance,
        row.Quality,
        row["Downtime (min)"],
        row["Energy (kWh)"],
      ];
      values.forEach((v, i) => doc.text(String(v), 22 + i * colWidth, y));
      doc.setDrawColor(230, 230, 230);
      doc.line(20, y + 4, pageWidth - 20, y + 4);
      y += 14;
    }

    doc.save(`shift-report_${fileStamp}.pdf`);
    toast.success("PDF downloaded");
  };

  // /reports/shift?format=CSV arrives from the Reports page export buttons.
  // The ref guards StrictMode's double-invoke, and re-arms once the param is
  // cleared so a later visit from the catalog exports again.
  const exportedRef = useRef(false);
  useEffect(() => {
    const format = searchParams.get("format") as ExportFormat | null;
    if (!format) {
      exportedRef.current = false;
      return;
    }
    if (!report || loading || exportedRef.current) return;
    exportedRef.current = true;
    if (format === "CSV") exportCsv();
    else if (format === "Excel") exportExcel();
    else if (format === "PDF") exportPdf();
    const next = new URLSearchParams(searchParams);
    next.delete("format");
    setSearchParams(next, { replace: true });
  }, [report, loading, searchParams]);

  if (!canManage) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Shift reports are available to super admin, OEM admin and plant manager roles</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Shift-wise Performance Report</h1>
          <p className="text-xs text-muted-foreground">Production, OEE, downtime and energy per shift · {plant?.name}</p>
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
          {rows.length > 0 && (
            <>
              <button onClick={exportCsv} className="flex items-center gap-1.5 text-[11px] font-medium text-brand-accent border border-brand-accent/40 hover:bg-brand-accent/10 px-3 py-2 rounded-md transition-colors">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
              <button onClick={exportExcel} className="flex items-center gap-1.5 text-[11px] font-medium text-status-running border border-status-running/40 hover:bg-status-running/10 px-3 py-2 rounded-md transition-colors">
                <Download className="w-3.5 h-3.5" /> Excel
              </button>
              <button onClick={exportPdf} className="flex items-center gap-1.5 text-[11px] font-medium text-status-down border border-status-down/40 hover:bg-status-down/10 px-3 py-2 rounded-md transition-colors">
                <Download className="w-3.5 h-3.5" /> PDF
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="industrial-card p-3 flex flex-wrap items-end gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5 flex items-center gap-1.5">
            <Calendar className="w-3 h-3" /> Quick Range
          </p>
          <div className="flex gap-1">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setPreset(p.id);
                  setFrom(p.build().from);
                  setTo(p.build().to);
                }}
                className={cn(
                  "px-2.5 py-1.5 rounded text-[11px] transition-colors",
                  preset === p.id ? "bg-brand-primary/20 text-brand-primary" : "text-muted-foreground hover:text-white hover:bg-industrial-hover"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1 block">From</label>
          <input type="date" value={from} max={to} onChange={(e) => { setPreset(""); setFrom(e.target.value); }} className="bg-industrial-surface border border-industrial-border rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-primary" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1 block">To</label>
          <input type="date" value={to} min={from} max={ymd(new Date())} onChange={(e) => { setPreset(""); setTo(e.target.value); }} className="bg-industrial-surface border border-industrial-border rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-primary" />
        </div>
        {report && report.shifts.length > 0 && (
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1 block">Shift</label>
            <select value={shiftFilter} onChange={(e) => setShiftFilter(e.target.value)} className="bg-industrial-surface border border-industrial-border rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-primary">
              <option value="all">All shifts</option>
              {report.shifts.map((s) => (
                <option key={s.id} value={s.id}>{s.code} · {s.startTime}–{s.endTime}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex-1" />
        <span className="text-[10px] text-muted-foreground">
          {report ? `${rows.length} shift row(s) · ${fmtDate(from)} → ${fmtDate(to)}` : "—"}
        </span>
      </div>

      {!plant && <div className="industrial-card p-8 text-center text-xs text-muted-foreground">No plant available for your role</div>}

      {plant && loading && (
        <div className="industrial-card p-8 text-center text-xs text-muted-foreground">Generating report…</div>
      )}

      {plant && !loading && report && (
        <>
          {report.shifts.length === 0 ? (
            <div className="industrial-card p-8 text-center text-xs text-muted-foreground">
              No shifts configured for {plant.name}. Define shifts under Shift Management first.
            </div>
          ) : rows.length === 0 ? (
            <div className="industrial-card p-8 text-center text-xs text-muted-foreground">
              No shift data recorded for this range
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="grid grid-cols-6 gap-3">
                <div className="industrial-card p-3">
                  <div className="text-lg font-mono font-bold text-white">{report.totals.units.toLocaleString()}</div>
                  <div className="text-[10px] text-muted-foreground">Units produced</div>
                </div>
                <div className="industrial-card p-3">
                  <div className="text-lg font-mono font-bold" style={{ color: OEE_COLOR(report.totals.oee) }}>{report.totals.oee.toFixed(1)}%</div>
                  <div className="text-[10px] text-muted-foreground">Average OEE</div>
                </div>
                <div className="industrial-card p-3">
                  <div className="text-lg font-mono font-bold text-brand-primary">{achievementPct(report.totals.units, report.totals.target).toFixed(1)}%</div>
                  <div className="text-[10px] text-muted-foreground">Achievement vs target</div>
                </div>
                <div className="industrial-card p-3">
                  <div className="text-lg font-mono font-bold text-status-idle">{fmtDuration(report.totals.downtimeMin)}</div>
                  <div className="text-[10px] text-muted-foreground">Downtime (est.)</div>
                </div>
                <div className="industrial-card p-3">
                  <div className="text-lg font-mono font-bold text-status-running">{report.totals.energyKwh.toFixed(1)}</div>
                  <div className="text-[10px] text-muted-foreground">Energy (kWh)</div>
                </div>
                <div className="industrial-card p-3">
                  <div className="text-lg font-mono font-bold text-status-down">{report.totals.rejects.toLocaleString()}</div>
                  <div className="text-[10px] text-muted-foreground">Rejects</div>
                </div>
              </div>

              {/* Chart */}
              <div className="industrial-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="w-4 h-4 text-brand-primary" />
                  <h3 className="text-sm font-semibold text-white">Output by shift</h3>
                  <span className="text-[10px] text-muted-foreground ml-auto">target {report.totals.target.toLocaleString()} units</span>
                </div>
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2540" />
                    <XAxis dataKey="shift" tick={{ fill: "#6b7280", fontSize: 10 }} />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: "#161b2e", border: "1px solid #1e2540", borderRadius: "6px", fontSize: "11px" }} />
                    <Bar dataKey="units" name="Produced" radius={[2, 2, 0, 0]}>
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Shift rows */}
              <div className="industrial-card">
                <div className="px-4 py-3 border-b border-industrial-border flex items-center gap-2">
                  <FileText className="w-4 h-4 text-brand-primary" />
                  <h3 className="text-sm font-semibold text-white">Shift Scorecard</h3>
                  <span className="text-[10px] text-muted-foreground">Click a row for the per-machine breakdown</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1000px]">
                    <thead>
                      <tr className="border-b border-industrial-border">
                        {["Date", "Shift", "Window", "Machines", "Target", "Produced", "Good", "Rejects", "Reject %", "Ach %", "OEE", "Avail", "Perf", "Qual", "Downtime", "Energy", ""].map((h) => (
                          <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr
                          key={`${r.date}-${r.shiftId}`}
                          onClick={() => setSelected(selected?.shiftId === r.shiftId && selected.date === r.date ? null : r)}
                          className={cn(
                            "border-b border-industrial-border/40 transition-colors cursor-pointer",
                            selected?.shiftId === r.shiftId && selected.date === r.date ? "bg-industrial-hover" : "hover:bg-industrial-hover/50"
                          )}
                        >
                          <td className="px-3 py-2.5 font-mono text-xs text-white whitespace-nowrap">{fmtDate(r.date)}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold font-mono text-brand-primary">{r.shiftCode}</span>
                              <span className="text-xs text-white whitespace-nowrap">{r.shiftName}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground whitespace-nowrap">{r.windowLabel}</td>
                          <td className="px-3 py-2.5 font-mono text-xs text-white">{r.machines}/{r.plannedMachines}</td>
                          <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{r.target.toLocaleString()}</td>
                          <td className="px-3 py-2.5 font-mono text-xs font-bold text-white">{r.units.toLocaleString()}</td>
                          <td className="px-3 py-2.5 font-mono text-xs text-status-running">{r.goodUnits.toLocaleString()}</td>
                          <td className="px-3 py-2.5 font-mono text-xs text-status-idle">{r.rejects.toLocaleString()}</td>
                          <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{r.rejectRate.toFixed(1)}%</td>
                          <td className="px-3 py-2.5 font-mono text-xs text-brand-primary">{r.achievement.toFixed(1)}%</td>
                          <td className="px-3 py-2.5 font-mono text-xs font-bold" style={{ color: OEE_COLOR(r.oee) }}>{r.oee.toFixed(1)}%</td>
                          <td className="px-3 py-2.5 font-mono text-xs text-white">{r.availability.toFixed(1)}%</td>
                          <td className="px-3 py-2.5 font-mono text-xs text-white">{r.performance.toFixed(1)}%</td>
                          <td className="px-3 py-2.5 font-mono text-xs text-white">{r.quality.toFixed(1)}%</td>
                          <td className="px-3 py-2.5 font-mono text-xs text-status-down">{fmtDuration(r.downtimeMin)}</td>
                          <td className="px-3 py-2.5 font-mono text-xs text-status-idle">{r.energyKwh.toFixed(1)}</td>
                          <td className="px-3 py-2.5"><ChevronRight className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", selected?.shiftId === r.shiftId && selected.date === r.date && "rotate-90")} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Per-machine drill-down */}
              {selected && (
                <div className="industrial-card">
                  <div className="px-4 py-3 border-b border-industrial-border flex items-center gap-2">
                    <Factory className="w-4 h-4 text-brand-primary" />
                    <h3 className="text-sm font-semibold text-white">
                      {selected.shiftCode} · {fmtDate(selected.date)}
                    </h3>
                    <span className="text-[10px] text-muted-foreground">{selected.windowLabel} · {fmtDuration(selected.durationMin)}</span>
                    <button onClick={() => setSelected(null)} className="ml-auto text-[11px] text-muted-foreground hover:text-white transition-colors">Close</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px]">
                      <thead>
                        <tr className="border-b border-industrial-border">
                          {["Machine", "Target", "Produced", "Good", "Rejects", "Ach %", "OEE", "Avail", "Perf", "Qual", "kWh", "Temp"].map((h) => (
                            <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {selected.machineRows.map((m) => (
                          <tr key={m.machineId} className="border-b border-industrial-border/40 hover:bg-industrial-hover transition-colors">
                            <td className="px-3 py-2.5 text-xs font-semibold text-white">{m.machineName}</td>
                            <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{m.target.toLocaleString()}</td>
                            <td className="px-3 py-2.5 font-mono text-xs font-bold text-white">{m.units.toLocaleString()}</td>
                            <td className="px-3 py-2.5 font-mono text-xs text-status-running">{m.goodUnits.toLocaleString()}</td>
                            <td className="px-3 py-2.5 font-mono text-xs text-status-idle">{m.rejects.toLocaleString()}</td>
                            <td className="px-3 py-2.5 font-mono text-xs text-brand-primary">{m.achievement.toFixed(1)}%</td>
                            <td className="px-3 py-2.5 font-mono text-xs font-bold" style={{ color: OEE_COLOR(m.oee) }}>{m.oee.toFixed(1)}%</td>
                            <td className="px-3 py-2.5 font-mono text-xs text-white">{m.availability.toFixed(1)}%</td>
                            <td className="px-3 py-2.5 font-mono text-xs text-white">{m.performance.toFixed(1)}%</td>
                            <td className="px-3 py-2.5 font-mono text-xs text-white">{m.quality.toFixed(1)}%</td>
                            <td className="px-3 py-2.5 font-mono text-xs text-status-idle">{m.energyKwh.toFixed(1)}</td>
                            <td className="px-3 py-2.5 font-mono text-xs text-white">{m.temperature.toFixed(1)}°</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2 text-[10px] text-muted-foreground/70">
                <Info className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
                <p>
                  Units, rejects and energy are exact sums of the hourly machine history inside each shift window.
                  OEE, availability, performance and quality are the averages of the hourly snapshots taken during the shift, so they reflect the day-to-date ratio at that time.
                  Downtime is estimated from availability against the shift length. Targets assume ideal cycle time, and
                  {report.hourAligned ? " shifts are hour-aligned, so each hour maps to exactly one shift." : " these shifts are not hour-aligned, so boundary hours are attributed to the overlapping shift."}
                </p>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

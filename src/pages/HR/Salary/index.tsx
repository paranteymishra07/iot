import { useEffect, useMemo, useState } from "react";
import {
  Wallet, Play, Download, Trash2, Plus, X, CheckCircle2, AlertTriangle,
  IndianRupee, Clock, Users, FileText, ShieldCheck, Loader2, Eye,
} from "lucide-react";
import { usePlantScope } from "@/hooks/usePlantScope";
import { useSalaryStore } from "@/stores/salaryStore";
import { useUserStore } from "@/stores/userStore";
import { useAuthStore } from "@/stores/authStore";
import type { Payslip, SalaryPreview, SalaryStructure } from "@/types/salary";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const MONTHS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
const rupees = (n: number) =>
  `₹${(Math.round((n || 0) * 100) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const hrs = (min: number) => `${((min || 0) / 60).toFixed(2)}h`;

const STATUS_STYLE: Record<string, string> = {
  draft: "text-muted-foreground border-industrial-border bg-industrial-surface",
  approved: "text-brand-primary border-brand-primary/30 bg-brand-primary/10",
  paid: "text-status-running border-status-running/30 bg-status-running/10",
};

const STRUCTURE_EMPTY = {
  monthlyGross: 20000,
  basicPercent: 50,
  otMultiplier: 1.5,
  effectiveFrom: new Date().toISOString().slice(0, 10),
  deductions: { epf: true, esi: true, professionalTax: true, tds: true },
  taxRegime: "new" as "new" | "old",
  holidayPayMode: "included" as "included" | "extra",
  professionalTaxAmount: 200,
  paidLeave: true,
  active: true,
  notes: "",
};

export default function HrSalaryPage() {
  const { canManage, plant, plantId, availablePlants, setPlantId } = usePlantScope();
  const currentUser = useAuthStore((s) => s.user);
  const { users, fetchUsers, loaded: usersLoaded } = useUserStore();
  const {
    structures, payslips, loadedStructures, loadedPayslips,
    fetchStructures, createStructure, updateStructure, deleteStructure,
    fetchPayslips, runPayroll, previewSalary, setPayslipStatus, deletePayslip,
  } = useSalaryStore();

  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<{ count: number; skipped: { operatorName: string; reason: string }[] } | null>(null);
  const [view, setView] = useState<"payslips" | "structures">("payslips");
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<SalaryStructure | null>(null);
  const [form, setForm] = useState(STRUCTURE_EMPTY);
  const [operatorId, setOperatorId] = useState("");
  const [busy, setBusy] = useState(false);
  const [openPayslip, setOpenPayslip] = useState<Payslip | null>(null);
  const [previewFor, setPreviewFor] = useState("");
  const [preview, setPreview] = useState<SalaryPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (!usersLoaded) fetchUsers().catch(() => {});
  }, [usersLoaded]);

  useEffect(() => {
    if (!plantId || !canManage) return;
    fetchStructures({ plantId }).catch(() => {});
    fetchPayslips({ plantId, month }).catch(() => {});
  }, [plantId, month, canManage]);

  // Structures, payslips and the run summary are plant-scoped, so any detail left
  // on screen from the previous plant must be dropped when the selection changes.
  useEffect(() => {
    setPreview(null);
    setPreviewFor("");
    setOpenPayslip(null);
    setRunResult(null);
  }, [plantId]);

  const operators = useMemo(
    () => users.filter((u) => u.role === "operator" && u.status === "active" && (!plantId || u.plant === plant?.name)),
    [users, plantId, plant]
  );

  // One structure per operator: the newest effectiveFrom wins, matching the
  // backend rule when a revision exists.
  const activeStructureByOperator = useMemo(() => {
    const map = new Map<string, SalaryStructure>();
    for (const s of structures) {
      const current = map.get(s.operatorId);
      if (!current || s.effectiveFrom > current.effectiveFrom) map.set(s.operatorId, s);
    }
    return map;
  }, [structures]);

  const operatorsWithoutSalary = operators.filter((o) => !activeStructureByOperator.has(o.id));

  const monthTotals = useMemo(
    () =>
      payslips.reduce(
        (acc, p) => ({
          gross: acc.gross + p.earnings.grossEarnings,
          epf: acc.epf + p.deductions.epf,
          esi: acc.esi + p.deductions.esi,
          pt: acc.pt + p.deductions.professionalTax,
          tds: acc.tds + p.deductions.tds,
          lop: acc.lop + p.deductions.lop,
          deductions: acc.deductions + p.deductions.total,
          net: acc.net + p.netPay,
          ot: acc.ot + p.attendance.otMin,
        }),
        { gross: 0, epf: 0, esi: 0, pt: 0, tds: 0, lop: 0, deductions: 0, net: 0, ot: 0 }
      ),
    [payslips]
  );

  const operatorsWithSalary = useMemo(
    () => operators.filter((o) => activeStructureByOperator.has(o.id)),
    [operators, activeStructureByOperator]
  );

  // Preview is a dry run for one operator, so HR can check a month against the
  // live attendance before committing a payslip.
  const doPreview = async () => {
    if (!plantId || !previewFor) return;
    setPreviewing(true);
    try {
      setPreview(await previewSalary({ plantId, operatorId: previewFor, month }));
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to preview this month");
      setPreview(null);
    } finally {
      setPreviewing(false);
    }
  };

  const removePayslip = async (id: string) => {
    setBusy(true);
    try {
      await deletePayslip(id);
      setOpenPayslip(null);
      toast.success("Draft payslip deleted");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to delete payslip");
    } finally {
      setBusy(false);
    }
  };

  const doRun = async () => {
    if (!plantId) return;
    setRunning(true);
    setRunResult(null);
    try {
      const res = await runPayroll({ plantId, month, generatedBy: currentUser?.name || "HR" });
      setRunResult({ count: res.count, skipped: res.skipped });
      await fetchPayslips({ plantId, month });
      if (res.skipped.length > 0) {
        toast.warning(`Payroll ran for ${res.count}, ${res.skipped.length} left untouched`);
      } else {
        toast.success(`Payroll generated for ${res.count} operator${res.count === 1 ? "" : "s"}`);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Failed to run payroll";
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  };

  const approveAll = async () => {
    const drafts = payslips.filter((p) => p.status === "draft");
    if (drafts.length === 0) return toast.error("No draft payslips to approve");
    setBusy(true);
    try {
      for (const p of drafts) {
        await setPayslipStatus(p.id, "approved", currentUser?.name || "HR");
      }
      toast.success(`Approved ${drafts.length} payslip${drafts.length === 1 ? "" : "s"}`);
    } catch {
      toast.error("Failed to approve every payslip");
    } finally {
      setBusy(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(STRUCTURE_EMPTY);
    setOperatorId(operatorsWithoutSalary[0]?.id || operators[0]?.id || "");
    setDialog(true);
  };

  const openEdit = (s: SalaryStructure) => {
    setEditing(s);
    setOperatorId(s.operatorId);
    setForm({
      monthlyGross: s.monthlyGross,
      basicPercent: s.basicPercent,
      otMultiplier: s.otMultiplier,
      effectiveFrom: s.effectiveFrom,
      deductions: s.deductions,
      taxRegime: s.taxRegime,
      holidayPayMode: s.holidayPayMode,
      professionalTaxAmount: s.professionalTaxAmount,
      paidLeave: s.paidLeave,
      active: s.active,
      notes: s.notes,
    });
    setDialog(true);
  };

  const saveStructure = async () => {
    if (!form.monthlyGross || form.monthlyGross <= 0) return toast.error("Enter a monthly gross above zero");
    if (!editing && !operatorId) return toast.error("Choose an operator");
    setBusy(true);
    try {
      if (editing) {
        await updateStructure(editing.id, form);
        toast.success("Salary structure updated");
      } else {
        await createStructure({ ...form, plantId, operatorId });
        toast.success("Salary structure created");
      }
      setDialog(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to save salary structure");
    } finally {
      setBusy(false);
    }
  };

  const removeStructure = async (s: SalaryStructure) => {
    setBusy(true);
    try {
      await deleteStructure(s.id);
      toast.success("Salary structure removed");
    } catch {
      toast.error("Failed to remove salary structure");
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    if (payslips.length === 0) return toast.error("No payslips to export");
    const head = [
      "Operator", "Present", "Absent", "Paid Leave", "Unpaid Leave", "Paid Holidays",
      "Worked Hours", "Overtime Hours", "Monthly Pay", "OT Amount", "Holiday Pay", "Bonus",
      "Gross Earnings", "LOP", "EPF", "ESI", "Professional Tax", "TDS", "Other", "Total Deductions", "Net Pay", "Status",
    ];
    const body = payslips.map((p) => [
      p.operatorName, p.attendance.presentDays, p.attendance.absentDays, p.attendance.paidLeaveDays,
      p.attendance.unpaidLeaveDays, p.attendance.paidHolidayDays,
      hrs(p.attendance.workedMin), hrs(p.attendance.otMin),
      p.earnings.monthlyPay, p.earnings.otAmount, p.earnings.paidHolidayAmount, p.earnings.bonus,
      p.earnings.grossEarnings, p.deductions.lop, p.deductions.epf, p.deductions.esi,
      p.deductions.professionalTax, p.deductions.tds, p.deductions.other, p.deductions.total, p.netPay, p.status,
    ]);
    const csv = [head, ...body]
      .map((line) => line.map((c) => (typeof c === "string" && /[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll-${plant?.name ?? "plant"}-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Payroll exported");
  };

  if (!canManage) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground text-xs">Salary management is available to HR and plant managers</p>
      </div>
    );
  }

  const stat = (icon: React.ReactNode, label: string, value: string, tone?: string) => (
    <div className="industrial-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-[10px] uppercase tracking-wider font-semibold">{label}</span>
      </div>
      <p className={cn("text-lg font-bold text-white mt-1.5 font-mono", tone)}>{value}</p>
    </div>
  );

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Manage Salary</h1>
          <p className="text-xs text-muted-foreground">Payroll for {plant?.name}</p>
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
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
          >
            {MONTHS.map((m) => {
              const value = `${now.getFullYear()}-${m}`;
              return <option key={m} value={value}>{value}</option>;
            })}
          </select>
          <div className="flex items-center gap-2">
            {operatorsWithSalary.length > 0 && (
              <>
                <select
                  value={previewFor}
                  onChange={(e) => { setPreviewFor(e.target.value); setPreview(null); }}
                  className="bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
                >
                  <option value="">Check an operator...</option>
                  {operatorsWithSalary.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
                <button
                  onClick={doPreview}
                  disabled={!previewFor || previewing}
                  title="Dry run for one operator against current attendance, saves nothing"
                  className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground border border-industrial-border hover:text-white hover:border-brand-primary/40 px-3 py-2 rounded-md transition-colors disabled:opacity-50"
                >
                  {previewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                  Preview
                </button>
              </>
            )}
            <button
              onClick={doRun}
              disabled={running}
              className="flex items-center gap-1.5 text-[11px] font-medium text-brand-primary border border-brand-primary/40 hover:bg-brand-primary/10 px-3 py-2 rounded-md transition-colors disabled:opacity-50"
            >
              {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              {running ? "Running..." : "Run Payroll"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-industrial-border">
        {([["payslips", "Payslips"], ["structures", "Salary Structures"]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={cn(
              "text-xs px-3 py-2 border-b-2 -mb-px transition-colors",
              view === key
                ? "border-brand-primary text-brand-primary font-medium"
                : "border-transparent text-muted-foreground hover:text-white"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "payslips" ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {stat(<IndianRupee className="w-3.5 h-3.5" />, "Gross Earnings", rupees(monthTotals.gross))}
            {stat(<Wallet className="w-3.5 h-3.5" />, "Net Payable", rupees(monthTotals.net), "text-status-running")}
            {stat(<ShieldCheck className="w-3.5 h-3.5" />, "EPF + ESI + PT", rupees(monthTotals.epf + monthTotals.esi + monthTotals.pt))}
            {stat(<Clock className="w-3.5 h-3.5" />, "Overtime Hours", hrs(monthTotals.ot), monthTotals.ot > 0 ? "text-status-warning" : undefined)}
          </div>

          {runResult && (
            <div className="industrial-card p-3 flex items-start gap-2 text-[10px]">
              <CheckCircle2 className="w-3.5 h-3.5 text-status-running flex-shrink-0 mt-px" />
              <div className="text-muted-foreground">
                <span className="text-status-running font-medium">{runResult.count}</span> draft payslip(s) built for {month} from current attendance.
                {runResult.skipped.length > 0 && (
                  <span className="block mt-1 text-status-warning">
                    Untouched: {runResult.skipped.map((s) => `${s.operatorName} (${s.reason})`).join(", ")}
                  </span>
                )}
              </div>
            </div>
          )}

          {preview && (
            <div className="industrial-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-white">
                    Dry run for {preview.operatorName} · {preview.month}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {preview.calculation.daysInMonth} days, daily wage {rupees(preview.calculation.dailyWage)},
                    hourly {rupees(preview.calculation.hourlyRate)}. Nothing was saved.
                  </p>
                </div>
                <button onClick={() => setPreview(null)} className="text-muted-foreground hover:text-white flex-shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {preview.calculation.warnings.length > 0 && (
                <div className="space-y-1">
                  {preview.calculation.warnings.map((w, i) => (
                    <p key={i} className="flex items-start gap-1.5 text-[10px] text-status-warning">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-px" /> {w}
                    </p>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-industrial-surface rounded-md">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Gross</p>
                  <p className="text-sm font-bold text-white font-mono mt-1">{rupees(preview.calculation.earnings.grossEarnings)}</p>
                </div>
                <div className="p-3 bg-industrial-surface rounded-md">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Deductions</p>
                  <p className="text-sm font-bold text-status-down font-mono mt-1">{rupees(preview.calculation.deductions.total)}</p>
                </div>
                <div className="p-3 bg-industrial-surface rounded-md">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Net Pay</p>
                  <p className="text-sm font-bold text-status-running font-mono mt-1">{rupees(preview.calculation.netPay)}</p>
                </div>
                <div className="p-3 bg-industrial-surface rounded-md">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Overtime</p>
                  <p className="text-sm font-bold text-white font-mono mt-1">{hrs(preview.calculation.attendance.otMin)}</p>
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground">
                EPF {rupees(preview.calculation.deductions.epf)} · ESI {rupees(preview.calculation.deductions.esi)} ·
                PT {rupees(preview.calculation.deductions.professionalTax)} · TDS {rupees(preview.calculation.deductions.tds)} ·
                LOP {rupees(preview.calculation.deductions.lop)}
              </p>
            </div>
          )}

          {operatorsWithoutSalary.length > 0 && (
            <div className="industrial-card p-3 flex items-start gap-2 text-[10px] text-status-warning">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
              <span>
                {operatorsWithoutSalary.length} active operator(s) in {plant?.name} have no salary structure, so they
                are skipped by the run: {operatorsWithoutSalary.map((o) => o.name).join(", ")}
              </span>
            </div>
          )}

          <div className="industrial-card">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-industrial-border">
              <span className="text-xs font-medium text-white">
                {month} · {payslips.length} payslip{payslips.length === 1 ? "" : "s"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={approveAll}
                  disabled={busy || payslips.every((p) => p.status !== "draft")}
                  className="flex items-center gap-1.5 text-[10px] text-brand-primary border border-brand-primary/40 hover:bg-brand-primary/10 px-2.5 py-1.5 rounded-md transition-colors disabled:opacity-40"
                >
                  <CheckCircle2 className="w-3 h-3" /> Approve All Drafts
                </button>
                <button
                  onClick={exportCsv}
                  className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-white border border-industrial-border hover:bg-industrial-hover px-2.5 py-1.5 rounded-md transition-colors"
                >
                  <Download className="w-3 h-3" /> CSV
                </button>
              </div>
            </div>

            {payslips.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <FileText className="w-6 h-6 text-muted-foreground mx-auto" />
                <p className="text-xs text-white">No payslips for {month}</p>
                <p className="text-[10px] text-muted-foreground">
                  Mark attendance first, then run payroll for this month.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[940px]">
                  <thead>
                    <tr className="border-b border-industrial-border">
                      {["Operator", "Days P/A/L/H", "Worked", "OT", "Gross", "LOP", "EPF", "ESI", "PT", "TDS", "Net Pay", "Status", ""].map((h, i) => (
                        <th
                          key={h || i}
                          className={cn(
                            "px-3 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider",
                            i === 0 || h === "" ? "text-left" : "text-right"
                          )}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {payslips.map((p) => (
                      <tr key={p.id} className="border-b border-industrial-border/40 hover:bg-industrial-hover transition-colors">
                        <td className="px-3 py-2.5">
                          <button onClick={() => setOpenPayslip(p)} className="text-xs font-medium text-white hover:text-brand-primary transition-colors text-left">
                            {p.operatorName}
                          </button>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-right text-muted-foreground font-mono">
                          {p.attendance.presentDays}/{p.attendance.absentDays}/{p.attendance.paidLeaveDays}/{p.attendance.paidHolidayDays}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-right text-muted-foreground font-mono">{hrs(p.attendance.workedMin)}</td>
                        <td className={cn("px-3 py-2.5 text-xs text-right font-mono", p.attendance.otMin > 0 ? "text-status-warning" : "text-muted-foreground")}>
                          {hrs(p.attendance.otMin)}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-right text-white font-mono">{rupees(p.earnings.grossEarnings)}</td>
                        <td className={cn("px-3 py-2.5 text-xs text-right font-mono", p.deductions.lop > 0 ? "text-status-down" : "text-muted-foreground")}>
                          {p.deductions.lop > 0 ? rupees(p.deductions.lop) : "-"}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-right text-muted-foreground font-mono">{p.deductions.epf > 0 ? rupees(p.deductions.epf) : "-"}</td>
                        <td className="px-3 py-2.5 text-xs text-right text-muted-foreground font-mono">{p.deductions.esi > 0 ? rupees(p.deductions.esi) : "-"}</td>
                        <td className="px-3 py-2.5 text-xs text-right text-muted-foreground font-mono">{p.deductions.professionalTax > 0 ? rupees(p.deductions.professionalTax) : "-"}</td>
                        <td className="px-3 py-2.5 text-xs text-right text-muted-foreground font-mono">{p.deductions.tds > 0 ? rupees(p.deductions.tds) : "-"}</td>
                        <td className="px-3 py-2.5 text-xs text-right font-semibold text-status-running font-mono">{rupees(p.netPay)}</td>
                        <td className="px-3 py-2.5">
                          <span className={cn("text-[10px] px-2 py-0.5 rounded border font-medium", STATUS_STYLE[p.status])}>
                            {p.status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-end gap-1.5">
                            {p.status === "draft" && (
                              <button
                                onClick={() => setPayslipStatus(p.id, "approved", currentUser?.name || "HR").then(() => toast.success("Payslip approved"))}
                                className="text-[10px] text-brand-primary hover:underline"
                              >
                                Approve
                              </button>
                            )}
                            {p.status === "approved" && (
                              <button
                                onClick={() => setPayslipStatus(p.id, "paid").then(() => toast.success("Marked paid"))}
                                className="text-[10px] text-status-running hover:underline"
                              >
                                Mark Paid
                              </button>
                            )}
                            {p.status === "draft" && (
                              <button
                                onClick={() => removePayslip(p.id)}
                                disabled={busy}
                                title="Delete this draft"
                                className="text-muted-foreground hover:text-status-down transition-colors disabled:opacity-50"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-industrial-border bg-industrial-surface/40">
                      <td className="px-3 py-2.5 text-xs font-semibold text-white">Total</td>
                      <td colSpan={3} />
                      <td className="px-3 py-2.5 text-xs text-right font-semibold text-white font-mono">{rupees(monthTotals.gross)}</td>
                      <td className="px-3 py-2.5 text-xs text-right font-semibold text-status-down font-mono">{monthTotals.lop > 0 ? rupees(monthTotals.lop) : "-"}</td>
                      <td className="px-3 py-2.5 text-xs text-right font-semibold text-white font-mono">{rupees(monthTotals.epf)}</td>
                      <td className="px-3 py-2.5 text-xs text-right font-semibold text-white font-mono">{rupees(monthTotals.esi)}</td>
                      <td className="px-3 py-2.5 text-xs text-right font-semibold text-white font-mono">{rupees(monthTotals.pt)}</td>
                      <td className="px-3 py-2.5 text-xs text-right font-semibold text-white font-mono">{rupees(monthTotals.tds)}</td>
                      <td className="px-3 py-2.5 text-xs text-right font-semibold text-status-running font-mono">{rupees(monthTotals.net)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
            EPF 12% of basic (capped at 12% of 15000) · ESI 0.75% of gross wages, skipped above the 15000 ceiling, capped at
            170 · Professional tax is a flat monthly slab · TDS is the monthly twelfth of the annualised income tax under the
            selected regime. Loss of pay covers unexcused absence and unpaid leave only; unmarked days are never deducted.
            Overtime pays at the structure multiplier and is excluded from the PF/ESI wage base.
          </p>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {activeStructureByOperator.size} of {operators.length} active operator(s) have a salary structure
            </p>
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 text-[11px] font-medium text-brand-primary border border-brand-primary/40 hover:bg-brand-primary/10 px-3 py-2 rounded-md transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> {editing ? "Edit Structure" : "Add Structure"}
            </button>
          </div>

          <div className="industrial-card">
            {structures.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <Wallet className="w-6 h-6 text-muted-foreground mx-auto" />
                <p className="text-xs text-white">No salary structures yet</p>
                <p className="text-[10px] text-muted-foreground">
                  Set a monthly gross per operator, then run payroll.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px]">
                  <thead>
                    <tr className="border-b border-industrial-border">
                      {["Operator", "Monthly Gross", "Basic %", "PF Base", "OT Rate", "From", "EPF", "ESI", "PT", "TDS", "Leave", "Holiday", "Actions"].map((h, i) => (
                        <th key={h} className={cn("px-3 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider", i === 0 || h === "Actions" ? "text-left" : "text-right")}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {structures.map((s) => (
                      <tr key={s.id} className="border-b border-industrial-border/40 hover:bg-industrial-hover transition-colors">
                        <td className="px-3 py-2.5 text-xs font-medium text-white">{s.operatorName}</td>
                        <td className="px-3 py-2.5 text-xs text-right text-white font-mono">{rupees(s.monthlyGross)}</td>
                        <td className="px-3 py-2.5 text-xs text-right text-muted-foreground font-mono">{s.basicPercent}%</td>
                        <td className="px-3 py-2.5 text-xs text-right text-muted-foreground font-mono">
                          {rupees(Math.min((s.monthlyGross * s.basicPercent) / 100, 15000))}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-right text-status-warning font-mono">{s.otMultiplier}x</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono">{s.effectiveFrom}</td>
                        <td className="px-3 py-2.5 text-xs text-right text-muted-foreground">{s.deductions.epf ? "Y" : "-"}</td>
                        <td className="px-3 py-2.5 text-xs text-right text-muted-foreground">{s.deductions.esi ? "Y" : "-"}</td>
                        <td className="px-3 py-2.5 text-xs text-right text-muted-foreground">
                          {s.deductions.professionalTax ? rupees(s.professionalTaxAmount) : "-"}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-right text-muted-foreground">{s.deductions.tds ? s.taxRegime : "-"}</td>
                        <td className="px-3 py-2.5 text-xs text-right text-muted-foreground">{s.paidLeave ? "Paid" : "Unpaid"}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{s.holidayPayMode === "extra" ? "Extra" : "Included"}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <button onClick={() => openEdit(s)} className="text-[10px] text-brand-primary hover:underline">Edit</button>
                            <button onClick={() => removeStructure(s)} disabled={busy} className="text-muted-foreground hover:text-status-down transition-colors">
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
            <Users className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
            Structures are versioned by effective date. A payroll run always uses the newest structure that was in force on
            the first of the month, so raising a salary mid-month does not silently rewrite an already approved payslip.
          </p>
        </>
      )}

      {dialog && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="industrial-card w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">{editing ? "Edit Salary Structure" : "Add Salary Structure"}</h3>
              <button onClick={() => setDialog(false)} className="text-muted-foreground hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              {!editing && (
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">Operator</label>
                  <select
                    value={operatorId}
                    onChange={(e) => setOperatorId(e.target.value)}
                    className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
                  >
                    {operators.map((o) => (
                      <option key={o.id} value={o.id}>{o.name} ({o.email})</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">Monthly Gross (₹)</label>
                  <input
                    type="number" min={0}
                    value={form.monthlyGross}
                    onChange={(e) => setForm({ ...form, monthlyGross: Number(e.target.value) })}
                    className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">Basic % (for PF)</label>
                  <input
                    type="number" min={0} max={100}
                    value={form.basicPercent}
                    onChange={(e) => setForm({ ...form, basicPercent: Number(e.target.value) })}
                    className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">OT Multiplier</label>
                  <input
                    type="number" min={1} step={0.25}
                    value={form.otMultiplier}
                    onChange={(e) => setForm({ ...form, otMultiplier: Number(e.target.value) })}
                    className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">Effective From</label>
                  <input
                    type="date"
                    value={form.effectiveFrom}
                    onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
                    className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">Tax Regime</label>
                  <select
                    value={form.taxRegime}
                    onChange={(e) => setForm({ ...form, taxRegime: e.target.value as "new" | "old" })}
                    className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
                  >
                    <option value="new">New (FY25-26+)</option>
                    <option value="old">Old</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">Professional Tax (₹)</label>
                  <input
                    type="number" min={0}
                    value={form.professionalTaxAmount}
                    onChange={(e) => setForm({ ...form, professionalTaxAmount: Number(e.target.value) })}
                    className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 block">Statutory Deductions</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ["epf", "EPF 12%"],
                    ["esi", "ESI 0.75%"],
                    ["professionalTax", "Professional Tax"],
                    ["tds", "TDS"],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.deductions[key]}
                        onChange={(e) => setForm({ ...form, deductions: { ...form.deductions, [key]: e.target.checked } })}
                        className="accent-[#00d4aa]"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">Leave Paid</label>
                  <select
                    value={form.paidLeave ? "paid" : "unpaid"}
                    onChange={(e) => setForm({ ...form, paidLeave: e.target.value === "paid" })}
                    className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
                  >
                    <option value="paid">Paid leave</option>
                    <option value="unpaid">Loss of pay</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">Holiday Pay</label>
                  <select
                    value={form.holidayPayMode}
                    onChange={(e) => setForm({ ...form, holidayPayMode: e.target.value as "included" | "extra" })}
                    className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
                  >
                    <option value="included">Included in gross</option>
                    <option value="extra">Paid on top</option>
                  </select>
                </div>
              </div>

              <div className="text-[10px] text-muted-foreground leading-relaxed border border-industrial-border rounded-md p-2.5">
                PF base {rupees(Math.min((form.monthlyGross * form.basicPercent) / 100, 15000))} ·
                {" "}hourly ₹{((form.monthlyGross / (new Date(2026, 8, 1).getDate() * 8)) || 0).toFixed(2)} ·
                {" "}daily ₹{(form.monthlyGross / 30 || 0).toFixed(2)}
                <span className="block mt-1 text-muted-foreground/70">
                  Shown against a 30-day month for reference; the calculator uses the real month length.
                </span>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setDialog(false)} className="text-[11px] px-4 py-2 rounded-md text-muted-foreground hover:text-white transition-colors">
                Cancel
              </button>
              <button
                onClick={saveStructure}
                disabled={busy}
                className="text-[11px] font-medium px-4 py-2 rounded-md bg-brand-primary text-white hover:bg-brand-primary/80 transition-colors disabled:opacity-50"
              >
                {busy ? "Saving..." : editing ? "Save Changes" : "Create Structure"}
              </button>
            </div>
          </div>
        </div>
      )}

      {openPayslip && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setOpenPayslip(null)}>
          <div className="industrial-card w-full max-w-2xl p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white">{openPayslip.operatorName}</h3>
                <p className="text-[10px] text-muted-foreground">Payslip for {openPayslip.month} · {openPayslip.plant}</p>
              </div>
              <button onClick={() => setOpenPayslip(null)} className="text-muted-foreground hover:text-white"><X className="w-4 h-4" /></button>
            </div>

            {openPayslip.status === "draft" && (
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => removePayslip(openPayslip.id)}
                  disabled={busy}
                  className="flex items-center gap-1.5 text-[10px] font-medium text-status-down border border-status-down/40 hover:bg-status-down/10 px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3 h-3" /> Delete draft
                </button>
              </div>
            )}

            {openPayslip.warnings && openPayslip.warnings.length > 0 && (
              <div className="mb-4 space-y-1">
                {openPayslip.warnings.map((w, i) => (
                  <p key={i} className="flex items-start gap-1.5 text-[10px] text-status-warning">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-px" /> {w}
                  </p>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
              <div className="industrial-card p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Attendance</p>
                {([
                  ["Present", openPayslip.attendance.presentDays],
                  ["Half days", openPayslip.attendance.halfDays],
                  ["Absent", openPayslip.attendance.absentDays],
                  ["Paid leave", openPayslip.attendance.paidLeaveDays],
                  ["Unpaid leave", openPayslip.attendance.unpaidLeaveDays],
                  ["Paid holidays", openPayslip.attendance.paidHolidayDays],
                  ["Weekly off", openPayslip.attendance.weeklyOffDays],
                  ["Unmarked days", openPayslip.attendance.unmarkedDays],
                ] as [string, number][]).map(([label, value]) => (
                  <div key={label} className="flex justify-between text-[10px] py-0.5">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="text-white font-mono">{value}</span>
                  </div>
                ))}
              </div>

              <div className="industrial-card p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Earnings</p>
                {([
                  ["Monthly pay", openPayslip.earnings.monthlyPay],
                  ["Overtime", openPayslip.earnings.otAmount],
                  ["Paid holidays", openPayslip.earnings.paidHolidayAmount],
                  ["Bonus", openPayslip.earnings.bonus],
                ] as [string, number][]).map(([label, value]) => (
                  <div key={label} className="flex justify-between text-[10px] py-0.5">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="text-white font-mono">{rupees(value)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-[10px] py-1 mt-1 border-t border-industrial-border">
                  <span className="text-white font-semibold">Gross</span>
                  <span className="text-white font-mono font-semibold">{rupees(openPayslip.earnings.grossEarnings)}</span>
                </div>
              </div>

              <div className="industrial-card p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Deductions</p>
                {([
                  ["Loss of pay", openPayslip.deductions.lop],
                  ["EPF", openPayslip.deductions.epf],
                  ["ESI", openPayslip.deductions.esi],
                  ["Professional tax", openPayslip.deductions.professionalTax],
                  ["TDS", openPayslip.deductions.tds],
                  ["Late policy", openPayslip.deductions.late],
                  ["Other", openPayslip.deductions.other],
                ] as [string, number][]).map(([label, value]) => (
                  <div key={label} className="flex justify-between text-[10px] py-0.5">
                    <span className="text-muted-foreground">{label}</span>
                    <span className={cn("font-mono", value > 0 ? "text-status-down" : "text-muted-foreground")}>
                      {value > 0 ? rupees(value) : "-"}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between text-[10px] py-1 mt-1 border-t border-industrial-border">
                  <span className="text-white font-semibold">Total</span>
                  <span className="text-status-down font-mono font-semibold">{rupees(openPayslip.deductions.total)}</span>
                </div>
              </div>
            </div>

            <div className="industrial-card p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Net Pay</p>
                <p className="text-2xl font-bold text-status-running font-mono mt-0.5">{rupees(openPayslip.netPay)}</p>
              </div>
              <div className="text-right">
                <span className={cn("text-[10px] px-2 py-0.5 rounded border font-medium", STATUS_STYLE[openPayslip.status])}>
                  {openPayslip.status}
                </span>
                {openPayslip.approvedBy && (
                  <p className="text-[10px] text-muted-foreground mt-1">approved by {openPayslip.approvedBy}</p>
                )}
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground/70 mt-3 leading-relaxed">
              Worked {hrs(openPayslip.attendance.workedMin)} with {hrs(openPayslip.attendance.otMin)} of overtime.
              A payslip is a frozen snapshot: re-running payroll replaces drafts only, and an approved or paid month is
              never overwritten.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

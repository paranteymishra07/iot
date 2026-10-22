import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useProductionStore } from "@/stores/productionStore";
import { Activity, LogOut, Clock, Package, Gauge, Wrench, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { LogStatus } from "@/types/production";

const STATUS_CONFIG: Record<LogStatus, { label: string; cls: string; dot: string }> = {
  running: { label: "RUNNING", cls: "text-status-running border-status-running/40 bg-status-running/10", dot: "bg-status-running" },
  idle: { label: "IDLE", cls: "text-status-idle border-status-idle/40 bg-status-idle/10", dot: "bg-status-idle" },
  down: { label: "DOWN", cls: "text-status-down border-status-down/40 bg-status-down/10", dot: "bg-status-down" },
  maintenance: { label: "MAINTENANCE", cls: "text-brand-primary border-brand-primary/40 bg-brand-primary/10", dot: "bg-brand-primary" },
};

const STATUS_OPTIONS: LogStatus[] = ["running", "idle", "down", "maintenance"];

const EFF_COLOR = (v: number) => (v >= 85 ? "text-status-running" : v >= 65 ? "text-status-idle" : "text-status-down");

export default function OperatorPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const { dashboard, fetchDashboard, fetchReasons, reasons, fetchDailySummary, dailySummary, logProduction, setStatus } = useProductionStore();

  const [refreshKey, setRefreshKey] = useState(0);
  const [reasonsByMachine, setReasonsByMachine] = useState<Record<string, string>>({});
  const [reasonError, setReasonError] = useState<Record<string, boolean>>({});

  const operatorId = user?.id || "";

  useEffect(() => {
    if (operatorId) {
      fetchDashboard(operatorId);
      fetchDailySummary(operatorId);
    }
  }, [operatorId, fetchDashboard, fetchDailySummary, refreshKey]);

  useEffect(() => {
    fetchReasons();
  }, [fetchReasons]);

  const assignedMachines = useMemo(() => {
    if (!dashboard?.machines?.length) return [];
    return dashboard.machines;
  }, [dashboard]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleUpdate = async (machineId: string, payload: Record<string, unknown>) => {
    try {
      await logProduction({ machineId, operatorId, ...payload });
      toast.success("Production updated");
      setRefreshKey((k) => k + 1);
    } catch {
      toast.error("Failed to update production");
    }
  };

  const handleStatus = async (machineId: string, status: LogStatus) => {
    if (status !== "running") {
      const reasonId = reasonsByMachine[machineId];
      if (!reasonId) {
        setReasonError((prev) => ({ ...prev, [machineId]: true }));
        toast.error("Select a downtime reason before setting status to idle, down, or maintenance");
        return;
      }
      const reasonObj = reasons.find((r) => r.id === reasonId);
      try {
        await setStatus(machineId, status, reasonId, reasonObj?.label || "");
        toast.success(`Machine set to ${status.toUpperCase()}`);
        setRefreshKey((k) => k + 1);
      } catch {
        toast.error("Failed to update status");
      }
      return;
    }
    try {
      await setStatus(machineId, status);
      toast.success(`Machine set to ${status.toUpperCase()}`);
      setRefreshKey((k) => k + 1);
    } catch {
      toast.error("Failed to update status");
    }
  };

  if (!user || user.role !== "operator") {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-industrial-bg text-white">
        <p className="text-sm text-muted-foreground">Operator access only.</p>
        <button onClick={handleLogout} className="mt-4 text-xs bg-brand-primary px-3 py-2 rounded-md">Back to login</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-industrial-bg text-white">
      {/* Top bar */}
      <header className="h-14 flex items-center justify-between px-5 border-b border-industrial-border bg-[#080b13]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-brand-primary flex items-center justify-center">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold leading-tight">Operator Console</div>
            <div className="text-[10px] text-muted-foreground">{dashboard?.date || "Today"}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <span className="text-xs text-muted-foreground">Shift: {user?.name}</span>
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs bg-industrial-surface border border-industrial-border px-3 py-1.5 rounded-md hover:border-status-down/50 transition-colors">
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-5 space-y-5">
        {/* Day efficiency summary */}
        <section className="industrial-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold">Daily Performance</h2>
            <div className="text-[11px] text-muted-foreground">
              Target: <span className="text-white font-semibold">{dailySummary?.dailyTarget ?? 0}</span> units
            </div>
          </div>
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: "Efficiency", value: dailySummary?.efficiency ?? 0, color: true },
              { label: "Availability", value: dailySummary?.availability ?? 0, color: false },
              { label: "Performance", value: dailySummary?.performance ?? 0, color: false },
              { label: "Quality", value: dailySummary?.quality ?? 0, color: false },
              { label: "Units", value: dailySummary?.totalUnits ?? 0, color: false, raw: true },
            ].map((m) => (
              <div key={m.label} className="text-center">
                <div className={cn("text-2xl font-mono font-bold", m.raw ? "text-white" : m.color ? EFF_COLOR(m.value) : "text-brand-primary")}>
                  {m.raw ? m.value : `${m.value.toFixed(1)}%`}
                </div>
                <div className="text-[11px] text-muted-foreground">{m.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Machines */}
        {assignedMachines.length === 0 ? (
          <div className="industrial-card p-10 text-center">
            <Package className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No machines assigned for today.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Contact your admin to assign machines and set your target.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {assignedMachines.map((m) => {
              const st = STATUS_CONFIG[m.status] || STATUS_CONFIG.running;
              const progress = m.dailyTarget > 0 ? Math.min(100, (m.totalUnits / m.dailyTarget) * 100) : 0;
              return (
                <div key={m.machineId} className="industrial-card p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-bold">{m.machineName}</h3>
                      <p className="text-[11px] text-muted-foreground">{m.line}</p>
                    </div>
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded border flex items-center gap-1.5", st.cls)}>
                      <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse-slow", st.dot)} /> {st.label}
                    </span>
                  </div>

                  {/* Progress */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Target Progress</span>
                      <span className="font-mono">{m.totalUnits} / {m.dailyTarget}</span>
                    </div>
                    <div className="h-2 bg-industrial-surface rounded-full overflow-hidden">
                      <div className="h-full bg-brand-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                    </div>
                  </div>

                  {/* Efficiency */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "Eff", value: m.efficiency },
                      { label: "Avail", value: m.availability },
                      { label: "Perf", value: m.performance },
                      { label: "Qual", value: m.quality },
                    ].map((mb) => (
                      <div key={mb.label} className="text-center">
                        <div className={cn("text-sm font-mono font-bold", EFF_COLOR(mb.value))}>{mb.value.toFixed(1)}%</div>
                        <div className="text-[10px] text-muted-foreground">{mb.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Cycle time vs threshold */}
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Cycle Time</span>
                    <span className="font-mono">
                      {m.cycleTimeSec}s / <span className="text-brand-primary">T {m.cycleTimeThreshold ?? m.cycleTimeSec}s</span>
                    </span>
                  </div>

                  <div className="border-t border-industrial-border pt-3 space-y-2.5">
                    {/* Status toggle */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-[11px] text-muted-foreground mr-1">Status:</span>
                      {STATUS_OPTIONS.map((s) => (
                        <button
                          key={s}
                          onClick={() => handleStatus(m.machineId, s)}
                          className={cn(
                            "text-[10px] font-bold px-2 py-1 rounded border transition-colors",
                            m.status === s
                              ? STATUS_CONFIG[s].cls
                              : "text-muted-foreground border-industrial-border hover:border-industrial-border-light hover:text-white"
                          )}
                        >
                          {STATUS_CONFIG[s].label}
                        </button>
                      ))}
                    </div>

                    {/* Update controls */}
                    <MachineUpdateForm
                      machine={m}
                      reasons={reasons}
                      reason={reasonsByMachine[m.machineId] ?? ""}
                      reasonError={!!reasonError[m.machineId]}
                      onReasonChange={(id) => {
                        setReasonsByMachine((prev) => ({ ...prev, [m.machineId]: id }));
                        if (id) setReasonError((prev) => ({ ...prev, [m.machineId]: false }));
                      }}
                      onSave={(payload) => handleUpdate(m.machineId, payload)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function MachineUpdateForm({
  machine,
  reasons,
  reason,
  reasonError,
  onReasonChange,
  onSave,
}: {
  machine: { machineId: string; totalUnits: number; goodUnits: number; rejects: number; cycleTimeSec: number; cycleTimeThreshold: number; plannedTimeMin: number; downtimeMin: number; downtimeReasonId: string };
  reasons: { id: string; label: string; category: string }[];
  reason: string;
  reasonError: boolean;
  onReasonChange: (id: string) => void;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  const [units, setUnits] = useState(machine.totalUnits);
  const [good, setGood] = useState(machine.goodUnits);
  const [cycle, setCycle] = useState(machine.cycleTimeSec);
  const [threshold, setThreshold] = useState(machine.cycleTimeThreshold);
  const [planned, setPlanned] = useState(machine.plannedTimeMin);
  const [downtime, setDowntime] = useState(machine.downtimeMin);

  useEffect(() => {
    setUnits(machine.totalUnits);
    setGood(machine.goodUnits);
    setCycle(machine.cycleTimeSec);
    setThreshold(machine.cycleTimeThreshold);
    setPlanned(machine.plannedTimeMin);
    setDowntime(machine.downtimeMin);
  }, [machine.machineId]);

  const submit = () => {
    const reasonObj = reasons.find((r) => r.id === reason);
    onSave({
      totalUnits: Number(units) || 0,
      goodUnits: Number(good) || 0,
      rejects: (Number(units) || 0) - (Number(good) || 0),
      cycleTimeSec: Number(cycle) || 0,
      cycleTimeThreshold: Number(threshold) || 0,
      plannedTimeMin: Number(planned) || 0,
      downtimeMin: Number(downtime) || 0,
      downtimeReasonId: reason,
      downtimeReasonLabel: reasonObj?.label || "",
    });
  };

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Units" icon={<Package className="w-3 h-3" />} value={units} onChange={setUnits} />
        <Field label="Good Units" icon={<Gauge className="w-3 h-3" />} value={good} onChange={setGood} />
        <Field label="Cycle Time (sec)" icon={<Clock className="w-3 h-3" />} value={cycle} onChange={setCycle} readonly />
        <Field label="Threshold (sec)" icon={<Gauge className="w-3 h-3" />} value={threshold} onChange={setThreshold} readonly />
        <Field label="Planned (min)" icon={<Clock className="w-3 h-3" />} value={planned} onChange={setPlanned} />
        <Field label="Downtime (min)" icon={<Wrench className="w-3 h-3" />} value={downtime} onChange={setDowntime} />
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Reason</label>
          <select
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            className={cn(
              "w-full bg-industrial-surface border rounded-md px-2 py-1.5 text-xs text-white focus:outline-none focus:border-brand-primary",
              reasonError ? "border-status-down" : "border-industrial-border"
            )}
          >
            <option value="">Select a reason</option>
            {reasons.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
          {reasonError && (
            <p className="text-[10px] text-status-down mt-1">Reason required before setting idle / down / maintenance.</p>
          )}
        </div>
      </div>
      <button onClick={submit} className="w-full text-xs font-medium bg-brand-primary hover:bg-brand-primary/90 text-white py-2 rounded-md transition-colors">
        Update Production
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  icon,
  readonly,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  icon: ReactNode;
  readonly?: boolean;
}) {
  return (
    <div>
      <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">{icon} {label}</label>
      <input
        type="number"
        value={value}
        disabled={readonly}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn(
          "w-full bg-industrial-surface border border-industrial-border rounded-md px-2 py-1.5 text-xs focus:outline-none focus:border-brand-primary",
          readonly ? "text-brand-primary cursor-not-allowed opacity-80" : "text-white"
        )}
      />
    </div>
  );
}

import { useFilteredAlarms, useFilteredEnergy } from "@/hooks/useFilteredData";
import { useFilteredMetrics, averageOEE, useMetricsStatus } from "@/hooks/useFilteredMetrics";
import { useTrendSeries } from "@/hooks/useFilteredData";
import KPICard from "@/components/cards/KPICard";
import { BarChart2, Activity, Package, Clock, Zap, AlertTriangle, Factory, TrendingUp, Send, Radio } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import StatusBadge from "@/components/cards/StatusBadge";
import AlarmCard from "@/components/alarms/AlarmCard";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { cn } from "@/lib/utils";

const OEE_COLOR = (v: number) => v >= 85 ? "#22c55e" : v >= 65 ? "#f59e0b" : "#ef4444";

function formatDowntime(totalMin: number): string {
  if (totalMin <= 0) return "0m";
  const h = Math.floor(totalMin / 60);
  const m = Math.round(totalMin % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function DashboardPage() {
  const metrics = useFilteredMetrics();
  const alarms = useFilteredAlarms();
  const energyData = useFilteredEnergy();
  const { loaded: metricsLoaded, connected } = useMetricsStatus();
  const selectedPlant = useAuthStore((s) => s.selectedPlant);
  const selectedLine = useAuthStore((s) => s.selectedLine);
  const navigate = useNavigate();

  const prodTrend = useTrendSeries({ scope: "all", hours: 12 });
  const productionChartData = useMemo(
    () => prodTrend.series.map((s) => ({ time: s.time, value: s.units })),
    [prodTrend.series]
  );

  const stats = useMemo(() => {
    const live = averageOEE(metrics);
    const hasLive = metricsLoaded && metrics.length > 0;
    const active = metrics.filter((m) => m.status === "running" || m.status === "idle");
    const avgOEE = hasLive ? live.oee : 0;
    const avgAvail = hasLive ? live.availability : 0;
    const avgPerf = hasLive ? live.performance : 0;
    const avgQual = hasLive ? live.quality : 0;
    const totalProduction = metrics.reduce((a, m) => a + m.totalUnits, 0);
    const totalDowntime = metrics.reduce((a, m) => a + m.downtimeMin, 0);
    const totalEnergy = energyData.reduce((a, e) => a + (e.todayKwh ?? 0), 0);
    const activeAlarms = alarms.filter((a) => a.status === "active").length;

    return {
      avgOEE,
      avgAvail,
      avgPerf,
      avgQual,
      totalProduction,
      totalDowntime,
      totalEnergy,
      activeAlarms,
      hasData: hasLive || active.length > 0,
    };
  }, [metrics, alarms, energyData, metricsLoaded]);

  const statusCounts = useMemo(() => ({
    running: metrics.filter((m) => m.status === "running").length,
    idle: metrics.filter((m) => m.status === "idle").length,
    down: metrics.filter((m) => m.status === "down").length,
    maintenance: metrics.filter((m) => m.status === "maintenance").length,
  }), [metrics]);

  const activeAlarmsList = alarms.filter((a) => a.status === "active").slice(0, 2);

  const simMachines = useMemo(
    () => metrics.map((m) => ({ machineId: m.machineId, name: m.machineName })),
    [metrics]
  );
  const [simMachine, setSimMachine] = useState(simMachines[0]?.machineId ?? "cnc-001");
  const [simUnits, setSimUnits] = useState(5);
  const [simDowntime, setSimDowntime] = useState(0);
  const [pushing, setPushing] = useState(false);

  const pushUpdate = async () => {
    setPushing(true);
    try {
      await api.put(`/metrics/${simMachine}`, { totalUnits: simUnits, downtimeMin: simDowntime });
    } catch (err) {
      console.error("Push failed", err);
    } finally {
      setPushing(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Production Dashboard</h1>
          <p className="text-xs text-muted-foreground">{selectedPlant} · {selectedLine} · Live</p>
        </div>
        <span className={`live-indicator text-[11px] ${metricsLoaded && !connected ? "opacity-70" : ""}`}>
          {metricsLoaded ? (connected ? "Live" : "Connected · buffering") : "Connecting…"} Monitoring
        </span>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-4 xl:grid-cols-8 gap-3">
        <KPICard label="Overall OEE" value={stats.avgOEE.toFixed(1)} unit="%" trend={3.2} icon={BarChart2} color="blue" subtitle="vs yesterday" />
        <KPICard label="Availability" value={stats.avgAvail.toFixed(1)} unit="%" trend={1.8} icon={Activity} color="green" />
        <KPICard label="Performance" value={stats.avgPerf.toFixed(1)} unit="%" trend={-0.7} icon={TrendingUp} color="amber" />
        <KPICard label="Quality" value={stats.avgQual.toFixed(1)} unit="%" trend={0.4} icon={Package} color="cyan" />
        <KPICard label="Production Today" value={stats.totalProduction.toLocaleString()} icon={Factory} color="blue" subtitle="units" />
        <KPICard label="Downtime Today" value={formatDowntime(stats.totalDowntime)} icon={Clock} color="red" subtitle={`${stats.totalDowntime} mins total`} />
        <KPICard label="Energy Today" value={stats.totalEnergy.toLocaleString()} unit="kWh" icon={Zap} color="amber" />
        <KPICard label="Active Alarms" value={String(stats.activeAlarms)} icon={AlertTriangle} color={stats.activeAlarms > 0 ? "red" : "green"} subtitle="require action" />
      </div>

      {/* IoT Data Simulator */}
      <div className="industrial-card p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Radio className="w-4 h-4 text-brand-primary" /> IoT Data Simulator
          </h3>
          <span className="flex items-center gap-2 text-[11px]">
            <span className={`w-2 h-2 rounded-full ${connected ? "bg-status-running" : "bg-status-down"}`} />
            <span className="text-muted-foreground">{connected ? "Stream connected" : "Connecting…"}</span>
          </span>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <label className="space-y-1.5">
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Machine</span>
            <select
              value={simMachine}
              onChange={(e) => setSimMachine(e.target.value)}
              className="bg-industrial-surface border border-industrial-border rounded px-3 py-2 text-sm text-white"
            >
              {simMachines.map((m) => (
                <option key={m.machineId} value={m.machineId}>{m.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Add units</span>
            <input
              type="number"
              min={0}
              value={simUnits}
              onChange={(e) => setSimUnits(Number(e.target.value))}
              className="bg-industrial-surface border border-industrial-border rounded px-3 py-2 text-sm text-white w-24"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Add downtime (min)</span>
            <input
              type="number"
              min={0}
              value={simDowntime}
              onChange={(e) => setSimDowntime(Number(e.target.value))}
              className="bg-industrial-surface border border-industrial-border rounded px-3 py-2 text-sm text-white w-24"
            />
          </label>
          <button
            onClick={pushUpdate}
            disabled={pushing}
            className="inline-flex items-center gap-2 bg-brand-primary hover:bg-brand-accent disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded transition-colors"
          >
            <Send className="w-3.5 h-3.5" /> {pushing ? "Pushing…" : "Push IoT Update"}
          </button>
          <p className="text-[11px] text-muted-foreground/70 basis-full">
            Server automatically simulates IoT telemetry every 5s; this panel pushes an on-demand change. Both broadcast via SSE and update live across all connected dashboards.
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="industrial-card p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Production Trend</h3>
          {prodTrend.hasData ? (
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={productionChartData}>
              <defs>
                <linearGradient id="prodGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2540" />
              <XAxis dataKey="time" tick={{ fill: "#6b7280", fontSize: 10 }} />
              <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "#161b2e", border: "1px solid #1e2540", borderRadius: "6px", fontSize: "11px" }} />
              <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} fill="url(#prodGrad)" name="Units" />
            </AreaChart>
          </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[160px]">
              <p className="text-sm text-muted-foreground">No production data recorded yet</p>
            </div>
          )}
        </div>

        {/* Machine Status */}
        <div className="industrial-card p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Machine Status Overview</h3>
          <div className="space-y-2.5">
            {[
              { label: "Running", count: statusCounts.running, total: metrics.length, color: "bg-status-running" },
              { label: "Idle", count: statusCounts.idle, total: metrics.length, color: "bg-status-idle" },
              { label: "Down", count: statusCounts.down, total: metrics.length, color: "bg-status-down" },
              { label: "Maintenance", count: statusCounts.maintenance, total: metrics.length, color: "bg-brand-primary" },
            ].map(({ label, count, total, color }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-24">{label}</span>
                <div className="flex-1 h-2 bg-industrial-border rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all duration-500", color)} style={{ width: `${(count / total) * 100}%` }} />
                </div>
                <span className="text-xs font-mono font-bold text-white w-4 text-right">{count}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-4 gap-2 mt-4">
            {[
              { label: "Running", count: statusCounts.running, color: "text-status-running" },
              { label: "Idle", count: statusCounts.idle, color: "text-status-idle" },
              { label: "Down", count: statusCounts.down, color: "text-status-down" },
              { label: "Maint.", count: statusCounts.maintenance, color: "text-brand-primary" },
            ].map(({ label, count, color }) => (
              <div key={label} className="text-center bg-industrial-surface rounded p-2">
                <div className={cn("text-lg font-mono font-bold", color)}>{count}</div>
                <div className="text-[10px] text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live Machine Table (from MongoDB MachineMetric) */}
      <div className="industrial-card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-industrial-border">
          <h3 className="text-sm font-semibold text-white">Live Machine Monitoring</h3>
          <span className="text-[10px] text-muted-foreground">Source: MachineMetric (MongoDB)</span>
          <button onClick={() => navigate("/machines")} className="text-xs text-brand-primary hover:text-brand-accent transition-colors">View All →</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-industrial-border">
                {["Machine", "Status", "OEE", "Availability", "Performance", "Output", "Temp", "Power"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => {
                const isOff = m.status === "down" || m.status === "maintenance";
                return (
                <tr
                  key={m.machineId}
                  className="border-b border-industrial-border/50 hover:bg-industrial-hover cursor-pointer transition-colors"
                  onClick={() => navigate(`/machines/${m.machineId}`)}
                >
                  <td className="px-4 py-3">
                    <div className="text-sm font-semibold text-white">{m.machineName}</div>
                    <div className="text-[10px] text-muted-foreground">{m.line}</div>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm font-bold" style={{ color: OEE_COLOR(m.oee.oee) }}>
                      {isOff ? "--" : `${m.oee.oee.toFixed(1)}%`}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm text-white">
                    {isOff ? "--" : `${m.oee.availability.toFixed(1)}%`}
                  </td>
                  <td className="px-4 py-3 font-mono text-sm text-white">
                    {isOff ? "--" : `${m.oee.performance.toFixed(1)}%`}
                  </td>
                  <td className="px-4 py-3 font-mono text-sm text-white">{m.totalUnits.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={cn("font-mono text-sm", m.sensor.temperature > 80 ? "text-status-down" : m.sensor.temperature > 70 ? "text-status-idle" : "text-white")}>
                      {m.sensor.temperature.toFixed(1)}°C
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm text-white">{m.sensor.power.toFixed(1)} kW</td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Active Alarms */}
      {activeAlarmsList.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Active Alarms</h3>
            <button onClick={() => navigate("/alarms")} className="text-xs text-brand-primary hover:text-brand-accent">View All →</button>
          </div>
          <div className="space-y-2">
            {activeAlarmsList.map((alarm) => <AlarmCard key={alarm.id} alarm={alarm} />)}
          </div>
        </div>
      )}
    </div>
  );
}

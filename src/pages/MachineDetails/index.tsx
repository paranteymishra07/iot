import { useParams, useNavigate } from "react-router-dom";
import { useMachine, useTrendSeries } from "@/hooks/useFilteredData";
import { useState, useEffect, useMemo } from "react";
import StatusBadge from "@/components/cards/StatusBadge";
import { ArrowLeft, Thermometer, Activity, Zap, Gauge, Cpu, Clock } from "lucide-react";
import { cn, achievementPct } from "@/lib/utils";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area,
} from "recharts";

type TabKey = "oee" | "production" | "energy" | "sensors" | "alarms";

const TABS: { key: TabKey; label: string }[] = [
  { key: "oee", label: "OEE" },
  { key: "production", label: "Production" },
  { key: "energy", label: "Energy" },
  { key: "sensors", label: "Sensors" },
  { key: "alarms", label: "Alarms" },
];

const OEE_COLOR = (v: number) => v >= 85 ? "text-status-running" : v >= 65 ? "text-status-idle" : "text-status-down";

export default function MachineDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const machine = useMachine(id || "");
  const [activeTab, setActiveTab] = useState<TabKey>("oee");
  const [secondsAgo, setSecondsAgo] = useState(0);

  const histOee = useTrendSeries({ scope: "machine", machineId: machine?.name, hours: 24 });
  const histTemp = useTrendSeries({ scope: "machine", machineId: machine?.name, hours: 24 });
  const histPower = useTrendSeries({ scope: "machine", machineId: machine?.name, hours: 24 });

  const oeeHistory = useMemo(
    () => histOee.series.map((s) => ({ time: s.time, value: s.oee })),
    [histOee.series]
  );
  const tempHistory = useMemo(
    () => histTemp.series.map((s) => ({ time: s.time, value: s.temperature })),
    [histTemp.series]
  );
  const powerHistory = useMemo(
    () => histPower.series.map((s) => ({ time: s.time, value: s.power })),
    [histPower.series]
  );

  useEffect(() => {
    const t = setInterval(() => setSecondsAgo((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [machine]);

  useEffect(() => setSecondsAgo(0), [machine?.lastUpdate]);

  if (!machine) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-muted-foreground mb-2">Machine not found</p>
          <button onClick={() => navigate("/machines")} className="text-brand-primary text-sm">← Back to Machines</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate("/machines")} className="p-2 rounded-md hover:bg-industrial-hover transition-colors">
          <ArrowLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white">{machine.name}</h1>
            <StatusBadge status={machine.status} />
          </div>
          <p className="text-xs text-muted-foreground">{machine.line} · {machine.plant} · Last update: {secondsAgo}s ago</p>
        </div>
        <span className="live-indicator text-[11px]">Live</span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Left: OEE + Sensors */}
        <div className="col-span-1 space-y-4">
          {/* OEE Card */}
          <div className="industrial-card p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">OEE</div>
            <div className={cn("text-4xl font-mono font-bold mb-4", OEE_COLOR(machine.oee.oee))}>
              {machine.status === "down" || machine.status === "maintenance" ? "--" : `${machine.oee.oee.toFixed(1)}%`}
            </div>
            {[
              { label: "Availability", value: machine.oee.availability },
              { label: "Performance", value: machine.oee.performance },
              { label: "Quality", value: machine.oee.quality },
            ].map(({ label, value }) => (
              <div key={label} className="mb-2">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{label}</span>
                  <span className={cn("font-mono font-semibold", OEE_COLOR(value))}>
                    {machine.status === "down" || machine.status === "maintenance" ? "--" : `${value.toFixed(1)}%`}
                  </span>
                </div>
                <div className="h-1.5 bg-industrial-border rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", value >= 85 ? "bg-status-running" : value >= 65 ? "bg-status-idle" : "bg-status-down")}
                    style={{ width: `${machine.status === "down" || machine.status === "maintenance" ? 0 : value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Live Sensors */}
          <div className="industrial-card p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Live Sensor Data</div>
            <div className="space-y-3">
              {[
                { icon: Thermometer, label: "Temperature", value: `${machine.sensors.temperature.toFixed(1)} °C`, warn: machine.sensors.temperature > 75, crit: machine.sensors.temperature > 85 },
                { icon: Activity, label: "Vibration", value: `${machine.sensors.vibration.toFixed(2)} mm/s`, warn: machine.sensors.vibration > 5, crit: machine.sensors.vibration > 7 },
                { icon: Gauge, label: "Load", value: `${machine.sensors.load.toFixed(0)} %`, warn: machine.sensors.load > 90, crit: false },
                { icon: Cpu, label: "Speed", value: `${machine.sensors.speed.toFixed(0)} RPM`, warn: false, crit: false },
                { icon: Zap, label: "Power", value: `${machine.sensors.power.toFixed(1)} kW`, warn: false, crit: false },
              ].map(({ icon: Icon, label, value, warn, crit }) => (
                <div key={label} className="flex items-center justify-between bg-industrial-surface rounded-md px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Icon className={cn("w-3.5 h-3.5", crit ? "text-status-down" : warn ? "text-status-idle" : "text-brand-accent")} />
                    <span className="text-xs text-muted-foreground">{label}</span>
                  </div>
                  <span className={cn("text-sm font-mono font-bold", crit ? "text-status-down" : warn ? "text-status-idle" : "text-white")}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Production Summary */}
          <div className="industrial-card p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Live Production</div>
            <div className="space-y-2">
              {[
                { label: "Target", value: machine.production.target.toLocaleString() },
                { label: "Actual", value: machine.production.actual.toLocaleString() },
                { label: "Good Units", value: machine.production.good.toLocaleString() },
                { label: "Rejects", value: String(machine.production.rejects) },
                { label: "Cycle Time", value: machine.status === "running" ? `${machine.production.cycleTime}s` : "--" },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center py-1 border-b border-industrial-border/50 last:border-0">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className="text-sm font-mono font-semibold text-white">{value}</span>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Achievement</span>
                <span className="font-mono font-semibold text-white">
                  {achievementPct(machine.production.actual, machine.production.target).toFixed(1)}%
                </span>
              </div>
              <div className="h-2 bg-industrial-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-primary rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, achievementPct(machine.production.actual, machine.production.target))}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Charts */}
        <div className="col-span-2 space-y-4">
          {/* Tabs */}
          <div className="industrial-card">
            <div className="flex border-b border-industrial-border px-4">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "px-4 py-3 text-xs font-medium border-b-2 transition-colors",
                    activeTab === tab.key
                      ? "text-brand-primary border-brand-primary"
                      : "text-muted-foreground border-transparent hover:text-white"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-4">
              {activeTab === "oee" && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">OEE Trend — Last 24h</h4>
                  {histOee.hasData ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={oeeHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e2540" />
                      <XAxis dataKey="time" tick={{ fill: "#6b7280", fontSize: 10 }} />
                      <YAxis domain={[60, 100]} tick={{ fill: "#6b7280", fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: "#161b2e", border: "1px solid #1e2540", borderRadius: "6px", fontSize: "11px" }} />
                      <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} name="OEE %" />
                    </LineChart>
                  </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[220px]">
                      <p className="text-sm text-muted-foreground">No OEE history recorded yet</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "sensors" && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Temperature Trend — Last 24h</h4>
                  {histTemp.hasData ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={tempHistory}>
                      <defs>
                        <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e2540" />
                      <XAxis dataKey="time" tick={{ fill: "#6b7280", fontSize: 10 }} />
                      <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: "#161b2e", border: "1px solid #1e2540", fontSize: "11px" }} />
                      <Area type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2} fill="url(#tempGrad)" name="°C" />
                    </AreaChart>
                  </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[220px]">
                      <p className="text-sm text-muted-foreground">No temperature history recorded yet</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "energy" && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Power Consumption — Last 24h</h4>
                  {histPower.hasData ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={powerHistory}>
                      <defs>
                        <linearGradient id="powerGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e2540" />
                      <XAxis dataKey="time" tick={{ fill: "#6b7280", fontSize: 10 }} />
                      <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: "#161b2e", border: "1px solid #1e2540", fontSize: "11px" }} />
                      <Area type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={2} fill="url(#powerGrad)" name="kW" />
                    </AreaChart>
                  </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[220px]">
                      <p className="text-sm text-muted-foreground">No power history recorded yet</p>
                    </div>
                  )}
                </div>
              )}

              {(activeTab === "production" || activeTab === "alarms") && (
                <div className="flex items-center justify-center h-[220px]">
                  <div className="text-center">
                    <Clock className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Historical data available after backend integration</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Real-time sensors above are live</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Machine Info */}
          <div className="industrial-card p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Device Information</div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Machine ID", value: machine.id.toUpperCase() },
                { label: "Type", value: machine.type },
                { label: "IP Address", value: machine.ipAddress },
                { label: "Firmware", value: machine.firmware },
                { label: "Operating Hours", value: `${machine.operatingHours.toLocaleString()} hrs` },
                { label: "Health Score", value: `${machine.healthScore}%` },
              ].map(({ label, value }) => (
                <div key={label} className="bg-industrial-surface rounded p-2.5">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{label}</div>
                  <div className="text-xs font-mono font-semibold text-white">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

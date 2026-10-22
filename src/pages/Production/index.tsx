import { useFilteredMachines } from "@/hooks/useFilteredData";
import { SHIFT_DATA } from "@/constants/mockData";
import { useMemo, useRef } from "react";
import { Package, Target, CheckCircle, XCircle } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area, Cell } from "recharts";
import { cn, achievementPct } from "@/lib/utils";

function generateHourlyProd() {
  const data = [];
  for (let h = 6; h <= 18; h++) {
    data.push({ hour: `${h}:00`, actual: 700 + Math.random() * 300, target: 850 });
  }
  return data;
}

export default function ProductionPage() {
  const machines = useFilteredMachines();
  const hourlyData = useRef(generateHourlyProd());

  const totals = useMemo(() => {
    const actual = machines.reduce((a, m) => a + m.production.actual, 0);
    const target = machines.reduce((a, m) => a + m.production.target, 0);
    const rejects = machines.reduce((a, m) => a + m.production.rejects, 0);
    const good = actual - rejects;
    return { actual, target, rejects, good, achievement: (actual / target) * 100 };
  }, [machines]);

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-lg font-bold text-white">Production Dashboard</h1>
        <p className="text-xs text-muted-foreground">Today's plant-wide production summary</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Target", value: totals.target.toLocaleString(), icon: Target, color: "text-muted-foreground" },
          { label: "Actual Production", value: totals.actual.toLocaleString(), icon: Package, color: "text-brand-primary" },
          { label: "Good Units", value: totals.good.toLocaleString(), icon: CheckCircle, color: "text-status-running" },
          { label: "Rejected Units", value: totals.rejects.toLocaleString(), icon: XCircle, color: "text-status-down" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="industrial-card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <div className={`text-2xl font-mono font-bold ${color === "text-muted-foreground" ? "text-white" : color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Achievement */}
      <div className="industrial-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Overall Achievement</h3>
          <span className={cn("text-xl font-mono font-bold", totals.achievement >= 90 ? "text-status-running" : totals.achievement >= 80 ? "text-status-idle" : "text-status-down")}>
            {totals.achievement.toFixed(1)}%
          </span>
        </div>
        <div className="h-4 bg-industrial-border rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-700 relative", totals.achievement >= 90 ? "bg-status-running" : totals.achievement >= 80 ? "bg-status-idle" : "bg-status-down")}
            style={{ width: `${Math.min(100, totals.achievement)}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-[11px] text-muted-foreground">
          <span>0</span>
          <span>Target: {totals.target.toLocaleString()}</span>
          <span>100%</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Hourly Trend */}
        <div className="industrial-card p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Hourly Output vs Target</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={hourlyData.current}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2540" vertical={false} />
              <XAxis dataKey="hour" tick={{ fill: "#6b7280", fontSize: 9 }} />
              <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "#161b2e", border: "1px solid #1e2540", borderRadius: "6px", fontSize: "11px" }} />
              <Bar dataKey="target" fill="#1e2540" name="Target" radius={[2, 2, 0, 0]} />
              <Bar dataKey="actual" name="Actual" radius={[2, 2, 0, 0]}>
                {hourlyData.current.map((entry, i) => (
                  <Cell key={i} fill={entry.actual >= entry.target * 0.9 ? "#22c55e" : entry.actual >= entry.target * 0.75 ? "#f59e0b" : "#ef4444"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Machine Production Table */}
        <div className="industrial-card p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Machine Production</h3>
          <div className="space-y-2">
            {machines.map((m) => (
              <div key={m.id} className="flex items-center gap-3 bg-industrial-surface rounded p-2.5">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-white">{m.name}</div>
                  <div className="text-[10px] text-muted-foreground">{m.production.actual.toLocaleString()} / {m.production.target.toLocaleString()}</div>
                </div>
                <div className="w-20">
                  <div className="h-1.5 bg-industrial-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-primary rounded-full"
                      style={{ width: `${Math.min(100, achievementPct(m.production.actual, m.production.target))}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-white w-12 text-right">
                  {achievementPct(m.production.actual, m.production.target).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Shift Table */}
      <div className="industrial-card">
        <div className="px-4 py-3 border-b border-industrial-border">
          <h3 className="text-sm font-semibold text-white">Shift-wise Performance</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-industrial-border">
              {["Shift", "Target", "Produced", "Good Units", "Rejected", "Reject Rate", "Achievement"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SHIFT_DATA.map((s) => (
              <tr key={s.shift} className="border-b border-industrial-border/40 hover:bg-industrial-hover transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-white">{s.shift}</td>
                <td className="px-4 py-3 font-mono text-sm text-muted-foreground">{s.target.toLocaleString()}</td>
                <td className="px-4 py-3 font-mono text-sm text-white font-semibold">{s.produced.toLocaleString()}</td>
                <td className="px-4 py-3 font-mono text-sm text-status-running">{s.good.toLocaleString()}</td>
                <td className="px-4 py-3 font-mono text-sm text-status-down">{s.rejected}</td>
                <td className="px-4 py-3 font-mono text-sm text-muted-foreground">{((s.rejected / s.produced) * 100).toFixed(2)}%</td>
                <td className="px-4 py-3">
                  <span className={cn("font-mono text-sm font-bold", s.achievement >= 90 ? "text-status-running" : s.achievement >= 80 ? "text-status-idle" : "text-status-down")}>
                    {s.achievement.toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

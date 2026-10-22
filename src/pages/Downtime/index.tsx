import { DOWNTIME_REASONS, SHIFT_DATA } from "@/constants/mockData";
import { Clock, AlertTriangle } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, Cell
} from "recharts";
import { cn } from "@/lib/utils";

const PARETO_COLORS = ["#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e"];

export default function DowntimePage() {
  const totalDowntime = DOWNTIME_REASONS.reduce((a, d) => a + d.duration, 0);
  const totalHours = Math.floor(totalDowntime / 60);
  const totalMins = totalDowntime % 60;

  const cumulativeData = DOWNTIME_REASONS.map((d, i) => ({
    ...d,
    cumulative: DOWNTIME_REASONS.slice(0, i + 1).reduce((a, x) => a + x.percentage, 0),
  }));

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-lg font-bold text-white">Downtime Analysis</h1>
        <p className="text-xs text-muted-foreground">Today's plant downtime breakdown</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="industrial-card p-5 text-center">
          <Clock className="w-5 h-5 text-status-down mx-auto mb-2" />
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Downtime Today</div>
          <div className="text-3xl font-mono font-bold text-status-down">{totalHours}h {totalMins}m</div>
          <div className="text-xs text-muted-foreground mt-1">{totalDowntime} minutes</div>
        </div>
        <div className="industrial-card p-5 text-center">
          <AlertTriangle className="w-5 h-5 text-status-idle mx-auto mb-2" />
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Incidents Today</div>
          <div className="text-3xl font-mono font-bold text-status-idle">{DOWNTIME_REASONS.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Distinct causes</div>
        </div>
        <div className="industrial-card p-5 text-center">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Availability Lost</div>
          <div className="text-3xl font-mono font-bold text-brand-primary">{((totalDowntime / 480) * 100).toFixed(1)}%</div>
          <div className="text-xs text-muted-foreground mt-1">Of 8-hour shift</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Pareto Chart */}
        <div className="industrial-card p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Pareto Analysis — Downtime Causes</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={cumulativeData} margin={{ top: 5, right: 30, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2540" vertical={false} />
              <XAxis dataKey="reason" tick={{ fill: "#6b7280", fontSize: 9 }} />
              <YAxis yAxisId="left" tick={{ fill: "#6b7280", fontSize: 10 }} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fill: "#6b7280", fontSize: 10 }} unit="%" />
              <Tooltip contentStyle={{ background: "#161b2e", border: "1px solid #1e2540", borderRadius: "6px", fontSize: "11px" }} />
              <Bar yAxisId="left" dataKey="duration" name="Minutes" radius={[2, 2, 0, 0]}>
                {cumulativeData.map((_, i) => (
                  <Cell key={i} fill={PARETO_COLORS[i] || "#3b82f6"} />
                ))}
              </Bar>
              <Line yAxisId="right" type="monotone" dataKey="cumulative" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: "#3b82f6" }} name="Cumulative %" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Reason List */}
        <div className="industrial-card p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Top Downtime Reasons</h3>
          <div className="space-y-3">
            {DOWNTIME_REASONS.map((d, i) => (
              <div key={d.reason}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground/60 w-4">#{i + 1}</span>
                    <span className="text-sm text-white">{d.reason}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{d.duration} min</span>
                    <span className="text-xs font-mono font-bold text-white w-10 text-right">{d.percentage.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="h-1.5 bg-industrial-border rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${d.percentage}%`, backgroundColor: PARETO_COLORS[i] || "#3b82f6" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Shift Data */}
      <div className="industrial-card">
        <div className="px-4 py-3 border-b border-industrial-border">
          <h3 className="text-sm font-semibold text-white">Shift Performance</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-industrial-border">
                {["Shift", "Target", "Produced", "Good", "Rejected", "Achievement", "OEE"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SHIFT_DATA.map((s) => (
                <tr key={s.shift} className="border-b border-industrial-border/40 hover:bg-industrial-hover transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-white">{s.shift}</td>
                  <td className="px-4 py-3 font-mono text-sm text-white">{s.target.toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono text-sm text-white">{s.produced.toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono text-sm text-status-running">{s.good.toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono text-sm text-status-down">{s.rejected}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-industrial-border rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full", s.achievement >= 90 ? "bg-status-running" : s.achievement >= 80 ? "bg-status-idle" : "bg-status-down")}
                          style={{ width: `${s.achievement}%` }}
                        />
                      </div>
                      <span className={cn("font-mono text-xs font-bold", s.achievement >= 90 ? "text-status-running" : s.achievement >= 80 ? "text-status-idle" : "text-status-down")}>
                        {s.achievement.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("font-mono text-sm font-bold", s.oee >= 85 ? "text-status-running" : s.oee >= 70 ? "text-status-idle" : "text-status-down")}>
                      {s.oee.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

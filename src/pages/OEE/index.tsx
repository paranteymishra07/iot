import { useFilteredMachines } from "@/hooks/useFilteredData";
import { useFilteredMetrics, averageOEE } from "@/hooks/useFilteredMetrics";
import { useMemo, useRef } from "react";
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Legend } from "recharts";
import { cn } from "@/lib/utils";

function generateOEETrend(points = 30) {
  const data = [];
  const now = new Date();
  for (let i = points - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    data.push({
      date: `${d.getDate()}/${d.getMonth() + 1}`,
      oee: 75 + Math.random() * 15,
      availability: 85 + Math.random() * 12,
      performance: 88 + Math.random() * 10,
      quality: 96 + Math.random() * 3.5,
    });
  }
  return data;
}

const OEE_COLOR = (v: number) => v >= 85 ? "#22c55e" : v >= 65 ? "#f59e0b" : "#ef4444";

export default function OEEPage() {
  const machines = useFilteredMachines();
  const metrics = useFilteredMetrics();
  const oeeHistory = useRef(generateOEETrend(30));

  const metricByName = useMemo(() => {
    const map = new Map<string, typeof metrics[number]>();
    metrics.forEach((m) => map.set(m.machineName, m));
    return map;
  }, [metrics]);

  const stats = useMemo(() => {
    const running = machines.filter((m) => m.status === "running");
    const live = averageOEE(metrics);
    const hasLive = metrics.length > 0;
    const avgOEE = hasLive ? live.oee : (running.length ? running.reduce((a, m) => a + m.oee.oee, 0) / running.length : 0);
    const avgAvail = hasLive ? live.availability : (running.length ? running.reduce((a, m) => a + m.oee.availability, 0) / running.length : 0);
    const avgPerf = hasLive ? live.performance : (running.length ? running.reduce((a, m) => a + m.oee.performance, 0) / running.length : 0);
    const avgQual = hasLive ? live.quality : (running.length ? running.reduce((a, m) => a + m.oee.quality, 0) / running.length : 0);
    return { avgOEE, avgAvail, avgPerf, avgQual };
  }, [machines, metrics]);

  const machineOEEData = machines
    .filter((m) => m.status !== "down" && m.status !== "maintenance")
    .map((m) => {
      const live = metricByName.get(m.name);
      return {
        name: m.name,
        OEE: +(live ? live.oee.oee : m.oee.oee).toFixed(1),
        Avail: +(live ? live.oee.availability : m.oee.availability).toFixed(1),
        Perf: +(live ? live.oee.performance : m.oee.performance).toFixed(1),
        Quality: +(live ? live.oee.quality : m.oee.quality).toFixed(1),
      };
    });

  const radarData = [
    { subject: "OEE", value: stats.avgOEE },
    { subject: "Availability", value: stats.avgAvail },
    { subject: "Performance", value: stats.avgPerf },
    { subject: "Quality", value: stats.avgQual },
    { subject: "Energy Eff.", value: 78 },
    { subject: "Utilization", value: 82 },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-lg font-bold text-white">OEE Analytics</h1>
        <p className="text-xs text-muted-foreground">OEE = Availability × Performance × Quality</p>
      </div>

      {/* Top OEE */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Overall OEE", value: stats.avgOEE, desc: "A × P × Q" },
          { label: "Availability", value: stats.avgAvail, desc: "Run Time / Planned Time" },
          { label: "Performance", value: stats.avgPerf, desc: "Actual Rate / Target Rate" },
          { label: "Quality", value: stats.avgQual, desc: "Good Units / Total Units" },
        ].map(({ label, value, desc }) => (
          <div key={label} className="industrial-card p-5 text-center">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{label}</div>
            <div className="text-4xl font-mono font-bold mb-1" style={{ color: OEE_COLOR(value) }}>
              {value.toFixed(1)}%
            </div>
            <div className="text-[10px] text-muted-foreground/60">{desc}</div>
            <div className="mt-3 h-1.5 bg-industrial-border rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${value}%`, backgroundColor: OEE_COLOR(value) }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* OEE Trend */}
        <div className="col-span-2 industrial-card p-4">
          <h3 className="text-sm font-semibold text-white mb-4">OEE Trend — Last 30 Days</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={oeeHistory.current}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2540" />
              <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 9 }} interval={4} />
              <YAxis domain={[60, 100]} tick={{ fill: "#6b7280", fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "#161b2e", border: "1px solid #1e2540", borderRadius: "6px", fontSize: "11px" }} />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Line type="monotone" dataKey="oee" stroke="#3b82f6" strokeWidth={2} dot={false} name="OEE" />
              <Line type="monotone" dataKey="availability" stroke="#22c55e" strokeWidth={1.5} dot={false} name="Avail" />
              <Line type="monotone" dataKey="performance" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="Perf" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Radar */}
        <div className="industrial-card p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Performance Radar</h3>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#1e2540" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: "#6b7280", fontSize: 9 }} />
              <Radar name="Plant" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Machine OEE Comparison */}
      <div className="industrial-card p-4">
        <h3 className="text-sm font-semibold text-white mb-4">Machine OEE Comparison</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={machineOEEData} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2540" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fill: "#6b7280", fontSize: 10 }} />
            <Tooltip contentStyle={{ background: "#161b2e", border: "1px solid #1e2540", borderRadius: "6px", fontSize: "11px" }} />
            <Legend wrapperStyle={{ fontSize: "11px" }} />
            <Bar dataKey="OEE" fill="#3b82f6" radius={[2, 2, 0, 0]} />
            <Bar dataKey="Avail" fill="#22c55e" radius={[2, 2, 0, 0]} />
            <Bar dataKey="Perf" fill="#f59e0b" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Machine OEE Table */}
      <div className="industrial-card">
        <div className="px-4 py-3 border-b border-industrial-border">
          <h3 className="text-sm font-semibold text-white">Machine OEE Details</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-industrial-border">
              {["Machine", "Status", "OEE", "Availability", "Performance", "Quality", "Target Gap"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {machines.map((m) => {
              const live = metricByName.get(m.name);
              const values = live
                ? [live.oee.oee, live.oee.availability, live.oee.performance, live.oee.quality]
                : [m.oee.oee, m.oee.availability, m.oee.performance, m.oee.quality];
              const oeeVal = values[0];
              return (
              <tr key={m.id} className="border-b border-industrial-border/40 hover:bg-industrial-hover transition-colors">
                <td className="px-4 py-3 text-sm font-semibold text-white">{m.name}</td>
                <td className="px-4 py-3">
                  <span className={cn("text-xs px-2 py-0.5 rounded border font-medium",
                    (live ? live.status : m.status) === "running" ? "bg-status-running/15 text-status-running border-status-running/30" :
                    (live ? live.status : m.status) === "idle" ? "bg-status-idle/15 text-status-idle border-status-idle/30" :
                    "bg-status-down/15 text-status-down border-status-down/30"
                  )}>
                    {(live ? live.status : m.status).toUpperCase()}
                  </span>
                </td>
                {values.map((val, i) => (
                  <td key={i} className="px-4 py-3">
                    <span className="font-mono text-sm font-bold" style={{ color: OEE_COLOR(val) }}>
                      {m.status === "down" || m.status === "maintenance" ? "--" : `${val.toFixed(1)}%`}
                    </span>
                  </td>
                ))}
                <td className="px-4 py-3">
                  <span className={cn("font-mono text-xs font-medium", (100 - oeeVal) > 20 ? "text-status-down" : "text-muted-foreground")}>
                    {m.status === "running" ? `-${(100 - oeeVal).toFixed(1)}%` : "--"}
                  </span>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useRef, useState, useEffect } from "react";
import { useFilteredEnergy, useFilteredMachines } from "@/hooks/useFilteredData";
import { useAuthStore } from "@/stores/authStore";
import { useEnergyStore } from "@/stores/energyStore";
import { api } from "@/lib/api";
import { Zap, TrendingDown, IndianRupee, Save, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar, Legend
} from "recharts";

function generatePowerTrend() {
  const hours = [];
  for (let h = 0; h <= 18; h += 3) {
    hours.push({
      time: `${h.toString().padStart(2, "0")}:00`,
      power: 3 + Math.random() * 7,
    });
  }
  return hours;
}

const CHART_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#06b6d4", "#8b5cf6", "#ec4899"];

export default function EnergyPage() {
  const energyData = useFilteredEnergy();
  const powerTrend = useRef(generatePowerTrend());

  const totals = energyData.reduce(
    (a, e) => ({ kwh: a.kwh + e.todayKwh, cost: a.cost + e.costInr }),
    { kwh: 0, cost: 0 }
  );

  const pieData = energyData.map((e) => ({ name: e.machineName, value: e.todayKwh }));

  const barData = energyData.map((e) => ({
    name: e.machineName,
    kWh: e.todayKwh,
    Cost: Math.round(e.costInr / 100),
  }));

  const machines = useFilteredMachines();
  const user = useAuthStore((s) => s.user);
  const fetchEnergy = useEnergyStore((s) => s.fetchEnergy);
  const isAdmin =
    user?.role === "super_admin" || user?.role === "oem_admin" || user?.role === "plant_manager";

  const [machineId, setMachineId] = useState("");
  const [todayKwh, setTodayKwh] = useState(0);
  const [costInr, setCostInr] = useState(0);
  const [peakDemand, setPeakDemand] = useState(0);
  const [kwhPerUnit, setKwhPerUnit] = useState(0);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const existing = energyData.find((e) => e.machineId === machineId) ?? energyData.find((e) => e.machineName === machineId);
    if (existing) {
      setTodayKwh(existing.todayKwh);
      setCostInr(existing.costInr);
      setPeakDemand(existing.peakDemand);
      setKwhPerUnit(existing.kwhPerUnit);
    } else {
      setTodayKwh(0);
      setCostInr(0);
      setPeakDemand(0);
      setKwhPerUnit(0);
    }
  }, [machineId, energyData]);

  const selectedMachine = machines.find(
    (m) => m.id === machineId || m.name.toLowerCase() === machineId.toLowerCase()
  );

  const handleSave = async () => {
    if (!machineId || !selectedMachine) {
      setMsg({ ok: false, text: "Please select a machine" });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      await api.put(`/energy/${selectedMachine.id}`, {
        machineId: selectedMachine.id,
        machineName: selectedMachine.name,
        plant: selectedMachine.plant,
        line: selectedMachine.line,
        todayKwh,
        costInr,
        peakDemand,
        kwhPerUnit,
      });
      await fetchEnergy();
      setMsg({ ok: true, text: `Energy data saved for ${selectedMachine.name}` });
    } catch (err) {
      setMsg({ ok: false, text: "Failed to save energy data" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-lg font-bold text-white">Energy Monitoring</h1>
        <p className="text-xs text-muted-foreground">Plant-wide energy consumption & cost analysis</p>
      </div>

      {/* Machine-wise Energy Update (Admins) */}
      {isAdmin && (
        <div className="industrial-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Save className="w-4 h-4 text-brand-primary" /> Update Energy Consumption (Machine-wise)
            </h3>
            <span className="text-[10px] text-muted-foreground">Source: EnergyData (MongoDB)</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
            <label className="space-y-1.5 col-span-2">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Machine</span>
              <select
                value={machineId}
                onChange={(e) => setMachineId(e.target.value)}
                className="bg-industrial-surface border border-industrial-border rounded px-3 py-2 text-sm text-white w-full"
              >
                <option value="">Select machine…</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Today kWh</span>
              <input
                type="number" min={0} step="any" value={todayKwh}
                onChange={(e) => setTodayKwh(Number(e.target.value))}
                className="bg-industrial-surface border border-industrial-border rounded px-3 py-2 text-sm text-white w-full"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Cost (₹)</span>
              <input
                type="number" min={0} step="any" value={costInr}
                onChange={(e) => setCostInr(Number(e.target.value))}
                className="bg-industrial-surface border border-industrial-border rounded px-3 py-2 text-sm text-white w-full"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Peak Demand (kW)</span>
              <input
                type="number" min={0} step="any" value={peakDemand}
                onChange={(e) => setPeakDemand(Number(e.target.value))}
                className="bg-industrial-surface border border-industrial-border rounded px-3 py-2 text-sm text-white w-full"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider">kWh/Unit</span>
              <input
                type="number" min={0} step="any" value={kwhPerUnit}
                onChange={(e) => setKwhPerUnit(Number(e.target.value))}
                className="bg-industrial-surface border border-industrial-border rounded px-3 py-2 text-sm text-white w-full"
              />
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                disabled={saving || !machineId}
                className="inline-flex items-center gap-2 bg-brand-primary hover:bg-brand-accent disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded transition-colors"
              >
                <Save className="w-3.5 h-3.5" /> {saving ? "Saving…" : "Save"}
              </button>
              {msg && (
                <span className={cn("flex items-center gap-1 text-[11px]", msg.ok ? "text-status-running" : "text-status-down")}>
                  {msg.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                  {msg.text}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Today's Consumption", value: totals.kwh.toLocaleString(), unit: "kWh", icon: Zap, color: "text-status-idle" },
          { label: "Energy Cost", value: `₹${totals.cost.toLocaleString()}`, unit: "", icon: IndianRupee, color: "text-brand-accent" },
          { label: "Peak Demand", value: "9.1", unit: "kW", icon: TrendingDown, color: "text-status-down" },
          { label: "kWh / Unit", value: "0.56", unit: "avg", icon: Zap, color: "text-status-running" },
        ].map(({ label, value, unit, icon: Icon, color }) => (
          <div key={label} className="industrial-card p-4">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <div className="flex items-end gap-1">
              <span className={`font-mono font-bold text-2xl ${color}`}>{value}</span>
              {unit && <span className="text-muted-foreground text-sm mb-0.5">{unit}</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Power Trend */}
        <div className="col-span-2 industrial-card p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Power Consumption Today</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={powerTrend.current}>
              <defs>
                <linearGradient id="pwrGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2540" />
              <XAxis dataKey="time" tick={{ fill: "#6b7280", fontSize: 10 }} />
              <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} unit=" kW" />
              <Tooltip contentStyle={{ background: "#161b2e", border: "1px solid #1e2540", borderRadius: "6px", fontSize: "11px" }} />
              <Area type="monotone" dataKey="power" stroke="#f59e0b" strokeWidth={2} fill="url(#pwrGrad)" name="Power (kW)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie */}
        <div className="industrial-card p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Consumption by Machine</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                {pieData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "#161b2e", border: "1px solid #1e2540", fontSize: "11px" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Machine Table */}
      <div className="industrial-card">
        <div className="px-4 py-3 border-b border-industrial-border">
          <h3 className="text-sm font-semibold text-white">Machine Energy Breakdown</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-industrial-border">
              {["Machine", "Consumption (kWh)", "Energy Cost (₹)", "Peak Demand (kW)", "kWh/Unit", "Share"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {energyData.sort((a, b) => b.todayKwh - a.todayKwh).map((e) => {
              const share = ((e.todayKwh / totals.kwh) * 100).toFixed(1);
              return (
                <tr key={e.machineId} className="border-b border-industrial-border/40 hover:bg-industrial-hover transition-colors">
                  <td className="px-4 py-3 text-sm font-semibold text-white">{e.machineName}</td>
                  <td className="px-4 py-3 font-mono text-sm text-status-idle font-semibold">{e.todayKwh}</td>
                  <td className="px-4 py-3 font-mono text-sm text-brand-accent font-semibold">₹{e.costInr.toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono text-sm text-white">{e.peakDemand.toFixed(1)}</td>
                  <td className="px-4 py-3 font-mono text-sm text-white">{e.kwhPerUnit > 0 ? e.kwhPerUnit.toFixed(2) : "--"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-industrial-border rounded-full overflow-hidden">
                        <div className="h-full bg-status-idle rounded-full" style={{ width: `${share}%` }} />
                      </div>
                      <span className="text-xs font-mono text-muted-foreground w-10 text-right">{share}%</span>
                    </div>
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

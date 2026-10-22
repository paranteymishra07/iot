import { useFilteredMachines } from "@/hooks/useFilteredData";
import { Wrench, AlertTriangle, Heart, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const HEALTH_COLOR = (v: number) => v >= 75 ? "text-status-running" : v >= 50 ? "text-status-idle" : "text-status-down";
const HEALTH_BG = (v: number) => v >= 75 ? "bg-status-running" : v >= 50 ? "bg-status-idle" : "bg-status-down";

const RISK_LABEL = (score: number) =>
  score >= 70 ? { label: "HIGH RISK", cls: "text-status-down bg-status-down/10 border-status-down/30" } :
  score >= 40 ? { label: "MEDIUM RISK", cls: "text-status-idle bg-status-idle/10 border-status-idle/30" } :
  { label: "LOW RISK", cls: "text-status-running bg-status-running/10 border-status-running/30" };

const SENSOR_STATUS = (val: number, warn: number, crit: number) =>
  val >= crit ? "HIGH" : val >= warn ? "MEDIUM" : "NORMAL";

const SENSOR_COLOR = (status: string) =>
  status === "HIGH" ? "text-status-down" : status === "MEDIUM" ? "text-status-idle" : "text-status-running";

function getMaintRecommendation(machine: { sensors: { vibration: number; temperature: number; load: number }; healthScore: number }): string {
  if (machine.sensors.vibration > 5) return "Inspect and replace spindle bearing";
  if (machine.sensors.temperature > 75) return "Check coolant system and thermal paste";
  if (machine.sensors.load > 90) return "Inspect drive belt and gearbox";
  if (machine.healthScore < 60) return "Full preventive maintenance overhaul required";
  return "Continue monitoring — schedule routine lubrication";
}

function estimatedDays(health: number): number {
  return Math.max(1, Math.round(health * 0.4));
}

export default function MaintenancePage() {
  const machines = useFilteredMachines();

  const failureRisk = (m: typeof machines[0]) => {
    let risk = 0;
    if (m.sensors.vibration > 5) risk += 35;
    else if (m.sensors.vibration > 3) risk += 20;
    if (m.sensors.temperature > 80) risk += 30;
    else if (m.sensors.temperature > 70) risk += 15;
    if (m.sensors.load > 90) risk += 20;
    risk += Math.max(0, 100 - m.healthScore) * 0.3;
    return Math.min(100, Math.round(risk));
  };

  const criticalCount = machines.filter((m) => failureRisk(m) >= 70).length;
  const mediumCount = machines.filter((m) => failureRisk(m) >= 40 && failureRisk(m) < 70).length;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Predictive Maintenance</h1>
          <p className="text-xs text-muted-foreground">AI-assisted machine health & failure prediction</p>
        </div>
        {criticalCount > 0 && (
          <div className="flex items-center gap-2 bg-status-down/10 border border-status-down/30 px-3 py-1.5 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-status-down" />
            <span className="text-xs font-semibold text-status-down">{criticalCount} machine{criticalCount > 1 ? "s" : ""} need urgent attention</span>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="industrial-card p-4 text-center">
          <AlertTriangle className="w-5 h-5 text-status-down mx-auto mb-2" />
          <div className="text-2xl font-mono font-bold text-status-down">{criticalCount}</div>
          <div className="text-xs text-muted-foreground">Critical Risk</div>
        </div>
        <div className="industrial-card p-4 text-center">
          <AlertTriangle className="w-5 h-5 text-status-idle mx-auto mb-2" />
          <div className="text-2xl font-mono font-bold text-status-idle">{mediumCount}</div>
          <div className="text-xs text-muted-foreground">Medium Risk</div>
        </div>
        <div className="industrial-card p-4 text-center">
          <Heart className="w-5 h-5 text-status-running mx-auto mb-2" />
          <div className="text-2xl font-mono font-bold text-status-running">{machines.filter((m) => failureRisk(m) < 40).length}</div>
          <div className="text-xs text-muted-foreground">Healthy</div>
        </div>
      </div>

      {/* Machine Health Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        {machines.map((m) => {
          const risk = failureRisk(m);
          const { label: riskLabel, cls: riskCls } = RISK_LABEL(risk);
          const days = estimatedDays(m.healthScore);
          const vibStatus = SENSOR_STATUS(m.sensors.vibration, 3, 5);
          const tempStatus = SENSOR_STATUS(m.sensors.temperature, 70, 80);
          const loadStatus = SENSOR_STATUS(m.sensors.load, 80, 95);

          return (
            <div key={m.id} className={cn("industrial-card p-4 border", risk >= 70 ? "border-status-down/40" : risk >= 40 ? "border-status-idle/40" : "border-industrial-border")}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-white">{m.name}</h3>
                  <p className="text-[11px] text-muted-foreground">{m.type}</p>
                </div>
                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded border", riskCls)}>{riskLabel}</span>
              </div>

              {/* Health Score */}
              <div className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground flex items-center gap-1"><Heart className="w-3 h-3" /> Health Score</span>
                  <span className={cn("font-mono font-bold", HEALTH_COLOR(m.healthScore))}>{m.healthScore}%</span>
                </div>
                <div className="h-2 bg-industrial-border rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all duration-500", HEALTH_BG(m.healthScore))} style={{ width: `${m.healthScore}%` }} />
                </div>
              </div>

              {/* Failure Risk */}
              <div className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Failure Risk</span>
                  <span className={cn("font-mono font-bold", risk >= 70 ? "text-status-down" : risk >= 40 ? "text-status-idle" : "text-status-running")}>{risk}%</span>
                </div>
                <div className="h-2 bg-industrial-border rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full", risk >= 70 ? "bg-status-down" : risk >= 40 ? "bg-status-idle" : "bg-status-running")} style={{ width: `${risk}%` }} />
                </div>
              </div>

              {/* Sensor Status */}
              <div className="grid grid-cols-3 gap-1.5 mb-3">
                {[
                  { label: "Vibration", status: vibStatus },
                  { label: "Temp", status: tempStatus },
                  { label: "Load", status: loadStatus },
                ].map(({ label, status }) => (
                  <div key={label} className="bg-industrial-surface rounded p-1.5 text-center">
                    <div className={cn("text-[10px] font-bold", SENSOR_COLOR(status))}>{status}</div>
                    <div className="text-[9px] text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>

              {/* Recommendation */}
              <div className="bg-industrial-surface rounded p-2.5 mb-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Recommendation</div>
                <p className="text-xs text-white">{getMaintRecommendation(m)}</p>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Est. life:</span>
                  <span className="font-mono font-semibold text-white">{days} days</span>
                </div>
                <button className="text-[11px] font-medium text-brand-primary border border-brand-primary/30 px-2.5 py-1 rounded hover:bg-brand-primary/10 transition-colors flex items-center gap-1">
                  <Wrench className="w-3 h-3" />
                  Create Job
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

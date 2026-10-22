import { useNavigate } from "react-router-dom";
import type { Machine } from "@/types/machine";
import StatusBadge from "@/components/cards/StatusBadge";
import { Thermometer, Zap, Activity, Eye } from "lucide-react";
import { cn, achievementPct } from "@/lib/utils";

interface MachineCardProps {
  machine: Machine;
}

const OEE_COLOR = (v: number) =>
  v >= 85 ? "text-status-running" : v >= 65 ? "text-status-idle" : "text-status-down";

export default function MachineCard({ machine }: MachineCardProps) {
  const navigate = useNavigate();

  return (
    <div
      className={cn(
        "industrial-card p-4 hover:border-industrial-border-light transition-all duration-200 cursor-pointer group",
        machine.status === "down" && "border-status-down/30",
        machine.status === "maintenance" && "border-brand-primary/30"
      )}
      onClick={() => navigate(`/machines/${machine.id}`)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-white group-hover:text-brand-primary transition-colors">
            {machine.name}
          </h3>
          <p className="text-[11px] text-muted-foreground">{machine.type}</p>
          <p className="text-[11px] text-muted-foreground/60">{machine.line}</p>
        </div>
        <StatusBadge status={machine.status} />
      </div>

      {/* OEE Metrics */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {[
          { label: "OEE", value: machine.oee.oee },
          { label: "Avail", value: machine.oee.availability },
          { label: "Perf", value: machine.oee.performance },
          { label: "Qual", value: machine.oee.quality },
        ].map(({ label, value }) => (
          <div key={label} className="text-center">
            <div className={cn("text-sm font-mono font-bold", OEE_COLOR(value))}>
              {machine.status === "down" || machine.status === "maintenance" ? "--" : `${value.toFixed(1)}%`}
            </div>
            <div className="text-[10px] text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="border-t border-industrial-border mb-3" />

      {/* Sensors */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="flex items-center gap-1.5">
          <Thermometer className="w-3 h-3 text-status-idle flex-shrink-0" />
          <div>
            <div className="text-xs font-mono font-medium text-white">{machine.sensors.temperature.toFixed(1)}°C</div>
            <div className="text-[10px] text-muted-foreground">Temp</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Activity className="w-3 h-3 text-brand-accent flex-shrink-0" />
          <div>
            <div className="text-xs font-mono font-medium text-white">{machine.sensors.vibration.toFixed(1)}</div>
            <div className="text-[10px] text-muted-foreground">mm/s</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Zap className="w-3 h-3 text-status-running flex-shrink-0" />
          <div>
            <div className="text-xs font-mono font-medium text-white">{machine.sensors.power.toFixed(1)} kW</div>
            <div className="text-[10px] text-muted-foreground">Power</div>
          </div>
        </div>
      </div>

      {/* Production */}
      {machine.status !== "maintenance" && (
        <div className="bg-industrial-surface rounded p-2">
          <div className="flex justify-between text-[11px]">
            <span className="text-muted-foreground">Output</span>
            <span className="font-mono text-white font-medium">{machine.production.actual.toLocaleString()} / {machine.production.target.toLocaleString()}</span>
          </div>
          <div className="mt-1 h-1 bg-industrial-border rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-primary rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, achievementPct(machine.production.actual, machine.production.target))}%` }}
            />
          </div>
        </div>
      )}

      {/* View Button */}
      <button className="mt-3 w-full text-xs text-brand-primary border border-brand-primary/30 rounded py-1.5 hover:bg-brand-primary/10 transition-colors flex items-center justify-center gap-1.5 font-medium">
        <Eye className="w-3.5 h-3.5" />
        View Details
      </button>
    </div>
  );
}

import { useState } from "react";
import { useFilteredMachines } from "@/hooks/useFilteredData";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import type { Machine } from "@/types/machine";
import { X, Thermometer, Zap, Activity } from "lucide-react";
import { cn, achievementPct } from "@/lib/utils";

const STATUS_COLORS = {
  running: { border: "border-status-running/60", bg: "bg-status-running/10", dot: "bg-status-running", text: "text-status-running" },
  idle: { border: "border-status-idle/60", bg: "bg-status-idle/10", dot: "bg-status-idle", text: "text-status-idle" },
  down: { border: "border-status-down/60", bg: "bg-status-down/10", dot: "bg-status-down animate-pulse", text: "text-status-down" },
  maintenance: { border: "border-brand-primary/60", bg: "bg-brand-primary/10", dot: "bg-brand-primary", text: "text-brand-primary" },
};

export default function PlantViewPage() {
  const machines = useFilteredMachines();
  const selectedPlant = useAuthStore((s) => s.selectedPlant);
  const [selected, setSelected] = useState<Machine | null>(null);
  const navigate = useNavigate();

  const rowChunks: Machine[][] = [];
  for (let i = 0; i < machines.length; i += 3) rowChunks.push(machines.slice(i, i + 3));

  const rows = [0, 1, 2];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Plant Floor View</h1>
          <p className="text-xs text-muted-foreground">{selectedPlant} · Click any machine to view details</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          {[
            { color: "bg-status-running", label: "Running" },
            { color: "bg-status-idle", label: "Idle" },
            { color: "bg-status-down", label: "Down" },
            { color: "bg-brand-primary", label: "Maintenance" },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className={cn("w-2.5 h-2.5 rounded-full", color)} />
              <span className="text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Plant Layout */}
        <div className={cn("industrial-card p-6", selected ? "col-span-2" : "col-span-3")}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Production Floor — {selectedPlant}</h3>
            <span className="live-indicator text-[11px]">Live</span>
          </div>

          {/* Grid */}
          {machines.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
              No machines available for {selectedPlant}
            </div>
          ) : (
          <div className="space-y-6">
            {rows.map((row) => {
              const rowLabel = row === 0 ? "Production Line A" : row === 1 ? "Production Line B" : "Production Line C";
              const rowItems = rowChunks[row] ?? [];
              if (rowItems.length === 0) return null;
              return (
                <div key={row}>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-3 flex items-center gap-2">
                    <div className="flex-1 h-px bg-industrial-border" />
                    {rowLabel}
                    <div className="flex-1 h-px bg-industrial-border" />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {rowItems.map((m) => {
                      const cfg = STATUS_COLORS[m.status];
                      const isSelected = selected?.id === m.id;

                      return (
                        <div
                          key={m.id}
                          onClick={() => setSelected(isSelected ? null : m)}
                          className={cn(
                            "border rounded-xl p-4 cursor-pointer transition-all duration-200 hover:scale-[1.02]",
                            cfg.border, cfg.bg,
                            isSelected && "ring-2 ring-brand-primary ring-offset-2 ring-offset-industrial-bg"
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-white">{m.name}</span>
                            <span className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", cfg.dot)} />
                          </div>
                          <div className="text-[10px] text-muted-foreground mb-2">{m.type}</div>
                          <div className={cn("text-lg font-mono font-bold", cfg.text)}>
                            {m.status === "running" ? `${m.oee.oee.toFixed(1)}%` :
                              m.status === "idle" ? "IDLE" :
                              m.status === "down" ? "DOWN" : "MAINT"}
                          </div>
                          {m.status === "running" && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">OEE</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>

        {/* Side Panel */}
        {selected && (
          <div className="industrial-card p-4 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white">{selected.name}</h3>
              <button onClick={() => setSelected(null)} className="p-1 rounded hover:bg-industrial-hover">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div className={cn("px-3 py-2 rounded-md mb-4 border text-sm font-semibold flex items-center gap-2",
              STATUS_COLORS[selected.status].border, STATUS_COLORS[selected.status].bg, STATUS_COLORS[selected.status].text
            )}>
              <span className={cn("w-2 h-2 rounded-full", STATUS_COLORS[selected.status].dot)} />
              {selected.status.toUpperCase()}
            </div>

            {/* OEE */}
            <div className="space-y-2 mb-4">
              {[
                { label: "OEE", value: selected.oee.oee },
                { label: "Availability", value: selected.oee.availability },
                { label: "Performance", value: selected.oee.performance },
                { label: "Quality", value: selected.oee.quality },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-mono font-bold text-white">
                    {selected.status === "down" || selected.status === "maintenance" ? "--" : `${value.toFixed(1)}%`}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-industrial-border pt-3 mb-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground"><Thermometer className="w-3 h-3" />Temp</span>
                <span className={cn("font-mono font-bold", selected.sensors.temperature > 75 ? "text-status-down" : "text-white")}>
                  {selected.sensors.temperature.toFixed(1)}°C
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground"><Activity className="w-3 h-3" />Vibration</span>
                <span className={cn("font-mono font-bold", selected.sensors.vibration > 5 ? "text-status-down" : "text-white")}>
                  {selected.sensors.vibration.toFixed(2)} mm/s
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground"><Zap className="w-3 h-3" />Power</span>
                <span className="font-mono font-bold text-white">{selected.sensors.power.toFixed(1)} kW</span>
              </div>
            </div>

            <div className="border-t border-industrial-border pt-3 mb-4">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Production</span>
                <span className="font-mono font-bold text-white">
                  {selected.production.actual.toLocaleString()} / {selected.production.target.toLocaleString()}
                </span>
              </div>
              <div className="h-1.5 bg-industrial-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-primary rounded-full"
                  style={{ width: `${Math.min(100, achievementPct(selected.production.actual, selected.production.target))}%` }}
                />
              </div>
            </div>

            <button
              onClick={() => navigate(`/machines/${selected.id}`)}
              className="w-full text-xs font-semibold text-white bg-brand-primary hover:bg-brand-primary/90 py-2 rounded-md transition-colors"
            >
              Open Full Details →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

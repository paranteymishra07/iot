import { useState } from "react";
import { useFilteredAlarms } from "@/hooks/useFilteredData";
import AlarmCard from "@/components/alarms/AlarmCard";
import { Bell, CheckCheck, Filter } from "lucide-react";
import type { AlarmSeverity, AlarmStatus } from "@/types/alarm";
import { cn } from "@/lib/utils";

type FilterStatus = AlarmStatus | "all";
type FilterSeverity = AlarmSeverity | "all";

export default function AlarmsPage() {
  const alarms = useFilteredAlarms();
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [severityFilter, setSeverityFilter] = useState<FilterSeverity>("all");

  const filtered = alarms.filter((a) => {
    const matchStatus = statusFilter === "all" || a.status === statusFilter;
    const matchSeverity = severityFilter === "all" || a.severity === severityFilter;
    return matchStatus && matchSeverity;
  });

  const counts = {
    active: alarms.filter((a) => a.status === "active").length,
    acknowledged: alarms.filter((a) => a.status === "acknowledged").length,
    resolved: alarms.filter((a) => a.status === "resolved").length,
    critical: alarms.filter((a) => a.severity === "critical" && a.status === "active").length,
    warning: alarms.filter((a) => a.severity === "warning" && a.status === "active").length,
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Alarm Center</h1>
          <p className="text-xs text-muted-foreground">{counts.active} active · {counts.acknowledged} acknowledged · {counts.resolved} resolved</p>
        </div>
        {counts.active > 0 && (
          <div className="flex items-center gap-2 bg-status-down/10 border border-status-down/30 px-3 py-1.5 rounded-lg">
            <Bell className="w-4 h-4 text-status-down animate-pulse" />
            <span className="text-xs font-semibold text-status-down">{counts.active} Active Alarms</span>
          </div>
        )}
      </div>

      {/* Alarm Stats */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Active", value: counts.active, color: "text-status-down", bg: "bg-status-down/10 border-status-down/30" },
          { label: "Acknowledged", value: counts.acknowledged, color: "text-status-idle", bg: "bg-status-idle/10 border-status-idle/30" },
          { label: "Resolved", value: counts.resolved, color: "text-status-running", bg: "bg-status-running/10 border-status-running/30" },
          { label: "Critical", value: counts.critical, color: "text-status-down", bg: "bg-status-down/5 border-status-down/20" },
          { label: "Warning", value: counts.warning, color: "text-status-idle", bg: "bg-status-idle/5 border-status-idle/20" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={cn("industrial-card border p-3 text-center", bg)}>
            <div className={cn("text-2xl font-mono font-bold", color)}>{value}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="industrial-card p-3 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Status:</span>
          {(["all", "active", "acknowledged", "resolved"] as FilterStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded border transition-colors",
                statusFilter === s
                  ? "bg-brand-primary/20 text-brand-primary border-brand-primary/40"
                  : "text-muted-foreground border-transparent hover:border-industrial-border"
              )}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Severity:</span>
          {(["all", "critical", "warning", "info"] as FilterSeverity[]).map((s) => (
            <button
              key={s}
              onClick={() => setSeverityFilter(s)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded border transition-colors",
                severityFilter === s
                  ? "bg-brand-primary/20 text-brand-primary border-brand-primary/40"
                  : "text-muted-foreground border-transparent hover:border-industrial-border"
              )}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Alarm List */}
      {filtered.length === 0 ? (
        <div className="industrial-card p-12 text-center">
          <CheckCheck className="w-8 h-8 text-status-running mx-auto mb-3 opacity-60" />
          <p className="text-sm font-semibold text-white mb-1">All Clear</p>
          <p className="text-xs text-muted-foreground">No alarms match your current filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((alarm) => <AlarmCard key={alarm.id} alarm={alarm} />)}
        </div>
      )}
    </div>
  );
}

import type { Alarm } from "@/types/alarm";
import { AlertOctagon, AlertTriangle, Info, CheckCircle, Eye } from "lucide-react";
import { useAlarmStore } from "@/stores/alarmStore";
import { useAuthStore } from "@/stores/authStore";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface AlarmCardProps {
  alarm: Alarm;
  compact?: boolean;
}

const SEVERITY_CONFIG = {
  critical: {
    icon: AlertOctagon,
    border: "border-status-down/50",
    bg: "bg-status-down/5",
    text: "text-status-down",
    badge: "badge-critical",
    label: "CRITICAL",
  },
  warning: {
    icon: AlertTriangle,
    border: "border-status-idle/50",
    bg: "bg-status-idle/5",
    text: "text-status-idle",
    badge: "badge-warning",
    label: "WARNING",
  },
  info: {
    icon: Info,
    border: "border-brand-primary/30",
    bg: "bg-brand-primary/5",
    text: "text-brand-primary",
    badge: "badge-info",
    label: "INFO",
  },
};

export default function AlarmCard({ alarm, compact = false }: AlarmCardProps) {
  const { acknowledgeAlarm, resolveAlarm } = useAlarmStore();
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const cfg = SEVERITY_CONFIG[alarm.severity];
  const SeverityIcon = cfg.icon;

  return (
    <div className={cn("industrial-card border rounded-lg transition-all", cfg.border, cfg.bg, compact ? "p-3" : "p-4")}>
      <div className="flex items-start gap-3">
        <div className={cn("flex-shrink-0 mt-0.5", cfg.text)}>
          <SeverityIcon className={compact ? "w-4 h-4" : "w-5 h-5"} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2 mb-1">
            <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded border", cfg.badge)}>{cfg.label}</span>
            <span className="text-xs font-semibold text-white">{alarm.machineName}</span>
            {alarm.status === "acknowledged" && (
              <span className="text-[10px] text-muted-foreground bg-industrial-surface px-1.5 py-0.5 rounded">ACK</span>
            )}
            {alarm.status === "resolved" && (
              <span className="text-[10px] text-status-running bg-status-running/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                <CheckCircle className="w-2.5 h-2.5" /> Resolved
              </span>
            )}
          </div>

          <p className="text-sm font-semibold text-white mb-0.5">{alarm.title}</p>

          {!compact && (
            <p className="text-xs text-muted-foreground mb-1">{alarm.message}</p>
          )}

          <div className="flex items-center gap-3 text-[11px]">
            <span className={cn("font-mono font-semibold", cfg.text)}>{alarm.value}</span>
            {!compact && <span className="text-muted-foreground/60">Threshold: {alarm.threshold}</span>}
            <span className="text-muted-foreground/60">{formatDistanceToNow(alarm.timestamp, { addSuffix: true })}</span>
          </div>

          {!compact && alarm.status === "active" && (
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => acknowledgeAlarm(alarm.id, user?.name || "Unknown")}
                className="px-3 py-1.5 text-xs font-medium bg-industrial-surface border border-industrial-border rounded hover:bg-industrial-hover transition-colors text-white"
              >
                Acknowledge
              </button>
              <button
                onClick={() => navigate(`/machines/${alarm.machineId}`)}
                className="px-3 py-1.5 text-xs font-medium text-brand-primary border border-brand-primary/30 rounded hover:bg-brand-primary/10 transition-colors flex items-center gap-1.5"
              >
                <Eye className="w-3 h-3" /> View Machine
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

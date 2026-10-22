import { cn } from "@/lib/utils";
import type { MachineStatus } from "@/types/machine";

interface StatusBadgeProps {
  status: MachineStatus;
  showDot?: boolean;
  className?: string;
}

const STATUS_CONFIG = {
  running: { label: "Running", dot: "bg-status-running", badge: "bg-status-running/15 text-status-running border-status-running/30" },
  idle: { label: "Idle", dot: "bg-status-idle", badge: "bg-status-idle/15 text-status-idle border-status-idle/30" },
  down: { label: "Down", dot: "bg-status-down animate-pulse", badge: "bg-status-down/15 text-status-down border-status-down/30" },
  maintenance: { label: "Maintenance", dot: "bg-brand-primary", badge: "bg-brand-primary/15 text-brand-primary border-brand-primary/30" },
};

export default function StatusBadge({ status, showDot = true, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 border rounded text-xs px-2 py-0.5 font-medium", config.badge, className)}>
      {showDot && <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", config.dot)} />}
      {config.label.toUpperCase()}
    </span>
  );
}

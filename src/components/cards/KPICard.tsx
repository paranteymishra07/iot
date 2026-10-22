import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KPICardProps {
  label: string;
  value: string;
  unit?: string;
  trend?: number;
  icon?: LucideIcon;
  color?: "blue" | "green" | "amber" | "red" | "cyan";
  subtitle?: string;
  className?: string;
}

const COLOR_MAP = {
  blue: "text-brand-primary border-brand-primary/30 bg-brand-primary/5",
  green: "text-status-running border-status-running/30 bg-status-running/5",
  amber: "text-status-idle border-status-idle/30 bg-status-idle/5",
  red: "text-status-down border-status-down/30 bg-status-down/5",
  cyan: "text-brand-accent border-brand-accent/30 bg-brand-accent/5",
};

const ICON_BG = {
  blue: "bg-brand-primary/15 text-brand-primary",
  green: "bg-status-running/15 text-status-running",
  amber: "bg-status-idle/15 text-status-idle",
  red: "bg-status-down/15 text-status-down",
  cyan: "bg-brand-accent/15 text-brand-accent",
};

export default function KPICard({ label, value, unit, trend, icon: Icon, color = "blue", subtitle, className }: KPICardProps) {
  const isPositive = trend !== undefined && trend > 0;
  const isNegative = trend !== undefined && trend < 0;

  return (
    <div className={cn("industrial-card p-4 hover:border-industrial-border-light transition-colors", className)}>
      <div className="flex items-start justify-between mb-3">
        <p className="metric-label">{label}</p>
        {Icon && (
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", ICON_BG[color])}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="flex items-end gap-1">
        <span className={cn("font-mono font-bold text-white", value.length > 6 ? "text-xl" : "text-2xl")}>
          {value}
        </span>
        {unit && <span className="text-muted-foreground text-sm mb-0.5">{unit}</span>}
      </div>

      <div className="mt-2 flex items-center gap-2">
        {trend !== undefined && (
          <div className={cn("flex items-center gap-0.5 text-xs font-medium", isPositive ? "text-status-running" : isNegative ? "text-status-down" : "text-muted-foreground")}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : isNegative ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
            {Math.abs(trend)}%
          </div>
        )}
        {subtitle && <span className="text-[11px] text-muted-foreground">{subtitle}</span>}
      </div>
    </div>
  );
}

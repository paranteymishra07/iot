import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Download, Calendar, BarChart2, Package, AlertTriangle, Zap, Wrench, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

const REPORT_CATEGORIES = [
  {
    id: "oee",
    icon: BarChart2,
    label: "OEE Reports",
    color: "text-brand-primary",
    bg: "bg-brand-primary/10 border-brand-primary/30",
    reports: ["OEE Daily Summary", "Weekly OEE Analysis", "Monthly OEE Trend", "Shift-wise OEE", "Machine vs Machine Comparison"],
  },
  {
    id: "production",
    icon: Package,
    label: "Production",
    color: "text-status-running",
    bg: "bg-status-running/10 border-status-running/30",
    reports: ["Production Summary", "Machine Production Report", "Reject Analysis", "Shift Performance", "Hourly Output"],
  },
  {
    id: "downtime",
    icon: AlertTriangle,
    label: "Downtime",
    color: "text-status-down",
    bg: "bg-status-down/10 border-status-down/30",
    reports: ["Downtime Summary", "Pareto Analysis", "Downtime by Machine", "Downtime by Reason", "MTTR / MTBF Report"],
  },
  {
    id: "energy",
    icon: Zap,
    label: "Energy",
    color: "text-status-idle",
    bg: "bg-status-idle/10 border-status-idle/30",
    reports: ["Daily Energy Consumption", "Machine-wise Energy", "Energy Cost Report", "Peak Demand Analysis", "kWh per Unit"],
  },
  {
    id: "maintenance",
    icon: Wrench,
    label: "Maintenance",
    color: "text-brand-accent",
    bg: "bg-brand-accent/10 border-brand-accent/30",
    reports: ["Alarm History", "Maintenance History", "Machine Health Report", "Scheduled Jobs", "MTBF Analysis"],
  },
];

const RECENT = [
  { name: "OEE Weekly Report", date: "Aug 25, 2026", type: "PDF", size: "2.4 MB" },
  { name: "Production Summary — Aug", date: "Aug 25, 2026", type: "Excel", size: "1.8 MB" },
  { name: "Energy Cost — Q3", date: "Aug 20, 2026", type: "Excel", size: "3.1 MB" },
  { name: "Alarm History Report", date: "Aug 18, 2026", type: "PDF", size: "0.9 MB" },
  { name: "Downtime Pareto — Aug", date: "Aug 15, 2026", type: "CSV", size: "0.4 MB" },
];

// Reports already backed by a real aggregate endpoint. Everything else in the
// catalog below is still a placeholder until its own report is built.
const LIVE_REPORTS: Record<string, string> = {
  "Shift Performance": "/reports/shift",
  "Shift-wise OEE": "/reports/shift",
};

type ExportFormat = "PDF" | "Excel" | "CSV";

export default function ReportsPage() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState("oee");
  const [dateRange, setDateRange] = useState("today");
  const [generating, setGenerating] = useState<string | null>(null);

  const handleGenerate = (report: string, format: ExportFormat) => {
    const livePath = LIVE_REPORTS[report];
    if (livePath) {
      navigate(`${livePath}?format=${format}`);
      return;
    }
    setGenerating(`${report}-${format}`);
    setTimeout(() => setGenerating(null), 1500);
  };

  const cat = REPORT_CATEGORIES.find((c) => c.id === selectedCategory)!;

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-lg font-bold text-white">Reports</h1>
        <p className="text-xs text-muted-foreground">Generate and export plant performance reports</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Left: Category + Config */}
        <div className="space-y-4">
          {/* Category Selector */}
          <div className="industrial-card p-3 space-y-1">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-2 pb-1">Report Type</p>
            {REPORT_CATEGORIES.map((c) => {
              const Icon = c.icon;
              const isActive = selectedCategory === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCategory(c.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-all",
                    isActive ? cn("border", c.bg, c.color) : "text-muted-foreground hover:bg-industrial-hover hover:text-white"
                  )}
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  {c.label}
                </button>
              );
            })}
          </div>

          {/* Date Range */}
          <div className="industrial-card p-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
              <Calendar className="w-3 h-3" /> Date Range
            </p>
            {["today", "yesterday", "this_week", "last_week", "this_month", "last_month", "custom"].map((d) => (
              <button
                key={d}
                onClick={() => setDateRange(d)}
                className={cn(
                  "w-full text-left px-3 py-1.5 rounded text-xs transition-colors mb-0.5",
                  dateRange === d ? "bg-brand-primary/20 text-brand-primary" : "text-muted-foreground hover:bg-industrial-hover hover:text-white"
                )}
              >
                {d === "today" ? "Today" : d === "yesterday" ? "Yesterday" : d === "this_week" ? "This Week" : d === "last_week" ? "Last Week" : d === "this_month" ? "This Month" : d === "last_month" ? "Last Month" : "Custom Range"}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Reports List */}
        <div className="col-span-2 space-y-4">
          <div className="industrial-card p-4">
            <div className="flex items-center gap-2 mb-4">
              <cat.icon className={cn("w-4 h-4", cat.color)} />
              <h3 className="text-sm font-semibold text-white">{cat.label}</h3>
            </div>
            <div className="space-y-2">
              {cat.reports.map((report) => {
                const isLive = Boolean(LIVE_REPORTS[report]);
                return (
                <div key={report} className="flex items-center justify-between bg-industrial-surface rounded-md px-3 py-3 hover:bg-industrial-hover transition-colors">
                  <div className="flex items-center gap-2.5">
                    <FileText className={cn("w-3.5 h-3.5", isLive ? "text-status-running" : "text-muted-foreground")} />
                    <span className="text-sm text-white">{report}</span>
                    {isLive && (
                      <span className="text-[9px] uppercase tracking-widest text-status-running border border-status-running/30 bg-status-running/10 px-1.5 py-0.5 rounded">Live</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isLive && (
                      <button
                        onClick={() => navigate(LIVE_REPORTS[report])}
                        className="flex items-center gap-1 px-2 py-1 rounded border border-brand-primary/40 text-brand-primary hover:bg-brand-primary/10 text-[11px] font-medium transition-colors"
                      >
                        <ExternalLink className="w-2.5 h-2.5" />
                        Open
                      </button>
                    )}
                    {(["PDF", "Excel", "CSV"] as ExportFormat[]).map((fmt) => {
                      const key = `${report}-${fmt}`;
                      const isLoading = generating === key;
                      return (
                        <button
                          key={fmt}
                          onClick={() => handleGenerate(report, fmt)}
                          disabled={isLoading}
                          className={cn(
                            "flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-medium transition-colors",
                            fmt === "PDF" ? "border-status-down/40 text-status-down hover:bg-status-down/10" :
                            fmt === "Excel" ? "border-status-running/40 text-status-running hover:bg-status-running/10" :
                            "border-brand-accent/40 text-brand-accent hover:bg-brand-accent/10",
                            isLoading && "opacity-60"
                          )}
                        >
                          <Download className="w-2.5 h-2.5" />
                          {isLoading ? "..." : fmt}
                        </button>
                      );
                    })}
                  </div>
                </div>
                );
              })}
            </div>
          </div>

          {/* Recent Reports */}
          <div className="industrial-card p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Recent Reports</h3>
            <div className="space-y-2">
              {RECENT.map((r) => (
                <div key={r.name} className="flex items-center justify-between py-2 border-b border-industrial-border/40 last:border-0">
                  <div className="flex items-center gap-2.5">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                    <div>
                      <div className="text-xs font-medium text-white">{r.name}</div>
                      <div className="text-[10px] text-muted-foreground">{r.date} · {r.size}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium",
                      r.type === "PDF" ? "text-status-down border-status-down/30" :
                      r.type === "Excel" ? "text-status-running border-status-running/30" :
                      "text-brand-accent border-brand-accent/30"
                    )}>{r.type}</span>
                    <button className="text-muted-foreground hover:text-white transition-colors">
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

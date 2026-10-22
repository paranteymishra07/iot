import { useState, useMemo } from "react";
import { useFilteredMachines } from "@/hooks/useFilteredData";
import MachineCard from "@/components/machines/MachineCard";
import { Search } from "lucide-react";
import type { MachineStatus } from "@/types/machine";
import { cn } from "@/lib/utils";

type FilterStatus = "all" | MachineStatus;

const STATUS_FILTERS: { label: string; value: FilterStatus }[] = [
  { label: "All", value: "all" },
  { label: "Running", value: "running" },
  { label: "Idle", value: "idle" },
  { label: "Down", value: "down" },
  { label: "Maintenance", value: "maintenance" },
];

const STATUS_BADGE_CLASSES: Record<string, string> = {
  all: "text-white border-industrial-border",
  running: "text-status-running border-status-running/40",
  idle: "text-status-idle border-status-idle/40",
  down: "text-status-down border-status-down/40",
  maintenance: "text-brand-primary border-brand-primary/40",
};

export default function MachinesPage() {
  const machines = useFilteredMachines();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");

  const filtered = useMemo(() =>
    machines.filter((m) => {
      const matchSearch = m.name.toLowerCase().includes(search.toLowerCase()) || m.type.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || m.status === statusFilter;
      return matchSearch && matchStatus;
    }),
    [machines, search, statusFilter]
  );

  const counts = useMemo(() => ({
    all: machines.length,
    running: machines.filter((m) => m.status === "running").length,
    idle: machines.filter((m) => m.status === "idle").length,
    down: machines.filter((m) => m.status === "down").length,
    maintenance: machines.filter((m) => m.status === "maintenance").length,
  }), [machines]);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Machine Monitoring</h1>
          <p className="text-xs text-muted-foreground">{filtered.length} of {machines.length} machines · Live updates</p>
        </div>
        <span className="live-indicator text-[11px]">Live</span>
      </div>

      {/* Filters */}
      <div className="industrial-card p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search machines..."
            className="w-full bg-industrial-surface border border-industrial-border rounded-md pl-8 pr-3 py-2 text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-brand-primary"
          />
        </div>

        <div className="flex items-center gap-1.5">
          {STATUS_FILTERS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={cn(
                "px-2.5 py-1.5 text-xs font-medium border rounded-md transition-colors",
                statusFilter === value
                  ? cn("bg-industrial-hover", STATUS_BADGE_CLASSES[value])
                  : "text-muted-foreground border-transparent hover:border-industrial-border"
              )}
            >
              {label} <span className="ml-1 opacity-60">({counts[value]})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="industrial-card p-12 text-center">
          <p className="text-muted-foreground">No machines match your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((machine) => (
            <MachineCard key={machine.id} machine={machine} />
          ))}
        </div>
      )}
    </div>
  );
}

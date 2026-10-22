import { NavLink } from "react-router-dom";
import { Building2, MapPin, GitBranch, Cog, ArrowRight, TrendingUp } from "lucide-react";
import { useMasterDataStore } from "@/stores/masterDataStore";

export default function SuperAdminOverview() {
  const companies = useMasterDataStore((s) => s.companies);
  const plants = useMasterDataStore((s) => s.plants);
  const lines = useMasterDataStore((s) => s.lines);
  const machines = useMasterDataStore((s) => s.machines);

  const activeCompanies = companies.filter((c) => c.status === "active").length;
  const activePlants = plants.filter((p) => p.status === "active").length;
  const activeLines = lines.filter((l) => l.status === "active").length;
  const activeMachines = machines.filter((m) => m.status === "active").length;

  const stats = [
    { label: "Companies", total: companies.length, active: activeCompanies, icon: Building2, color: "text-brand-primary", bg: "bg-brand-primary/10", border: "border-brand-primary/30", path: "/super-admin/companies" },
    { label: "Plants", total: plants.length, active: activePlants, icon: MapPin, color: "text-brand-accent", bg: "bg-brand-accent/10", border: "border-brand-accent/30", path: "/super-admin/plants" },
    { label: "Production Lines", total: lines.length, active: activeLines, icon: GitBranch, color: "text-status-running", bg: "bg-status-running/10", border: "border-status-running/30", path: "/super-admin/lines" },
    { label: "Machines", total: machines.length, active: activeMachines, icon: Cog, color: "text-status-idle", bg: "bg-status-idle/10", border: "border-status-idle/30", path: "/super-admin/machines" },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-lg font-bold text-white">Super Admin Dashboard</h1>
        <p className="text-xs text-muted-foreground">Master data management overview</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {stats.map((s) => (
          <NavLink key={s.label} to={s.path} className="industrial-card p-4 group hover:border-brand-primary/40 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg ${s.bg} border ${s.border} flex items-center justify-center`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-2xl font-mono font-bold text-white">{s.total}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className="flex items-center gap-1 mt-2">
              <TrendingUp className="w-3 h-3 text-status-running" />
              <span className="text-[10px] text-status-running font-medium">{s.active} active</span>
            </div>
          </NavLink>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="industrial-card p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Recent Companies</h3>
          <div className="space-y-2">
            {companies.slice(0, 3).map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b border-industrial-border/40 last:border-0">
                <div>
                  <div className="text-xs font-semibold text-white">{c.name}</div>
                  <div className="text-[10px] text-muted-foreground">{c.code} · {c.contactPerson}</div>
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${c.status === "active" ? "text-status-running border-status-running/30 bg-status-running/10" : "text-muted-foreground border-industrial-border/40 bg-transparent"}`}>
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="industrial-card p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Plants by Company</h3>
          <div className="space-y-2">
            {companies.filter((c) => c.status === "active").map((c) => {
              const count = plants.filter((p) => p.companyId === c.id).length;
              return (
                <div key={c.id} className="flex items-center justify-between py-2 border-b border-industrial-border/40 last:border-0">
                  <div className="text-xs font-medium text-white">{c.name}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{count} plant{count !== 1 ? "s" : ""}</span>
                    <div className="w-16 h-1.5 bg-industrial-surface rounded-full overflow-hidden">
                      <div className="h-full bg-brand-primary rounded-full" style={{ width: `${Math.min((count / Math.max(plants.length, 1)) * 100, 100)}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

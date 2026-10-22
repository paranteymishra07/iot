import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Factory, MapPin, BarChart2, Package,
  AlertTriangle, Zap, Wrench, Bell, FileText, Cpu, Users,
  Settings, ChevronRight, Activity, Building2, GitBranch, Cog, Shield, CalendarDays,
  Clock, PartyPopper, Wallet, BarChart3
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAlarmStore } from "@/stores/alarmStore";
import { useAuthStore } from "@/stores/authStore";
import { useFilteredAlarms } from "@/hooks/useFilteredData";
import { cn } from "@/lib/utils";

// Only the overview entry matches exactly, so "exact" is optional here.
type NavItem = { path: string; icon: LucideIcon; label: string; exact?: boolean; badge?: boolean };

const NAV_ITEMS: NavItem[] = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/machines", icon: Factory, label: "Machines" },
  { path: "/plant-view", icon: MapPin, label: "Plant View" },
  { path: "/oee", icon: BarChart2, label: "OEE Analytics" },
  { path: "/production", icon: Package, label: "Production" },
  { path: "/downtime", icon: AlertTriangle, label: "Downtime" },
  { path: "/energy", icon: Zap, label: "Energy" },
  { path: "/maintenance", icon: Wrench, label: "Maintenance" },
  { path: "/alarms", icon: Bell, label: "Alarms", badge: true },
  { path: "/reports", icon: FileText, label: "Reports" },
];

const ADMIN_ITEMS: NavItem[] = [
  { path: "/devices", icon: Cpu, label: "Devices" },
  { path: "/users", icon: Users, label: "Users" },
  { path: "/settings", icon: Settings, label: "Settings" },
];

const SUPER_ADMIN_ITEMS: NavItem[] = [
  { path: "/super-admin", icon: Shield, label: "Overview", exact: true },
  { path: "/super-admin/companies", icon: Building2, label: "Companies" },
  { path: "/super-admin/plants", icon: MapPin, label: "Plants" },
  { path: "/super-admin/lines", icon: GitBranch, label: "Production Lines" },
  { path: "/super-admin/machines", icon: Cog, label: "Machines" },
  { path: "/super-admin/downtime-reasons", icon: AlertTriangle, label: "Downtime Reasons" },
];

const OEM_ADMIN_ITEMS: NavItem[] = [
  { path: "/super-admin/plants", icon: MapPin, label: "Plants" },
  { path: "/super-admin/lines", icon: GitBranch, label: "Production Lines" },
  { path: "/super-admin/machines", icon: Cog, label: "Machines" },
];

const SHIFT_ADMIN_ITEMS: NavItem[] = [
  { path: "/shifts", icon: CalendarDays, label: "Shift Management" },
];

// HR is a workforce-only role: operators, attendance, holidays, salary and HR
// reports. It gets no plant, production, machine or admin navigation at all.
const HR_ITEMS: NavItem[] = [
  { path: "/hr/operators", icon: Users, label: "Manage Operators" },
  { path: "/hr/attendance", icon: Clock, label: "Attendance" },
  { path: "/hr/holidays", icon: PartyPopper, label: "Manage Holiday" },
  { path: "/hr/salary", icon: Wallet, label: "Manage Salary" },
  { path: "/hr/reports", icon: BarChart3, label: "Reports" },
];

export default function Sidebar() {
  const location = useLocation();
  const filteredAlarms = useFilteredAlarms();
  const activeAlarms = filteredAlarms.filter((a) => a.status === "active").length;
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === "super_admin";
  const isOemAdmin = user?.role === "oem_admin";
  const showMasterData = isSuperAdmin || isOemAdmin;
  const masterDataItems = isSuperAdmin ? SUPER_ADMIN_ITEMS : OEM_ADMIN_ITEMS;
  const showShiftAdmin = isSuperAdmin || isOemAdmin || user?.role === "plant_manager";
  const isHr = user?.role === "hr";
  const showHr = isSuperAdmin || isOemAdmin || user?.role === "plant_manager" || isHr;

  return (
    <aside className="w-[220px] flex-shrink-0 flex flex-col h-full bg-[#080b13] border-r border-industrial-border">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-industrial-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-brand-primary flex items-center justify-center">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-tight">ByteMatrix</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Industrial IoT</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {/* HR is workforce-only: no plant, production, machine, admin or shift navigation. */}
        {!isHr && (
          <>
            {NAV_ITEMS.map(({ path, icon: Icon, label, badge }) => {
              const isActive = path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);
              return (
                <NavLink
                  key={path}
                  to={path}
                  className={cn("nav-item", isActive && "active")}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-xs">{label}</span>
                  {badge && activeAlarms > 0 && (
                    <span className="bg-status-down text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {activeAlarms}
                    </span>
                  )}
                  {isActive && <ChevronRight className="w-3 h-3 flex-shrink-0 opacity-60" />}
                </NavLink>
              );
            })}

            <div className="pt-4 pb-1">
              <p className="px-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Admin</p>
            </div>

            {ADMIN_ITEMS.map(({ path, icon: Icon, label }) => {
              const isActive = location.pathname.startsWith(path);
              return (
                <NavLink
                  key={path}
                  to={path}
                  className={cn("nav-item", isActive && "active")}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="text-xs">{label}</span>
                  {isActive && <ChevronRight className="w-3 h-3 flex-shrink-0 opacity-60" />}
                </NavLink>
              );
            })}

            {showShiftAdmin && (
              <>
                <div className="pt-4 pb-1">
                  <p className="px-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Workforce</p>
                </div>

                {SHIFT_ADMIN_ITEMS.map(({ path, icon: Icon, label }) => {
                  const isActive = location.pathname.startsWith(path);
                  return (
                    <NavLink
                      key={path}
                      to={path}
                      className={cn("nav-item", isActive && "active")}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="text-xs">{label}</span>
                      {isActive && <ChevronRight className="w-3 h-3 flex-shrink-0 opacity-60" />}
                    </NavLink>
                  );
                })}
              </>
            )}
          </>
        )}

        {showHr && (
          <>
            <div className="pt-4 pb-1">
              <p className="px-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">HR</p>
            </div>

            {HR_ITEMS.map(({ path, icon: Icon, label }) => {
              const isActive = location.pathname.startsWith(path);
              return (
                <NavLink
                  key={path}
                  to={path}
                  className={cn("nav-item", isActive && "active")}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="text-xs">{label}</span>
                  {isActive && <ChevronRight className="w-3 h-3 flex-shrink-0 opacity-60" />}
                </NavLink>
              );
            })}
          </>
        )}

        {showMasterData && (
          <>
            <div className="pt-4 pb-1">
              <p className="px-3 text-[10px] uppercase tracking-widest text-status-down font-semibold mb-1">{isSuperAdmin ? "Super Admin" : "Master Data"}</p>
            </div>

            {masterDataItems.map(({ path, icon: Icon, label, exact }) => {
              const isActive = exact ? location.pathname === path : location.pathname.startsWith(path) && location.pathname !== "/super-admin";
              const isOverviewActive = exact && location.pathname === path;
              return (
                <NavLink
                  key={path}
                  to={path}
                  className={cn("nav-item", (isActive || isOverviewActive) && "active")}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="text-xs">{label}</span>
                  {(isActive || isOverviewActive) && <ChevronRight className="w-3 h-3 flex-shrink-0 opacity-60" />}
                </NavLink>
              );
            })}
          </>
        )}
      </nav>

      {/* MQTT Status */}
      <div className="px-4 py-3 border-t border-industrial-border">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-status-running animate-pulse-slow"></span>
          <span className="text-[10px] text-muted-foreground">MQTT Connected</span>
        </div>
        <div className="text-[10px] text-muted-foreground/60 mt-0.5 font-mono">ws://broker:8083</div>
      </div>
    </aside>
  );
}

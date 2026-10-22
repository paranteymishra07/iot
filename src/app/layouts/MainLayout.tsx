import { Outlet, Navigate } from "react-router-dom";
import { useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { useAuthStore } from "@/stores/authStore";
import { useMasterDataStore } from "@/stores/masterDataStore";
import { useUserStore } from "@/stores/userStore";
import { useAlarmStore } from "@/stores/alarmStore";
import { useEnergyStore } from "@/stores/energyStore";
import { useMetricsRealtime } from "@/hooks/useMetricsRealtime";

export default function MainLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const fetchAll = useMasterDataStore((s) => s.fetchAll);
  const fetchUsers = useUserStore((s) => s.fetchUsers);
  const fetchAlarms = useAlarmStore((s) => s.fetchAlarms);
  const fetchEnergy = useEnergyStore((s) => s.fetchEnergy);
  useMetricsRealtime();

  useEffect(() => {
    if (isAuthenticated) {
      fetchAll();
      fetchUsers();
      fetchAlarms();
      fetchEnergy();
    }
  }, [isAuthenticated, fetchAll, fetchUsers, fetchAlarms, fetchEnergy]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-screen overflow-hidden bg-industrial-bg">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-5 bg-grid-pattern bg-grid">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

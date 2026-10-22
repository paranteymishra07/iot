import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "@/app/layouts/MainLayout";
import LoginPage from "@/pages/Login";
import OperatorPage from "@/pages/Operator";
import DashboardPage from "@/pages/Dashboard";
import MachinesPage from "@/pages/Machines";
import MachineDetailsPage from "@/pages/MachineDetails";
import OEEPage from "@/pages/OEE";
import ProductionPage from "@/pages/Production";
import DowntimePage from "@/pages/Downtime";
import EnergyPage from "@/pages/Energy";
import MaintenancePage from "@/pages/Maintenance";
import AlarmsPage from "@/pages/Alarms";
import PlantViewPage from "@/pages/PlantView";
import ReportsPage from "@/pages/Reports";
import ShiftReportPage from "@/pages/Reports/ShiftReport";
import DevicesPage from "@/pages/Devices";
import UsersPage from "@/pages/Users";
import SettingsPage from "@/pages/Settings";
import NotFoundPage from "@/pages/NotFound";
import SuperAdminOverview from "@/pages/SuperAdmin";
import CompaniesPage from "@/pages/SuperAdmin/Companies";
import PlantsPage from "@/pages/SuperAdmin/Plants";
import LinesPage from "@/pages/SuperAdmin/Lines";
import MachinesMasterPage from "@/pages/SuperAdmin/Machines";
import DowntimeReasonsPage from "@/pages/SuperAdmin/DowntimeReasons";
import ShiftsPage from "@/pages/Admin/Shifts";
import HrAttendancePage from "@/pages/HR/Attendance";
import HrHolidaysPage from "@/pages/HR/Holidays";
import HrOperatorsPage from "@/pages/HR/Operators";
import HrSalaryPage from "@/pages/HR/Salary";
import HrReportsPage from "@/pages/HR/Reports";
import HrRouteGuard from "@/app/HrRouteGuard";
import { Toaster } from "sonner";

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        theme="dark"
        toastOptions={{
          style: { background: "#161b2e", border: "1px solid #1e2540", color: "#f1f5f9" },
        }}
      />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/operator" element={<OperatorPage />} />
        <Route
          element={
            <HrRouteGuard>
              <MainLayout />
            </HrRouteGuard>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/machines" element={<MachinesPage />} />
          <Route path="/machines/:id" element={<MachineDetailsPage />} />
          <Route path="/plant-view" element={<PlantViewPage />} />
          <Route path="/oee" element={<OEEPage />} />
          <Route path="/production" element={<ProductionPage />} />
          <Route path="/downtime" element={<DowntimePage />} />
          <Route path="/energy" element={<EnergyPage />} />
          <Route path="/maintenance" element={<MaintenancePage />} />
          <Route path="/alarms" element={<AlarmsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/reports/shift" element={<ShiftReportPage />} />
          <Route path="/devices" element={<DevicesPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/shifts" element={<ShiftsPage />} />
          <Route path="/hr" element={<Navigate to="/hr/attendance" replace />} />
          <Route path="/hr/operators" element={<HrOperatorsPage />} />
          <Route path="/hr/attendance" element={<HrAttendancePage />} />
          <Route path="/hr/holidays" element={<HrHolidaysPage />} />
          <Route path="/hr/salary" element={<HrSalaryPage />} />
          <Route path="/hr/reports" element={<HrReportsPage />} />
          <Route path="/super-admin" element={<SuperAdminOverview />} />
          <Route path="/super-admin/companies" element={<CompaniesPage />} />
          <Route path="/super-admin/plants" element={<PlantsPage />} />
          <Route path="/super-admin/lines" element={<LinesPage />} />
          <Route path="/super-admin/machines" element={<MachinesMasterPage />} />
          <Route path="/super-admin/downtime-reasons" element={<DowntimeReasonsPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

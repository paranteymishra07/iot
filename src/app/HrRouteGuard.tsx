import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuthStore } from "@/stores/authStore";

/**
 * Sidebar hiding is only a convenience. An HR login has no business on the
 * dashboard, machines, production or admin screens, so anything outside /hr is
 * bounced back to the HR attendance screen. This is a client-side guard; the
 * API layer still needs its own role checks.
 */
export default function HrRouteGuard({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (user?.role === "hr" && !location.pathname.startsWith("/hr")) {
    return <Navigate to="/hr/attendance" replace />;
  }

  return <>{children}</>;
}

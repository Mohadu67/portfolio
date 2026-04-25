import { ReactNode } from "react";
import { AuthGuard } from "@/components/dashboard/shell/AuthGuard";
import { DashboardShell } from "@/components/dashboard/shell/DashboardShell";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <DashboardShell>{children}</DashboardShell>
    </AuthGuard>
  );
}

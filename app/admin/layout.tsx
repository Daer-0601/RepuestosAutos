import { PanelAppBackground } from "@/app/_components/panel-app-background";
import { requireAdmin } from "@/lib/auth/require-role";
import type { Metadata } from "next";
import { AdminSidebar } from "./admin-sidebar";

export const metadata: Metadata = {
  title: {
    template: "%s · Admin Repuestos",
    default: "Admin · Repuestos",
  },
};

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireAdmin();

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden text-slate-100 lg:flex-row">
      <PanelAppBackground />
      <AdminSidebar username={session.username} />
      <main className="relative z-10 min-h-0 flex-1 overflow-y-auto p-5 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}

import { PanelAppBackground } from "@/app/_components/panel-app-background";
import { requireVendedorContext } from "@/lib/auth/staff-panel-context";
import type { Metadata } from "next";
import { VendedorSidebar } from "./vendedor-sidebar";

export const metadata: Metadata = {
  title: {
    template: "%s · Vendedor Repuestos",
    default: "Vendedor · Repuestos",
  },
};

export default async function VendedorLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const ctx = await requireVendedorContext();

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden text-slate-100 lg:flex-row">
      <PanelAppBackground />
      <VendedorSidebar username={ctx.username} sucursalNombre={ctx.sucursalNombre} />
      <main className="relative z-10 min-h-0 flex-1 overflow-y-auto p-5 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}

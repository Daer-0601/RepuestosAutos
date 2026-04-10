import { PanelAppBackground } from "@/app/_components/panel-app-background";
import { requireSeller } from "@/lib/auth/require-role";
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
  const session = await requireSeller();

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden text-slate-100 lg:flex-row">
      <PanelAppBackground />
      <VendedorSidebar username={session.username} />
      <main className="relative z-10 min-h-0 flex-1 overflow-y-auto p-5 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}

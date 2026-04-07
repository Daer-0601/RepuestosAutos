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
    <div className="flex min-h-dvh flex-col bg-slate-950 text-slate-100 lg:flex-row">
      <VendedorSidebar username={session.username} />
      <main className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}

import { requireCashier } from "@/lib/auth/require-role";
import type { Metadata } from "next";
import { CajeroSidebar } from "./cajero-sidebar";

export const metadata: Metadata = {
  title: {
    template: "%s · Cajero Repuestos",
    default: "Cajero · Repuestos",
  },
};

export default async function CajeroLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireCashier();

  return (
    <div className="flex min-h-dvh flex-col bg-slate-950 text-slate-100 lg:flex-row">
      <CajeroSidebar username={session.username} />
      <main className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}

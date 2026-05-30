import { ClientesBloqueadosPanel } from "@/app/admin/clientes/bloqueados/_components/clientes-bloqueados-panel";
import { AdminPageShell } from "@/app/admin/_components/admin-page-shell";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Clientes bloqueados por crédito",
};

export default function AdminClientesBloqueadosPage() {
  return (
    <AdminPageShell
      title="Clientes bloqueados (crédito)"
      description="Clientes con crédito vencido sin pagar. Podés reactivarlos cuando regularicen o acuerden el pago."
      actions={
        <Link href="/admin/clientes" className="text-sm text-rose-400 hover:underline">
          ← Todos los clientes
        </Link>
      }
    >
      <ClientesBloqueadosPanel />
    </AdminPageShell>
  );
}

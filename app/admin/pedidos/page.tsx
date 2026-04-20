import { AdminPageShell } from "@/app/admin/_components/admin-page-shell";
import { PedidosExcelPanel } from "@/app/admin/pedidos/pedidos-excel-panel";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pedidos (Excel)",
};

export default function AdminPedidosPage() {
  return (
    <AdminPageShell
      backHref="/admin"
      backLabel="Inicio admin"
      title="Pedidos · Excel"
      description="Armá un pedido sumando productos del catálogo y descargá un archivo .xlsx listo para compartir o imprimir."
    >
      <PedidosExcelPanel />
    </AdminPageShell>
  );
}

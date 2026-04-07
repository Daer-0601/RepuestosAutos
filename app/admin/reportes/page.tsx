import { AdminSection } from "@/app/admin/_components/admin-section";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reportes",
};

export default function AdminReportesPage() {
  return (
    <AdminSection
      title="Reportes"
      description="Consultas globales y exportación por fechas y sucursal."
    >
      <ul className="list-inside list-disc space-y-2 text-slate-300">
        <li>Ventas y compras consolidadas</li>
        <li>Inventario por sucursal y rotación</li>
        <li>Créditos pendientes y cobranzas</li>
      </ul>
    </AdminSection>
  );
}

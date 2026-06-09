import { AdminPageShell } from "@/app/admin/_components/admin-page-shell";
import { BajaInventarioForm } from "@/app/admin/bajas-inventario/baja-inventario-form";
import { listSucursales } from "@/lib/data/sucursales";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Baja de inventario",
};

export default async function AdminBajasInventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const sucursales = (await listSucursales()).filter((s) => s.estado === "activo");

  return (
    <AdminPageShell
      backHref="/admin"
      backLabel="Inicio admin"
      title="Baja de inventario"
      description="Registrá salidas de stock por rotura, vencimiento o ajuste físico. El descuento usa FIFO en lotes, igual que ventas y traspasos."
      error={sp.error}
    >
      {sucursales.length === 0 ? (
        <p className="text-sm text-amber-200/90">
          No hay sucursales activas. Cargá sucursales antes de usar esta pantalla.
        </p>
      ) : (
        <BajaInventarioForm sucursales={sucursales} />
      )}
    </AdminPageShell>
  );
}

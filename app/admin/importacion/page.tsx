import { AdminPageShell } from "@/app/admin/_components/admin-page-shell";
import { IngresoCompraForm } from "@/app/admin/importacion/ingreso-compra-form";
import { listSucursales } from "@/lib/data/sucursales";
import { getUltimoTipoCambio } from "@/lib/data/tipo-cambio";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ingreso de compra",
};

export default async function AdminImportacionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;

  const [sucursalesRaw, tc] = await Promise.all([listSucursales(), getUltimoTipoCambio()]);

  const sucursales = sucursalesRaw
    .filter((s) => s.estado === "activo")
    .map((s) => ({ id: s.id, nombre: s.nombre }));

  return (
    <AdminPageShell
      backHref="/admin"
      backLabel="Inicio admin"
      error={sp.error}
    >
      <IngresoCompraForm sucursales={sucursales} tipoCambio={tc} />
    </AdminPageShell>
  );
}

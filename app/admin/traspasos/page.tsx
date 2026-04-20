import { AdminPageShell } from "@/app/admin/_components/admin-page-shell";
import { TraspasoForm } from "@/app/admin/traspasos/traspaso-form";
import { listSucursales } from "@/lib/data/sucursales";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Traspasos entre sucursales",
};

export default async function AdminTraspasosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const sucursales = (await listSucursales())
    .filter((s) => s.estado === "activo")
    .map((s) => ({ id: s.id, nombre: s.nombre }));

  return (
    <AdminPageShell
      backHref="/admin"
      backLabel="Inicio admin"
      title="Traspasos"
      description="Mové stock de una sucursal origen a una sucursal destino eligiendo productos y cantidades."
      error={sp.error}
    >
      <TraspasoForm sucursales={sucursales} />
    </AdminPageShell>
  );
}

import { AdminPageShell } from "@/app/admin/_components/admin-page-shell";
import { CajaSolicitudesAdminPanel } from "@/app/admin/caja-solicitudes/_components/caja-solicitudes-admin-panel";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Solicitudes de caja",
};

export default async function AdminCajaSolicitudesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  return (
    <AdminPageShell
      title="Solicitudes de caja"
      description="Devoluciones y cambios solicitados por cajeros. Podés aprobar o rechazar; el cajero recién registra en caja cuando está aprobada."
      backHref="/admin"
      backLabel="Inicio admin"
      error={sp.error}
    >
      <CajaSolicitudesAdminPanel />
    </AdminPageShell>
  );
}


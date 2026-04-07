import { AdminSection } from "@/app/admin/_components/admin-section";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sucursales",
};

export default function AdminSucursalesPage() {
  return (
    <AdminSection
      title="Sucursales"
      description="Alta, baja lógica y datos de contacto por tienda."
    >
      <p>
        CRUD sobre la tabla{" "}
        <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-slate-200">
          sucursales
        </code>{" "}
        (estado activo/inactivo).
      </p>
    </AdminSection>
  );
}

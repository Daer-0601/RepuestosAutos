import { AdminSection } from "@/app/admin/_components/admin-section";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Usuarios",
};

export default function AdminUsuariosPage() {
  return (
    <AdminSection
      title="Usuarios"
      description="Gestión de cuentas: Admin, Cajero y Vendedor."
    >
      <p>
        Tabla desde{" "}
        <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-slate-200">
          usuarios
        </code>{" "}
        con enlace a{" "}
        <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-slate-200">
          roles
        </code>{" "}
        y{" "}
        <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-slate-200">
          sucursales
        </code>
        .
      </p>
    </AdminSection>
  );
}

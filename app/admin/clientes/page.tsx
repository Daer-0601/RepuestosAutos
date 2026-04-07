import { AdminSection } from "@/app/admin/_components/admin-section";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Clientes",
};

export default function AdminClientesPage() {
  return (
    <AdminSection
      title="Clientes"
      description="Directorio de clientes para ventas y créditos."
    >
      <p>
        Listado y edición desde{" "}
        <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-slate-200">
          clientes
        </code>
        .
      </p>
    </AdminSection>
  );
}

import { AdminSection } from "@/app/admin/_components/admin-section";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Importación",
};

export default function AdminImportacionPage() {
  return (
    <AdminSection
      title="Importación de productos"
      description="Subí archivos CSV o Excel y mapeá columnas al catálogo."
    >
      <p>
        Aquí irá el flujo de importación masiva validado contra{" "}
        <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-slate-200">
          productos
        </code>{" "}
        y reglas de códigos únicos / QR.
      </p>
    </AdminSection>
  );
}

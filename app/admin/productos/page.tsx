import { AdminSection } from "@/app/admin/_components/admin-section";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Productos",
};

export default function AdminProductosPage() {
  return (
    <AdminSection
      title="Productos"
      description="Alta, edición, imágenes, código y payload del QR."
    >
      <p>
        Formularios y listado sobre{" "}
        <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-slate-200">
          productos
        </code>{" "}
        y{" "}
        <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-slate-200">
          producto_imagenes
        </code>
        .
      </p>
    </AdminSection>
  );
}

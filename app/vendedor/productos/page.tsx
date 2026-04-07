import { PanelSection } from "@/app/_components/panel-section";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Consulta de producto",
};

export default function VendedorProductosConsultaPage() {
  return (
    <PanelSection
      variant="vendedor"
      title="Consulta de producto"
      description="Búsqueda por código legible o lectura de QR (payload)."
    >
      <p>
        Lectura de{" "}
        <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-slate-200">
          productos
        </code>{" "}
        con stock en tu sucursal desde{" "}
        <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-slate-200">
          inventario
        </code>
        .
      </p>
    </PanelSection>
  );
}

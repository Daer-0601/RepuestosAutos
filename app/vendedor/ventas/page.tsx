import { PanelSection } from "@/app/_components/panel-section";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Historial de ventas",
};

export default function VendedorVentasHistorialPage() {
  return (
    <PanelSection
      variant="vendedor"
      title="Historial de ventas"
      description="Listado de ventas confirmadas en tu sucursal."
    >
      <p>
        Tabla filtrada por{" "}
        <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-slate-200">
          sucursal_id
        </code>{" "}
        del vendedor, con enlaces al detalle de líneas.
      </p>
    </PanelSection>
  );
}

import { PanelSection } from "@/app/_components/panel-section";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reporte de compras",
};

export default function CajeroReporteComprasPage() {
  return (
    <PanelSection
      variant="cajero"
      title="Reporte de compras"
      description="Compras registradas en la sucursal."
    >
      <p>
        Consultas sobre{" "}
        <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-slate-200">
          compras
        </code>{" "}
        y detalle, filtradas por sucursal asignada.
      </p>
    </PanelSection>
  );
}

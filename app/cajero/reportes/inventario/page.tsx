import { PanelSection } from "@/app/_components/panel-section";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reporte de inventario",
};

export default function CajeroReporteInventarioPage() {
  return (
    <PanelSection
      variant="cajero"
      title="Reporte de inventario"
      description="Stock y movimientos por sucursal."
    >
      <p>
        Vistas sobre{" "}
        <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-slate-200">
          inventario
        </code>
        ,{" "}
        <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-slate-200">
          lotes
        </code>{" "}
        y{" "}
        <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-slate-200">
          movimientos_inventario
        </code>{" "}
        para tu tienda.
      </p>
    </PanelSection>
  );
}

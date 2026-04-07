import { PanelSection } from "@/app/_components/panel-section";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reporte de créditos",
};

export default function CajeroReporteCreditosPage() {
  return (
    <PanelSection
      variant="cajero"
      title="Reporte de créditos"
      description="Créditos y cobranzas vinculadas a ventas de la sucursal."
    >
      <p>
        Resúmenes desde{" "}
        <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-slate-200">
          creditos
        </code>{" "}
        y{" "}
        <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-slate-200">
          pagos_credito
        </code>
        , filtrados por ventas de tu sucursal.
      </p>
    </PanelSection>
  );
}

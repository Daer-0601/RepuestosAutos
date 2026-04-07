import { PanelSection } from "@/app/_components/panel-section";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reporte de ventas",
};

export default function CajeroReporteVentasPage() {
  return (
    <PanelSection
      variant="cajero"
      title="Reporte de ventas"
      description="Filtrado por tu sucursal (tabla ventas / venta_detalle)."
    >
      <p>
        Aquí listaremos documentos de venta, totales en Bs/USD y forma de pago,
        siempre acotados a{" "}
        <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-slate-200">
          sucursal_id
        </code>{" "}
        del cajero.
      </p>
    </PanelSection>
  );
}

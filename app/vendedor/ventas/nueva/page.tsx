import { PanelSection } from "@/app/_components/panel-section";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nueva venta",
};

export default function VendedorNuevaVentaPage() {
  return (
    <PanelSection
      variant="vendedor"
      title="Nueva venta"
      description="Carrito, tipo de pago, cliente opcional y descuento de stock por sucursal."
    >
      <p>
        Flujo sobre{" "}
        <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-slate-200">
          ventas
        </code>
        ,{" "}
        <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-slate-200">
          venta_detalle
        </code>{" "}
        y asignación FIFO de{" "}
        <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-slate-200">
          lotes
        </code>
        .
      </p>
    </PanelSection>
  );
}

import { PanelSection } from "@/app/_components/panel-section";
import { NuevaVentaForm } from "@/app/vendedor/ventas/nueva/_components/nueva-venta-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nueva venta",
};

export default function VendedorNuevaVentaPage() {
  return (
    <PanelSection
      variant="vendedor"
      title="Nueva venta"
      description="Buscá por código o QR, revisá precio y cantidad, confirmá con tipo de pago. El stock baja por lotes FIFO y queda registro en movimientos_inventario."
    >
      <NuevaVentaForm />
    </PanelSection>
  );
}

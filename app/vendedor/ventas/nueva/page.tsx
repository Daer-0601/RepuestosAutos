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
      wide
      title="Nueva venta"
      description="Flujo de venta: lector arriba, líneas editables al centro y cierre de cobro abajo. El buscador de catálogo queda aparte para cuando necesités explorar stock."
    >
      <NuevaVentaForm />
    </PanelSection>
  );
}

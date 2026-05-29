import { PanelSection } from "@/app/_components/panel-section";
import { CotizacionesPanel } from "@/app/vendedor/cotizaciones/cotizaciones-panel";
import { requireVendedorContext } from "@/lib/auth/staff-panel-context";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cotizaciones",
};

export default async function VendedorCotizacionesPage() {
  await requireVendedorContext();

  return (
    <PanelSection
      variant="vendedor"
      wide
      title="Cotizaciones"
      description="Armá presupuestos y envialos a caja; el cajero imprime el documento para el cliente."
    >
      <CotizacionesPanel />
    </PanelSection>
  );
}

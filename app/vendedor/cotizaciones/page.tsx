import { PanelSection } from "@/app/_components/panel-section";
import { CotizacionesPanel } from "@/app/vendedor/cotizaciones/cotizaciones-panel";
import { requireVendedorContext } from "@/lib/auth/staff-panel-context";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cotizaciones",
};

export default async function VendedorCotizacionesPage() {
  const ctx = await requireVendedorContext();

  return (
    <PanelSection
      variant="vendedor"
      title="Cotizaciones"
      description={`Presupuestos con productos activos del catálogo global. Los totales usan el tipo de cambio vigente. Historial: cotizaciones guardadas por vendedores de ${ctx.sucursalNombre}.`}
    >
      <CotizacionesPanel />
    </PanelSection>
  );
}

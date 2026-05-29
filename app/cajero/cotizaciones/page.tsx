import { CotizacionesCajeroPanel } from "@/app/cajero/cotizaciones/_components/cotizaciones-cajero-panel";
import { PanelSection } from "@/app/_components/panel-section";
import { requireCajeroContext } from "@/lib/auth/staff-panel-context";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cotizaciones",
};

export default async function CajeroCotizacionesPage() {
  const ctx = await requireCajeroContext();

  return (
    <PanelSection
      variant="cajero"
      wide
      title="Cotizaciones de vendedores"
      description="Cotizaciones enviadas por vendedores de tu sucursal. Imprimí el documento para el cliente."
    >
      <CotizacionesCajeroPanel sucursalNombre={ctx.sucursalNombre} cajeroUsername={ctx.username} />
    </PanelSection>
  );
}

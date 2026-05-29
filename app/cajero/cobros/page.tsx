import { CobrosVendedorPanel } from "@/app/cajero/cobros/_components/cobros-vendedor-panel";
import { PanelSection } from "@/app/_components/panel-section";
import { requireCajeroContext } from "@/lib/auth/staff-panel-context";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cobros de vendedores",
};

export default async function CajeroCobrosPage() {
  const ctx = await requireCajeroContext();

  return (
    <PanelSection
      variant="cajero"
      wide
      title="Cobros de vendedores"
      description="Ventas enviadas por vendedores de tu sucursal. Por defecto se listan todas las pendientes de cobro."
    >
      <CobrosVendedorPanel sucursalNombre={ctx.sucursalNombre} cajeroUsername={ctx.username} />
    </PanelSection>
  );
}

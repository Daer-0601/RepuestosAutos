import { CobrosVendedorPanel } from "@/app/cajero/cobros/_components/cobros-vendedor-panel";
import { PanelSection } from "@/app/_components/panel-section";
import { requireCajeroContext } from "@/lib/auth/staff-panel-context";
import { formatDateTimeMysqlBolivia, parseIsoDateOnly } from "@/lib/fecha-bolivia";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Cobros de vendedores",
};

export default async function CajeroCobrosPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const ctx = await requireCajeroContext();
  const sp = await searchParams;
  const hoy = formatDateTimeMysqlBolivia(new Date()).slice(0, 10);
  const desdeParam = sp.desde?.trim() ?? "";
  const hastaParam = sp.hasta?.trim() ?? "";

  if (desdeParam === "" && hastaParam === "") {
    redirect(`/cajero/cobros?desde=${hoy}&hasta=${hoy}`);
  }

  const desdeParsed = desdeParam ? parseIsoDateOnly(desdeParam) : null;
  const hastaParsed = hastaParam ? parseIsoDateOnly(hastaParam) : null;

  let fDesde = desdeParsed;
  let fHasta = hastaParsed;
  if (fDesde && !fHasta) fHasta = fDesde;
  if (!fDesde && fHasta) fDesde = fHasta;
  if (fDesde && fHasta && fDesde > fHasta) {
    const t = fDesde;
    fDesde = fHasta;
    fHasta = t;
  }

  const fecha = fDesde ?? hoy;

  return (
    <PanelSection
      variant="cajero"
      wide
      title="Cobros de vendedores"
      description="Ventas enviadas por vendedores de tu sucursal. Revisá la lista, el detalle y registrá la forma de pago."
    >
      <CobrosVendedorPanel
        fechaDesde={fecha}
        fechaHasta={fHasta ?? fecha}
        sucursalNombre={ctx.sucursalNombre}
        cajeroUsername={ctx.username}
      />
    </PanelSection>
  );
}

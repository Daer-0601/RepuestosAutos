import { ArqueoVendedoresPanel } from "@/app/cajero/reportes/arqueo-vendedores/_components/arqueo-vendedores-panel";
import { PanelSection } from "@/app/_components/panel-section";
import { VentasHistorialFiltroFechas } from "@/app/vendedor/ventas/_components/ventas-historial-filtro-fechas";
import { formatDateTimeMysqlBolivia, parseIsoDateOnly } from "@/lib/fecha-bolivia";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Arqueo por vendedor",
};

export default async function CajeroArqueoVendedoresPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const sp = await searchParams;
  const hoy = formatDateTimeMysqlBolivia(new Date()).slice(0, 10);
  const desdeParam = sp.desde?.trim() ?? "";
  const hastaParam = sp.hasta?.trim() ?? "";

  if (desdeParam === "" && hastaParam === "") {
    redirect(`/cajero/reportes/arqueo-vendedores?desde=${hoy}&hasta=${hoy}`);
  }

  const desdeParsed = desdeParam ? parseIsoDateOnly(desdeParam) : null;
  const hastaParsed = hastaParam ? parseIsoDateOnly(hastaParam) : null;

  let filtroError: string | null = null;
  if (desdeParam && !desdeParsed) {
    filtroError = "La fecha «Desde» no es válida.";
  } else if (hastaParam && !hastaParsed) {
    filtroError = "La fecha «Hasta» no es válida.";
  }

  let fDesde = desdeParsed;
  let fHasta = hastaParsed;
  if (fDesde && !fHasta) fHasta = fDesde;
  if (!fDesde && fHasta) fDesde = fHasta;
  if (fDesde && fHasta && fDesde > fHasta) {
    const t = fDesde;
    fDesde = fHasta;
    fHasta = t;
  }

  const hayParamsFiltro = desdeParam !== "" || hastaParam !== "";
  const useFiltro = Boolean(fDesde && fHasta && !filtroError);
  const apiDesde = useFiltro ? fDesde! : hoy;
  const apiHasta = useFiltro ? fHasta! : hoy;

  const clearHref = `/cajero/reportes/arqueo-vendedores?desde=${hoy}&hasta=${hoy}`;

  return (
    <PanelSection
      variant="cajero"
      wide
      title="Arqueo por vendedor"
      description="Resumen de ventas confirmadas por vendedor. Elegí el rango con el mismo calendario que en historial de ventas; podés imprimir el detalle de salidas por persona para el cierre del día."
    >
      {filtroError ? (
        <p className="mb-4 rounded-xl border border-rose-500/35 bg-rose-950/30 px-4 py-3 text-sm text-rose-100" role="alert">
          {filtroError}
        </p>
      ) : null}

      <div className="mb-6">
        <VentasHistorialFiltroFechas
          defaultDesde={desdeParsed}
          defaultHasta={hastaParsed}
          hayParamsFiltro={hayParamsFiltro}
          formAction="/cajero/reportes/arqueo-vendedores"
          clearHref={clearHref}
          accent="cajero"
          fieldIdPrefix="arqueo"
        />
      </div>

      <ArqueoVendedoresPanel fechaDesde={apiDesde} fechaHasta={apiHasta} />
    </PanelSection>
  );
}

import { IngresosEgresosPanel } from "@/app/cajero/reportes/ingresos-egresos/_components/ingresos-egresos-panel";
import { PanelSection } from "@/app/_components/panel-section";
import { VentasHistorialFiltroFechas } from "@/app/vendedor/ventas/_components/ventas-historial-filtro-fechas";
import { requireCajeroContext } from "@/lib/auth/staff-panel-context";
import { formatDateTimeMysqlBolivia, parseIsoDateOnly } from "@/lib/fecha-bolivia";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Ingresos y egresos",
};

export default async function CajeroIngresosEgresosPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  await requireCajeroContext();
  const sp = await searchParams;
  const hoy = formatDateTimeMysqlBolivia(new Date()).slice(0, 10);
  const desdeParam = sp.desde?.trim() ?? "";
  const hastaParam = sp.hasta?.trim() ?? "";

  if (desdeParam === "" && hastaParam === "") {
    redirect(`/cajero/reportes/ingresos-egresos?desde=${hoy}&hasta=${hoy}`);
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
  const apiFecha = useFiltro ? fDesde! : hoy;

  if (useFiltro && fDesde !== fHasta) {
    filtroError =
      filtroError ??
      "Para ingresos y egresos elegí el mismo día en «Desde» y «Hasta» (reporte diario).";
  }

  const clearHref = `/cajero/reportes/ingresos-egresos?desde=${hoy}&hasta=${hoy}`;

  return (
    <PanelSection
      variant="cajero"
      wide
      title="Ingresos y egresos del día"
      description="Registrá gastos, devoluciones, cambios de producto, compra de dólares e imprimí el reporte del día con ventas confirmadas."
    >
      {filtroError ? (
        <p
          className="mb-4 rounded-xl border border-rose-500/35 bg-rose-950/30 px-4 py-3 text-sm text-rose-100"
          role="alert"
        >
          {filtroError}
        </p>
      ) : null}

      <div className="mb-6">
        <VentasHistorialFiltroFechas
          defaultDesde={desdeParsed}
          defaultHasta={hastaParsed}
          hayParamsFiltro={hayParamsFiltro}
          formAction="/cajero/reportes/ingresos-egresos"
          clearHref={clearHref}
          accent="cajero"
          fieldIdPrefix="ie"
        />
      </div>

      {!filtroError ? (
        <IngresosEgresosPanel fecha={apiFecha} />
      ) : null}
    </PanelSection>
  );
}

import { PanelSection } from "@/app/_components/panel-section";
import { VentasHistorialActualizarButton } from "@/app/vendedor/ventas/_components/ventas-historial-actualizar-button";
import { VentasHistorialFiltroFechas } from "@/app/vendedor/ventas/_components/ventas-historial-filtro-fechas";
import { requireVendedorContext } from "@/lib/auth/staff-panel-context";
import {
  listTotalesVentasPorDiaPorSucursal,
  sumTotalesVentasPorSucursalEnRango,
} from "@/lib/data/ventas-vendedor";
import { formatDateTimeMysqlBolivia, formatIsoDateOnlyBo, parseIsoDateOnly } from "@/lib/fecha-bolivia";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Historial de ventas",
};

function restarDiasIso(iso: string, dias: number): string {
  const p = parseIsoDateOnly(iso);
  if (!p) return iso;
  const [y, m, d] = p.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - dias);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export default async function VendedorVentasHistorialPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const ctx = await requireVendedorContext();
  const sp = await searchParams;

  const hoy = formatDateTimeMysqlBolivia(new Date()).slice(0, 10);
  const desdeParam = sp.desde?.trim() || "";
  const hastaParam = sp.hasta?.trim() || "";
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

  const useFiltroExplicito = Boolean(desdeParam || hastaParam);
  const useFiltro = Boolean(fDesde && fHasta && !filtroError);
  const apiDesde = useFiltro ? fDesde! : restarDiasIso(hoy, 29);
  const apiHasta = useFiltro ? fHasta! : hoy;

  const [dias, totalesRango] = await Promise.all([
    listTotalesVentasPorDiaPorSucursal(ctx.sucursalId, apiDesde, apiHasta),
    sumTotalesVentasPorSucursalEnRango(ctx.sucursalId, apiDesde, apiHasta),
  ]);

  const hayParamsFiltro = desdeParam !== "" || hastaParam !== "";
  const queryFiltro =
    useFiltroExplicito && fDesde && fHasta
      ? `?desde=${encodeURIComponent(fDesde)}&hasta=${encodeURIComponent(fHasta)}`
      : "";

  return (
    <PanelSection
      variant="vendedor"
      title="Historial de ventas"
      description={`Ventas al contado en ${ctx.sucursalNombre}. No incluye créditos; esas ventas están en Historial créditos.`}
    >
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/vendedor/ventas/nueva"
            className="inline-flex w-fit rounded-xl bg-amber-500/20 px-4 py-2 text-sm font-medium text-amber-100 ring-1 ring-amber-500/35 hover:bg-amber-500/30"
          >
            + Nueva venta
          </Link>
          <VentasHistorialActualizarButton />
        </div>

        <VentasHistorialFiltroFechas
          defaultDesde={desdeParsed}
          defaultHasta={hastaParsed}
          hayParamsFiltro={hayParamsFiltro}
        />
      </div>

      {filtroError ? (
        <p className="mb-4 rounded-xl border border-rose-500/35 bg-rose-950/30 px-4 py-3 text-sm text-rose-100" role="alert">
          {filtroError}
        </p>
      ) : null}

      {dias.length === 0 ? (
        <p className="text-sm text-slate-500">
          {useFiltroExplicito
            ? "No hay ventas en el período elegido."
            : "No hay ventas registradas en los últimos 30 días."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <p className="border-b border-white/10 bg-black/20 px-4 py-2 text-xs text-slate-500">
            {useFiltroExplicito ? (
              <>
                Resumen del <span className="font-mono text-slate-300">{apiDesde}</span> al{" "}
                <span className="font-mono text-slate-300">{apiHasta}</span>: {dias.length} día
                {dias.length === 1 ? "" : "s"} con ventas
              </>
            ) : (
              <>
                Últimos 30 días ({apiDesde} al {apiHasta}): {dias.length} día
                {dias.length === 1 ? "" : "s"} con ventas. Usá el filtro arriba para otro rango.
              </>
            )}
          </p>
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-white/10 bg-black/25 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Día</th>
                <th className="px-4 py-3 font-medium text-right">Ventas</th>
                <th className="px-4 py-3 font-medium text-right">Total Bs</th>
                <th className="px-4 py-3 font-medium text-right">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {dias.map((d) => (
                <tr key={d.fecha} className="text-slate-300">
                  <td className="px-4 py-3 font-mono text-xs text-slate-200">
                    {formatIsoDateOnlyBo(d.fecha)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-400">{d.cantidad}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-200">
                    {d.totalBs.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/vendedor/ventas/dia/${d.fecha}${queryFiltro}`}
                      className="inline-flex rounded-lg bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-100 ring-1 ring-amber-500/30 hover:bg-amber-500/25"
                    >
                      Ver detalle
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtroError && totalesRango.cantidad > 0 ? (
            <div className="border-t border-amber-500/30 bg-gradient-to-r from-amber-950/40 to-slate-950/40 px-4 py-4 sm:px-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Total vendido en el período
              </p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-amber-50">
                {totalesRango.totalBs.toFixed(2)}{" "}
                <span className="text-base font-normal text-slate-400">Bs</span>
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Suma de {totalesRango.cantidad} venta{totalesRango.cantidad === 1 ? "" : "s"} en{" "}
                {dias.length} día{dias.length === 1 ? "" : "s"}.
              </p>
            </div>
          ) : null}
        </div>
      )}

      {!filtroError && totalesRango.cantidad > 0 && dias.length === 0 ? (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-950/40 to-slate-950/40 px-4 py-4 sm:px-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Total vendido en el período
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-amber-50">
            {totalesRango.totalBs.toFixed(2)}{" "}
            <span className="text-base font-normal text-slate-400">Bs</span>
          </p>
        </div>
      ) : null}
    </PanelSection>
  );
}

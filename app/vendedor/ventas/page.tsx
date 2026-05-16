import { PanelSection } from "@/app/_components/panel-section";
import { VentasHistorialFiltroFechas } from "@/app/vendedor/ventas/_components/ventas-historial-filtro-fechas";
import { requireVendedorContext } from "@/lib/auth/staff-panel-context";
import { listVentasPorSucursal, sumTotalesVentasPorSucursalEnRango } from "@/lib/data/ventas-vendedor";
import { formatoMostrarFechaHoraBo, parseIsoDateOnly } from "@/lib/fecha-bolivia";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Historial de ventas",
};

export default async function VendedorVentasHistorialPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const ctx = await requireVendedorContext();
  const sp = await searchParams;

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

  const useFiltro = Boolean(fDesde && fHasta && !filtroError);
  const [rows, totalesRango] = await Promise.all([
    listVentasPorSucursal(
      ctx.sucursalId,
      useFiltro ? 3000 : 100,
      useFiltro && fDesde && fHasta ? { fechaDesde: fDesde, fechaHasta: fHasta } : null
    ),
    useFiltro && fDesde && fHasta
      ? sumTotalesVentasPorSucursalEnRango(ctx.sucursalId, fDesde, fHasta)
      : Promise.resolve(null),
  ]);

  const hayParamsFiltro = desdeParam !== "" || hastaParam !== "";

  return (
    <PanelSection
      variant="vendedor"
      title="Historial de ventas"
      description={`Ventas confirmadas en ${ctx.sucursalNombre}. Podés acotar por día (misma fecha en ambos campos) o por rango.`}
    >
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <Link
          href="/vendedor/ventas/nueva"
          className="inline-flex w-fit rounded-xl bg-amber-500/20 px-4 py-2 text-sm font-medium text-amber-100 ring-1 ring-amber-500/35 hover:bg-amber-500/30"
        >
          + Nueva venta
        </Link>

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

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">
          {useFiltro
            ? "No hay ventas en el período elegido."
            : "Todavía no hay ventas registradas en esta sucursal."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <p className="border-b border-white/10 bg-black/20 px-4 py-2 text-xs text-slate-500">
            {useFiltro ? (
              <>
                Ventas del <span className="font-mono text-slate-300">{fDesde}</span> al{" "}
                <span className="font-mono text-slate-300">{fHasta}</span>: hasta {rows.length} registro
                {rows.length === 1 ? "" : "s"} en pantalla
                {useFiltro &&
                totalesRango != null &&
                totalesRango.cantidad > rows.length ? (
                  <span className="block mt-1 text-amber-200/80">
                    (hay {totalesRango.cantidad} en total en el período; el total abajo suma todas)
                  </span>
                ) : null}
              </>
            ) : (
              <>Últimas {rows.length} ventas (sin filtro de fechas). Usá el formulario arriba para acotar por día o rango.</>
            )}
          </p>
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-white/10 bg-black/25 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Pago</th>
                <th className="px-4 py-3 font-medium">Cobro</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium text-right">Total Bs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((r) => (
                <tr key={r.id} className="text-slate-300">
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {new Date(r.fecha).toLocaleString("es-BO", formatoMostrarFechaHoraBo)}
                  </td>
                  <td className="px-4 py-3 capitalize">{r.tipo_pago}</td>
                  <td className="px-4 py-3">{r.estado_cobro}</td>
                  <td className="px-4 py-3 text-slate-400">{r.cliente_nombre ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-200">{Number(r.total_bs).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {useFiltro && !filtroError && totalesRango != null ? (
            <div className="border-t border-amber-500/30 bg-gradient-to-r from-amber-950/40 to-slate-950/40 px-4 py-4 sm:px-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Total vendido en el período
              </p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-amber-50">
                {totalesRango.totalBs.toFixed(2)}{" "}
                <span className="text-base font-normal text-slate-400">Bs</span>
              </p>
              {totalesRango.totalUsd > 0 ? (
                <p className="mt-1 font-mono text-sm text-slate-400">
                  ≈ {totalesRango.totalUsd.toFixed(4)} USD
                </p>
              ) : null}
              <p className="mt-2 text-xs text-slate-500">
                Suma del total de {totalesRango.cantidad} venta{totalesRango.cantidad === 1 ? "" : "s"} en el rango
                elegido.
              </p>
            </div>
          ) : null}
        </div>
      )}

      {useFiltro && !filtroError && totalesRango != null && rows.length === 0 ? (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-950/40 to-slate-950/40 px-4 py-4 sm:px-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Total vendido en el período
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-amber-50">
            {totalesRango.totalBs.toFixed(2)}{" "}
            <span className="text-base font-normal text-slate-400">Bs</span>
          </p>
          {totalesRango.totalUsd > 0 ? (
            <p className="mt-1 font-mono text-sm text-slate-400">≈ {totalesRango.totalUsd.toFixed(4)} USD</p>
          ) : null}
        </div>
      ) : null}
    </PanelSection>
  );
}

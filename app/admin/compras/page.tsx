import { AdminPageShell } from "@/app/admin/_components/admin-page-shell";
import { ComprasNavTabs } from "@/app/admin/importacion/_components/compras-nav-tabs";
import { listComprasAdmin, sumTotalesComprasAdminEnRango } from "@/lib/data/compras-listado";
import { listSucursales } from "@/lib/data/sucursales";
import {
  formatDateTimeMysqlBolivia,
  formatoMostrarFechaHoraBo,
  parseIsoDateOnly,
} from "@/lib/fecha-bolivia";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Listado de compras",
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

function labelEstado(estado: string): string {
  if (estado === "confirmada") return "Confirmada";
  return estado || "—";
}

function badgeEstado(estado: string): string {
  if (estado === "confirmada") return "bg-emerald-500/20 text-emerald-200";
  return "bg-slate-500/20 text-slate-300";
}

function parseSucursalFiltro(raw: string | undefined): number | null {
  if (!raw?.trim()) return null;
  const n = Number(raw.trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default async function AdminComprasListadoPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; sucursal?: string }>;
}) {
  const sp = await searchParams;
  const sucursalesRaw = await listSucursales();
  const sucursales = sucursalesRaw.filter((s) => s.estado === "activo").sort((a, b) => a.id - b.id);

  const hoy = formatDateTimeMysqlBolivia(new Date()).slice(0, 10);
  const desdeParam = sp.desde?.trim() || "";
  const hastaParam = sp.hasta?.trim() || "";
  const sucursalParam = sp.sucursal?.trim() || "";
  const desdeParsed = desdeParam ? parseIsoDateOnly(desdeParam) : null;
  const hastaParsed = hastaParam ? parseIsoDateOnly(hastaParam) : null;
  const sucursalParsed = parseSucursalFiltro(sucursalParam);

  let filtroError: string | null = null;
  if (desdeParam && !desdeParsed) filtroError = "La fecha «Desde» no es válida.";
  else if (hastaParam && !hastaParsed) filtroError = "La fecha «Hasta» no es válida.";
  else if (sucursalParam && !sucursalParsed) filtroError = "La sucursal elegida no es válida.";

  let fDesde = desdeParsed;
  let fHasta = hastaParsed;
  if (fDesde && !fHasta) fHasta = fDesde;
  if (!fDesde && fHasta) fDesde = fHasta;
  if (fDesde && fHasta && fDesde > fHasta) {
    const t = fDesde;
    fDesde = fHasta;
    fHasta = t;
  }

  const useFiltroExplicito = Boolean(desdeParam || hastaParam || sucursalParam);
  const useFiltro = Boolean(fDesde && fHasta && !filtroError);
  const apiDesde = useFiltro ? fDesde! : restarDiasIso(hoy, 29);
  const apiHasta = useFiltro ? fHasta! : hoy;
  const apiSucursal = filtroError ? null : sucursalParsed;

  const [rows, totales] = await Promise.all([
    listComprasAdmin({
      fechaDesde: apiDesde,
      fechaHasta: apiHasta,
      sucursalId: apiSucursal,
      limit: 500,
    }),
    sumTotalesComprasAdminEnRango(apiDesde, apiHasta, apiSucursal),
  ]);

  const hayParamsFiltro = desdeParam !== "" || hastaParam !== "" || sucursalParam !== "";
  const queryExtra = new URLSearchParams();
  if (useFiltroExplicito && fDesde && fHasta) {
    queryExtra.set("desde", fDesde);
    queryExtra.set("hasta", fHasta);
  }
  if (apiSucursal != null) queryExtra.set("sucursal", String(apiSucursal));
  const queryFiltro = queryExtra.toString() ? `?${queryExtra.toString()}` : "";

  const nombreSucursalActiva =
    apiSucursal == null ? null : sucursales.find((s) => s.id === apiSucursal)?.nombre ?? null;

  return (
    <AdminPageShell
      backHref="/admin"
      backLabel="Inicio admin"
      title="Listado de compras"
      description="Todas las importaciones registradas desde Ingreso / compra. Filtrá por sucursal y fechas."
    >
      <ComprasNavTabs />

      <form
        method="get"
        className="mb-6 flex flex-col gap-4 rounded-xl border border-white/10 bg-slate-950/40 p-4 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <div>
          <label htmlFor="filtro-sucursal" className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Sucursal
          </label>
          <select
            id="filtro-sucursal"
            name="sucursal"
            defaultValue={sucursalParsed ?? ""}
            className="mt-1 min-w-[12rem] rounded-lg border border-white/15 bg-slate-950/80 px-3 py-2 text-sm text-white outline-none focus:border-rose-500/40"
          >
            <option value="">Todas</option>
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filtro-desde" className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Desde
          </label>
          <input
            id="filtro-desde"
            type="date"
            name="desde"
            defaultValue={desdeParsed ?? ""}
            className="mt-1 rounded-lg border border-white/15 bg-slate-950/80 px-3 py-2 text-sm font-mono text-white outline-none focus:border-rose-500/40"
          />
        </div>
        <div>
          <label htmlFor="filtro-hasta" className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Hasta
          </label>
          <input
            id="filtro-hasta"
            type="date"
            name="hasta"
            defaultValue={hastaParsed ?? ""}
            className="mt-1 rounded-lg border border-white/15 bg-slate-950/80 px-3 py-2 text-sm font-mono text-white outline-none focus:border-rose-500/40"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500"
          >
            Filtrar
          </button>
          {hayParamsFiltro ? (
            <Link
              href="/admin/compras"
              className="inline-flex items-center rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
            >
              Limpiar
            </Link>
          ) : null}
        </div>
      </form>

      {filtroError ? (
        <p className="mb-4 rounded-xl border border-rose-500/35 bg-rose-950/30 px-4 py-3 text-sm text-rose-100" role="alert">
          {filtroError}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">
          {useFiltroExplicito
            ? "No hay compras en el período elegido."
            : "No hay compras registradas en los últimos 30 días."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <p className="border-b border-white/10 bg-black/20 px-4 py-2 text-xs text-slate-500">
            {useFiltroExplicito ? (
              <>
                Del <span className="font-mono text-slate-300">{apiDesde}</span> al{" "}
                <span className="font-mono text-slate-300">{apiHasta}</span>
                {nombreSucursalActiva ? (
                  <>
                    {" "}
                    · sucursal <span className="text-slate-300">{nombreSucursalActiva}</span>
                  </>
                ) : null}
                : {rows.length} compra{rows.length === 1 ? "" : "s"}
              </>
            ) : (
              <>
                Últimos 30 días ({apiDesde} al {apiHasta}): {rows.length} compra
                {rows.length === 1 ? "" : "s"}. Usá el filtro arriba para otro rango.
              </>
            )}
          </p>
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-white/10 bg-black/25 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Proveedor</th>
                <th className="px-4 py-3 font-medium">Sucursal</th>
                <th className="px-4 py-3 font-medium text-right">Productos</th>
                <th className="px-4 py-3 font-medium text-right">Costo total Bs</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium text-right">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((r) => (
                <tr key={r.id} className="text-slate-300 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-mono text-slate-200">{r.id}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-400">
                    {r.fecha.toLocaleString("es-BO", formatoMostrarFechaHoraBo)}
                  </td>
                  <td className="max-w-[200px] px-4 py-3 truncate text-slate-200">{r.proveedorNombre}</td>
                  <td className="px-4 py-3 text-slate-400">{r.sucursalNombre}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-400">
                    {r.cantidadLineas} línea{r.cantidadLineas === 1 ? "" : "s"}
                    <span className="mt-0.5 block text-[11px] text-slate-500">{r.cantidadUnidades} u.</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-100">
                    {r.totalBs.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badgeEstado(r.estado)}`}>
                      {labelEstado(r.estado)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/compras/${r.id}${queryFiltro}`}
                      className="inline-flex rounded-lg bg-rose-500/15 px-3 py-1.5 text-xs font-medium text-rose-100 ring-1 ring-rose-500/30 hover:bg-rose-500/25"
                    >
                      Ver detalle
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!filtroError && totales.cantidad > 0 ? (
            <div className="border-t border-rose-500/30 bg-gradient-to-r from-rose-950/40 to-slate-950/40 px-4 py-4 sm:px-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Total comprado en el período
              </p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-rose-50">
                {totales.totalBs.toFixed(2)}{" "}
                <span className="text-base font-normal text-slate-400">Bs</span>
              </p>
              {totales.totalUsd > 0 ? (
                <p className="mt-1 font-mono text-sm text-slate-400">≈ {totales.totalUsd.toFixed(4)} USD</p>
              ) : null}
              <p className="mt-2 text-xs text-slate-500">
                {totales.cantidad} compra{totales.cantidad === 1 ? "" : "s"} · {totales.cantidadUnidades} unidades
                importadas
                {nombreSucursalActiva ? ` en ${nombreSucursalActiva}` : ""}.
              </p>
            </div>
          ) : null}
        </div>
      )}
    </AdminPageShell>
  );
}

import { AdminPageShell } from "@/app/admin/_components/admin-page-shell";
import {
  cardexVentasProductoPorSucursalYPeriodo,
  comprasPorSucursalPorPeriodo,
  etiquetaPeriodo,
  listStockBajo,
  parsePeriodoReporte,
  resumenComprasPorPeriodo,
  resumenVentasPorPeriodo,
  topProductosPorPeriodo,
  topVendedoresPorPeriodo,
  ventasPorSucursalPorPeriodo,
  type PeriodoReporte,
} from "@/lib/data/reportes-admin";
import { listSucursales } from "@/lib/data/sucursales";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Reportes",
};

function parseSucursalFiltro(raw: string | string[] | undefined): number | null {
  if (raw == null || Array.isArray(raw)) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseCodigoCardex(raw: string | string[] | undefined): string | null {
  if (raw == null) return null;
  const s = Array.isArray(raw) ? raw[0] : raw;
  const t = String(s ?? "").trim();
  return t.length > 0 ? t : null;
}

function formatFechaHoraVenta(value: string | Date | null | undefined): string {
  if (value == null) return "—";
  if (value instanceof Date) {
    const hasTime = value.getHours() !== 0 || value.getMinutes() !== 0 || value.getSeconds() !== 0;
    return hasTime
      ? value.toLocaleString("es-BO", { dateStyle: "short", timeStyle: "short" })
      : value.toLocaleDateString("es-BO", { dateStyle: "short" });
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("es-BO", { dateStyle: "short" });
  }
  const normalized = s.includes("T") ? s : s.replace(" ", "T");
  const dt = new Date(normalized);
  if (!Number.isNaN(dt.getTime())) {
    const hasTime = / \d{1,2}:\d{2}/.test(s) || /T\d{2}:\d{2}/.test(normalized);
    return hasTime
      ? dt.toLocaleString("es-BO", { dateStyle: "short", timeStyle: "short" })
      : dt.toLocaleDateString("es-BO", { dateStyle: "short" });
  }
  return s;
}

function queryPreservandoSucursal(
  periodo: PeriodoReporte,
  sucursalId: number | null,
  codigoCardex: string | null
): string {
  const p = new URLSearchParams();
  p.set("periodo", periodo);
  if (sucursalId != null) p.set("sucursal", String(sucursalId));
  if (codigoCardex) p.set("codigo", codigoCardex);
  const qs = p.toString();
  return qs ? `?${qs}` : "";
}

export default async function AdminReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; sucursal?: string; codigo?: string }>;
}) {
  const sp = await searchParams;
  const periodo = parsePeriodoReporte(sp.periodo);
  const sucursalFiltro = parseSucursalFiltro(sp.sucursal);
  const codigoCardex = parseCodigoCardex(sp.codigo);
  const sucursales = await listSucursales();

  const cardexPromise =
    codigoCardex != null && sucursalFiltro != null
      ? cardexVentasProductoPorSucursalYPeriodo(codigoCardex, sucursalFiltro, periodo, 300)
      : Promise.resolve(null);

  const [
    ventas,
    compras,
    porSucursalVentas,
    porSucursalCompras,
    topVendedores,
    topProductos,
    stockBajo,
    cardexVentas,
  ] = await Promise.all([
    resumenVentasPorPeriodo(periodo, sucursalFiltro),
    resumenComprasPorPeriodo(periodo, sucursalFiltro),
    ventasPorSucursalPorPeriodo(periodo, sucursalFiltro),
    comprasPorSucursalPorPeriodo(periodo, sucursalFiltro),
    topVendedoresPorPeriodo(periodo, sucursalFiltro, 15),
    topProductosPorPeriodo(periodo, sucursalFiltro, 15),
    listStockBajo(5, 40),
    cardexPromise,
  ]);

  const periodoLinks: { id: PeriodoReporte; label: string }[] = [
    { id: "semana", label: "Semana" },
    { id: "mes", label: "Mes" },
    { id: "anio", label: "Año" },
  ];

  const nombreSucursalActiva =
    sucursalFiltro == null ? null : sucursales.find((s) => s.id === sucursalFiltro)?.nombre ?? null;

  return (
    <AdminPageShell
      backHref="/admin"
      backLabel="Inicio admin"
      title="Reportes"
      description={`${etiquetaPeriodo(periodo)} · ventas y compras confirmadas${
        nombreSucursalActiva ? ` · sucursal: ${nombreSucursalActiva}` : " · todas las sucursales"
      }. Cardex: código + sucursal. Stock bajo: unidades ≤ 5 (global).`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <span className="w-full text-xs font-medium uppercase tracking-wider text-slate-500 sm:w-auto sm:self-center">
            Período
          </span>
          {periodoLinks.map(({ id, label }) => (
            <Link
              key={id}
              href={`/admin/reportes${queryPreservandoSucursal(id, sucursalFiltro, codigoCardex)}`}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                periodo === id
                  ? "bg-sky-600 text-white ring-2 ring-sky-400/40"
                  : "border border-white/10 bg-slate-900/60 text-slate-300 hover:border-sky-500/30 hover:text-white"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        <form method="get" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="periodo" value={periodo} />
          <div>
            <label htmlFor="sucursal" className="block text-xs font-medium uppercase tracking-wider text-slate-500">
              Sucursal
            </label>
            <select
              id="sucursal"
              name="sucursal"
              defaultValue={sucursalFiltro ?? ""}
              className="mt-1 min-w-[12rem] rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50"
            >
              <option value="">Todas</option>
              {sucursales
                .filter((s) => s.estado === "activo")
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label htmlFor="codigo-cardex" className="block text-xs font-medium uppercase tracking-wider text-slate-500">
              Código (cardex)
            </label>
            <input
              id="codigo-cardex"
              name="codigo"
              type="text"
              defaultValue={codigoCardex ?? ""}
              placeholder="Código de barra / interno"
              autoComplete="off"
              className="mt-1 min-w-[11rem] rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 font-mono text-sm text-white outline-none placeholder:text-slate-600 focus:border-sky-500/50"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg border border-white/15 bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Filtrar
          </button>
        </form>
      </div>

      <section className="mt-8 rounded-2xl border border-sky-500/25 bg-sky-950/20 p-5">
        <h2 className="text-sm font-semibold text-sky-100">Cardex de ventas por sucursal</h2>
        <p className="mt-1 text-xs text-slate-400">
          Elegí una <strong className="font-medium text-slate-300">sucursal</strong>, ingresá el{" "}
          <strong className="font-medium text-slate-300">código</strong> del producto y pulsá Filtrar. Se listan las
          ventas del <strong className="font-medium text-slate-300">{etiquetaPeriodo(periodo).toLowerCase()}</strong>{" "}
          con vendedor, fecha y hora (si el registro incluye hora).
        </p>
        {codigoCardex != null && sucursalFiltro == null ? (
          <p className="mt-3 text-sm text-amber-200/90">
            Para ver el cardex tenés que elegir una sucursal (no &quot;Todas&quot;).
          </p>
        ) : null}
        {codigoCardex == null && sucursalFiltro != null ? (
          <p className="mt-3 text-sm text-slate-500">Ingresá un código de producto y volvé a filtrar.</p>
        ) : null}
        {cardexVentas != null ? (
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-slate-900/50">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-white/10 bg-black/25 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Venta</th>
                  <th className="px-4 py-3">Fecha / hora</th>
                  <th className="px-4 py-3">Vendedor</th>
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Cant.</th>
                  <th className="px-4 py-3">P. unitario Bs</th>
                  <th className="px-4 py-3">Total línea Bs</th>
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3">Sucursal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {cardexVentas.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-slate-500" colSpan={9}>
                      No hay líneas de venta para ese código en esta sucursal y período.
                    </td>
                  </tr>
                ) : (
                  cardexVentas.map((r) => (
                    <tr key={r.detalle_id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-mono text-slate-300">#{r.venta_id}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-200">
                        {formatFechaHoraVenta(r.fecha_venta)}
                      </td>
                      <td className="max-w-[160px] truncate px-4 py-3 text-white">
                        {r.vendedor_nombre?.trim() || "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-400">{r.vendedor_username?.trim() || "—"}</td>
                      <td className="px-4 py-3 text-amber-200">{r.cantidad}</td>
                      <td className="px-4 py-3 font-mono text-slate-200">{r.precio_unitario_bs ?? "0.00"}</td>
                      <td className="px-4 py-3 font-mono text-emerald-200">{r.total_linea_bs ?? "0.00"}</td>
                      <td className="max-w-[220px] px-4 py-3">
                        <span className="font-mono text-xs text-slate-500">{r.producto_codigo}</span>
                        <span className="mt-0.5 block truncate text-slate-200">{r.producto_nombre}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{r.sucursal_nombre}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Ventas</p>
          <p className="mt-2 text-2xl font-semibold text-white">{ventas.cantidad}</p>
          <p className="mt-1 text-sm text-slate-400">
            Total Bs: <span className="font-mono text-slate-200">{ventas.total_bs}</span>
          </p>
          <p className="text-sm text-slate-400">
            Total USD: <span className="font-mono text-slate-200">{ventas.total_usd}</span>
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Compras</p>
          <p className="mt-2 text-2xl font-semibold text-white">{compras.cantidad}</p>
          <p className="mt-1 text-sm text-slate-400">
            Total Bs: <span className="font-mono text-slate-200">{compras.total_bs}</span>
          </p>
        </div>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="text-sm font-semibold text-white">Vendedores que más vendieron (Bs)</h2>
          <p className="mt-1 text-xs text-slate-500">Por total facturado en el período.</p>
          <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-black/20 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Vendedor</th>
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Ventas</th>
                  <th className="px-4 py-3">Total Bs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {topVendedores.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-slate-500" colSpan={4}>
                      Sin datos (¿hay ventas con `usuario_id` en el período?).
                    </td>
                  </tr>
                ) : (
                  topVendedores.map((r, i) => (
                    <tr key={`${r.username}-${i}`} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-white">{r.nombre_completo}</td>
                      <td className="px-4 py-3 font-mono text-slate-400">{r.username}</td>
                      <td className="px-4 py-3 text-slate-300">{r.ventas}</td>
                      <td className="px-4 py-3 font-mono text-slate-200">{r.total_bs}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-white">Productos más vendidos</h2>
          <p className="mt-1 text-xs text-slate-500">Por unidades (detalle de venta).</p>
          <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-black/20 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3">Unid.</th>
                  <th className="px-4 py-3">Total Bs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {topProductos.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-slate-500" colSpan={4}>
                      Sin líneas en el período (tabla `venta_detalle` o sin ventas confirmadas).
                    </td>
                  </tr>
                ) : (
                  topProductos.map((r, i) => (
                    <tr key={`${r.codigo}-${i}`} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-mono text-slate-400">{r.codigo}</td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-white">{r.nombre}</td>
                      <td className="px-4 py-3 text-amber-200">{r.unidades}</td>
                      <td className="px-4 py-3 font-mono text-slate-200">{r.total_bs}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <h2 className="mt-10 text-sm font-semibold text-white">Ventas por sucursal</h2>
      <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-black/20 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Sucursal</th>
              <th className="px-4 py-3">Ventas</th>
              <th className="px-4 py-3">Total Bs</th>
              <th className="px-4 py-3">Total USD</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {porSucursalVentas.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={4}>
                  Sin ventas en el período.
                </td>
              </tr>
            ) : (
              porSucursalVentas.map((r) => (
                <tr key={r.sucursal} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-white">{r.sucursal}</td>
                  <td className="px-4 py-3 text-slate-300">{r.ventas}</td>
                  <td className="px-4 py-3 font-mono text-slate-200">{r.total_bs}</td>
                  <td className="px-4 py-3 font-mono text-slate-400">{r.total_usd}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-sm font-semibold text-white">Compras por sucursal</h2>
      <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-black/20 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Sucursal</th>
              <th className="px-4 py-3">Compras</th>
              <th className="px-4 py-3">Total Bs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {porSucursalCompras.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={3}>
                  Sin compras en el período.
                </td>
              </tr>
            ) : (
              porSucursalCompras.map((r) => (
                <tr key={r.sucursal} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-white">{r.sucursal}</td>
                  <td className="px-4 py-3 text-slate-300">{r.compras}</td>
                  <td className="px-4 py-3 font-mono text-slate-200">{r.total_bs}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-sm font-semibold text-white">Stock bajo (≤ 5)</h2>
      <p className="mt-1 text-xs text-slate-500">Global por sucursal (no depende del período arriba).</p>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/40">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-white/10 bg-black/20 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Sucursal</th>
              <th className="px-4 py-3">Producto</th>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Stock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {stockBajo.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={4}>
                  No hay ítems con stock ≤ 5 en sucursales activas.
                </td>
              </tr>
            ) : (
              stockBajo.map((r, i) => (
                <tr key={`${r.codigo}-${r.sucursal}-${i}`} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-slate-300">{r.sucursal}</td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-white">{r.producto}</td>
                  <td className="px-4 py-3 font-mono text-slate-400">{r.codigo}</td>
                  <td className="px-4 py-3 text-amber-300">{r.stock}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminPageShell>
  );
}

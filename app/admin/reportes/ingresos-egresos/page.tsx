import { AdminPageShell } from "@/app/admin/_components/admin-page-shell";
import { AdminIngresosEgresosPrintButton } from "@/app/admin/reportes/ingresos-egresos/_components/admin-ingresos-egresos-print";
import { ReportesNavTabs } from "@/app/admin/reportes/_components/reportes-nav-tabs";
import {
  calcularResumenIngresosEgresos,
  labelFechaReporteBo,
  type IngresosEgresosReporteData,
} from "@/lib/caja/ingresos-egresos-reporte-html";
import { listCajaSolicitudesSucursalDia } from "@/lib/data/caja-solicitudes";
import { getReporteIngresosEgresosDiaSucursal } from "@/lib/data/caja-movimientos";
import { listSucursales } from "@/lib/data/sucursales";
import { formatDateTimeMysqlBolivia, formatoMostrarFechaHoraBo, parseIsoDateOnly } from "@/lib/fecha-bolivia";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Ingresos y egresos",
};

function parseSucursalFiltro(raw: string | undefined, sucursales: { id: number }[]): number | null {
  if (!raw?.trim()) return sucursales[0]?.id ?? null;
  const n = Number(raw.trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

function fmtBs(n: number) {
  return (Math.round(n * 100) / 100).toFixed(2);
}

function fmtUsd(n: number) {
  return (Math.round(n * 100) / 100).toFixed(2);
}

function labelEstadoSolicitud(estado: string): string {
  if (estado === "pendiente") return "Pendiente";
  if (estado === "aprobada") return "Aprobada";
  if (estado === "rechazada") return "Rechazada";
  if (estado === "registrada") return "Registrada";
  return estado || "—";
}

function fmtFechaHora(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-BO", formatoMostrarFechaHoraBo);
}

export default async function AdminIngresosEgresosPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; sucursal?: string }>;
}) {
  const sp = await searchParams;
  const sucursalesRaw = await listSucursales();
  const sucursales = sucursalesRaw.filter((s) => s.estado === "activo").sort((a, b) => a.id - b.id);

  const hoy = formatDateTimeMysqlBolivia(new Date()).slice(0, 10);
  const fechaParam = sp.fecha?.trim() ?? "";
  const sucursalParam = sp.sucursal?.trim() ?? "";

  if (fechaParam === "" && sucursalParam === "" && sucursales.length > 0) {
    redirect(`/admin/reportes/ingresos-egresos?fecha=${hoy}&sucursal=${sucursales[0].id}`);
  }

  const fechaParsed = fechaParam ? parseIsoDateOnly(fechaParam) : parseIsoDateOnly(hoy);
  const sucursalId = parseSucursalFiltro(sucursalParam || undefined, sucursales);

  let filtroError: string | null = null;
  if (fechaParam && !fechaParsed) filtroError = "La fecha no es válida.";
  else if (sucursalParam && !sucursalId) filtroError = "La sucursal elegida no es válida.";
  else if (sucursales.length === 0) filtroError = "No hay sucursales activas.";

  const apiFecha = fechaParsed ?? hoy;
  const sucursalActiva = sucursalId != null ? sucursales.find((s) => s.id === sucursalId) : null;

  const reporteRaw =
    !filtroError && sucursalActiva
      ? await getReporteIngresosEgresosDiaSucursal(sucursalActiva.id, apiFecha, sucursalActiva.nombre)
      : null;

  const solicitudes =
    !filtroError && sucursalActiva
      ? await listCajaSolicitudesSucursalDia(sucursalActiva.id, apiFecha)
      : [];

  const reporte: IngresosEgresosReporteData | null = reporteRaw
    ? {
        fecha: reporteRaw.fecha,
        sucursalNombre: reporteRaw.sucursalNombre,
        tiendaCodigo: reporteRaw.tiendaCodigo,
        cajeroUsername: "ADMIN",
        cajeroNombre: "Consulta administrador",
        movimientos: reporteRaw.movimientos.map((m) => ({
          id: m.id,
          tipo: m.tipo,
          detalle: m.detalle,
          montoBs: m.montoBs,
          esCompraDolar: m.esCompraDolar,
          montoUsd: m.montoUsd,
        })),
        ventasProductos: [],
        ventaTotalBs: 0,
        cantidadVentasCobradas: 0,
      }
    : null;

  const resumen = reporte ? calcularResumenIngresosEgresos(reporte) : null;

  const cajerosUnicos = reporte
    ? [...new Set(reporteRaw!.movimientos.map((m) => m.cajeroNombre || m.cajeroUsername).filter(Boolean))]
    : [];

  const printEtiqueta =
    cajerosUnicos.length === 1
      ? cajerosUnicos[0]!
      : cajerosUnicos.length > 1
        ? `${cajerosUnicos.length} cajeros`
        : "Consulta administrador";

  return (
    <AdminPageShell
      backHref="/admin"
      backLabel="Inicio admin"
      title="Ingresos y egresos del día"
      description="Reporte diario de caja por sucursal: movimientos manuales, devoluciones y totales."
    >
      <ReportesNavTabs />

      {filtroError ? (
        <p className="mb-4 rounded-xl border border-rose-500/35 bg-rose-950/30 px-4 py-3 text-sm text-rose-100" role="alert">
          {filtroError}
        </p>
      ) : null}

      <form
        method="get"
        className="mb-6 flex flex-col gap-4 rounded-xl border border-white/10 bg-slate-950/40 p-4 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <div>
          <label htmlFor="filtro-sucursal-ie" className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Sucursal
          </label>
          <select
            id="filtro-sucursal-ie"
            name="sucursal"
            defaultValue={sucursalActiva?.id ?? ""}
            className="mt-1 min-w-[180px] rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white"
            required
          >
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filtro-fecha-ie" className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Fecha (día)
          </label>
          <input
            id="filtro-fecha-ie"
            type="date"
            name="fecha"
            defaultValue={apiFecha}
            className="mt-1 rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white"
            required
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
          >
            Ver reporte
          </button>
          <a
            href={`/admin/reportes/ingresos-egresos?fecha=${hoy}&sucursal=${sucursales[0]?.id ?? ""}`}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
          >
            Hoy
          </a>
        </div>
      </form>

      {reporte && resumen ? (
        <>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-300">
                <span className="text-slate-500">Sucursal:</span> {reporte.sucursalNombre}
                {reporte.tiendaCodigo ? (
                  <span className="ml-2 font-mono text-xs text-slate-500">({reporte.tiendaCodigo})</span>
                ) : null}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                <span className="text-slate-500">Fecha:</span> {labelFechaReporteBo(reporte.fecha)}
              </p>
            </div>
            <AdminIngresosEgresosPrintButton data={reporte} cajeroEtiqueta={printEtiqueta} />
          </div>

          <div className="mb-6 grid gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <span className="text-slate-500">Total ingresos</span>
              <p className="font-mono text-lg text-emerald-200">{fmtBs(resumen.ing)} Bs</p>
            </div>
            <div>
              <span className="text-slate-500">Total egresos</span>
              <p className="font-mono text-lg text-rose-200">{fmtBs(resumen.egr)} Bs</p>
            </div>
            <div>
              <span className="text-slate-500">Total C$ (USD comprados)</span>
              <p className="font-mono text-lg text-amber-200">{fmtUsd(resumen.totalCDolar)} USD</p>
            </div>
            <div>
              <span className="text-slate-500">Neto del día</span>
              <p className="font-mono text-lg font-semibold text-white">{fmtBs(resumen.neto)} Bs</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.04] text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-2">Hora</th>
                  <th className="px-3 py-2">Cajero</th>
                  <th className="px-3 py-2">Detalle</th>
                  <th className="w-16 px-2 py-2 text-right">Cant.</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2 text-right">Monto Bs</th>
                  <th className="px-3 py-2 text-right">C$ (USD)</th>
                </tr>
              </thead>
              <tbody>
                {reporte.movimientos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                      Sin movimientos para este día.
                    </td>
                  </tr>
                ) : null}
                {reporteRaw!.movimientos.map((m) => (
                  <tr key={m.id} className="border-b border-white/5 text-slate-200">
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-400">{fmtFechaHora(m.fecha)}</td>
                    <td className="px-3 py-2">
                      <div className="text-xs text-slate-200">{m.cajeroNombre}</div>
                      <div className="font-mono text-[10px] text-slate-500">{m.cajeroUsername}</div>
                    </td>
                    <td className="px-3 py-2">{m.detalle}</td>
                    <td className="px-2 py-2 text-right text-slate-500">—</td>
                    <td className="px-3 py-2 capitalize">
                      <span className={m.tipo === "ingreso" ? "text-emerald-300" : "text-rose-300"}>{m.tipo}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtBs(m.montoBs)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-amber-200/90">
                      {m.esCompraDolar && m.montoUsd != null ? fmtUsd(m.montoUsd) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {solicitudes.length > 0 ? (
            <section className="mt-8">
              <h2 className="text-sm font-semibold text-white">Solicitudes del día (devoluciones / cambios)</h2>
              <p className="mt-1 text-xs text-slate-500">Solo consulta; la aprobación está en Solicitudes de caja.</p>
              <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[780px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.04] text-xs uppercase tracking-wide text-slate-400">
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Estado</th>
                      <th className="px-3 py-2">Cajero</th>
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2">Devuelto</th>
                      <th className="px-3 py-2">Entregado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {solicitudes.map((s) => (
                      <tr key={s.id} className="border-b border-white/5 text-slate-200">
                        <td className="px-3 py-2 font-mono text-xs">{s.id}</td>
                        <td className="px-3 py-2 text-xs">{labelEstadoSolicitud(s.estado)}</td>
                        <td className="px-3 py-2 text-xs">{s.cajeroNombre}</td>
                        <td className="px-3 py-2 capitalize text-xs">{s.tipo}</td>
                        <td className="px-3 py-2 text-xs">
                          {s.codigoDevuelto} · Bs {fmtBs(s.montoDevueltoBs)}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {s.tipo === "cambio" ? `${s.codigoEntregado ?? "—"} · Bs ${fmtBs(s.montoEntregadoBs ?? 0)}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </AdminPageShell>
  );
}

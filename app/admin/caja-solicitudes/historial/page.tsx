import { AdminPageShell } from "@/app/admin/_components/admin-page-shell";
import { CajaSolicitudesNavTabs } from "@/app/admin/caja-solicitudes/_components/caja-solicitudes-nav-tabs";
import {
  listCajaSolicitudesHistorialAdmin,
  resumenCajaSolicitudesHistorialAdmin,
  type CajaSolicitudEstado,
  type CajaSolicitudTipo,
} from "@/lib/data/caja-solicitudes";
import { listSucursales } from "@/lib/data/sucursales";
import {
  formatDateTimeMysqlBolivia,
  formatoMostrarFechaHoraBo,
  parseIsoDateOnly,
} from "@/lib/fecha-bolivia";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Historial solicitudes de caja",
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

function parseSucursalFiltro(raw: string | undefined): number | null {
  if (!raw?.trim()) return null;
  const n = Number(raw.trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseEstadoFiltro(raw: string | undefined): CajaSolicitudEstado | "todas" {
  const s = raw?.trim().toLowerCase();
  if (s === "pendiente" || s === "aprobada" || s === "rechazada" || s === "registrada") return s;
  return "todas";
}

function parseTipoFiltro(raw: string | undefined): CajaSolicitudTipo | "todos" {
  const s = raw?.trim().toLowerCase();
  if (s === "devolucion" || s === "cambio") return s;
  return "todos";
}

function labelEstado(estado: string): string {
  if (estado === "pendiente") return "Pendiente";
  if (estado === "aprobada") return "Aprobada";
  if (estado === "rechazada") return "Rechazada";
  if (estado === "registrada") return "Registrada";
  return estado || "—";
}

function badgeEstado(estado: string): string {
  if (estado === "pendiente") return "bg-amber-500/20 text-amber-200";
  if (estado === "aprobada") return "bg-sky-500/20 text-sky-200";
  if (estado === "rechazada") return "bg-rose-500/20 text-rose-200";
  if (estado === "registrada") return "bg-emerald-500/20 text-emerald-200";
  return "bg-slate-500/20 text-slate-300";
}

function labelTipo(tipo: string): string {
  if (tipo === "devolucion") return "Devolución";
  if (tipo === "cambio") return "Cambio";
  return tipo || "—";
}

function fmtBs(n: number) {
  return (Math.round(Number(n) * 100) / 100).toFixed(2);
}

function fmtFecha(raw: string | null | undefined) {
  if (!raw?.trim()) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-BO", formatoMostrarFechaHoraBo);
}

export default async function AdminCajaSolicitudesHistorialPage({
  searchParams,
}: {
  searchParams: Promise<{
    desde?: string;
    hasta?: string;
    sucursal?: string;
    estado?: string;
    tipo?: string;
  }>;
}) {
  const sp = await searchParams;
  const sucursalesRaw = await listSucursales();
  const sucursales = sucursalesRaw.filter((s) => s.estado === "activo").sort((a, b) => a.id - b.id);

  const hoy = formatDateTimeMysqlBolivia(new Date()).slice(0, 10);
  const desdeParam = sp.desde?.trim() || "";
  const hastaParam = sp.hasta?.trim() || "";
  const sucursalParam = sp.sucursal?.trim() || "";
  const estadoParam = sp.estado?.trim() || "";
  const tipoParam = sp.tipo?.trim() || "";

  const desdeParsed = desdeParam ? parseIsoDateOnly(desdeParam) : null;
  const hastaParsed = hastaParam ? parseIsoDateOnly(hastaParam) : null;
  const sucursalParsed = parseSucursalFiltro(sucursalParam);
  const estadoFiltro = parseEstadoFiltro(estadoParam || undefined);
  const tipoFiltro = parseTipoFiltro(tipoParam || undefined);

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

  const useFiltroExplicito = Boolean(desdeParam || hastaParam || sucursalParam || estadoParam || tipoParam);
  const useFiltro = Boolean(fDesde && fHasta && !filtroError);
  const apiDesde = useFiltro ? fDesde! : restarDiasIso(hoy, 29);
  const apiHasta = useFiltro ? fHasta! : hoy;
  const apiSucursal = filtroError ? null : sucursalParsed;

  const historialOpts = {
    fechaDesde: apiDesde,
    fechaHasta: apiHasta,
    sucursalId: apiSucursal,
    estado: estadoFiltro,
    tipo: tipoFiltro,
  };

  const [rows, resumen] = filtroError
    ? [[], { total: 0, pendientes: 0, aprobadas: 0, rechazadas: 0, registradas: 0, montoDevueltoRegistradasBs: 0 }]
    : await Promise.all([
        listCajaSolicitudesHistorialAdmin({ ...historialOpts, limit: 500 }),
        resumenCajaSolicitudesHistorialAdmin(historialOpts),
      ]);

  const nombreSucursalActiva =
    apiSucursal == null ? null : sucursales.find((s) => s.id === apiSucursal)?.nombre ?? null;

  return (
    <AdminPageShell
      backHref="/admin"
      backLabel="Inicio admin"
      title="Solicitudes de caja"
      description="Historial de devoluciones y cambios solicitados por cajeros. Filtrá por fechas, sucursal, estado y tipo."
    >
      <CajaSolicitudesNavTabs />

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
          <label htmlFor="filtro-sucursal" className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Sucursal
          </label>
          <select
            id="filtro-sucursal"
            name="sucursal"
            defaultValue={apiSucursal != null ? String(apiSucursal) : ""}
            className="mt-1 min-w-[160px] rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white"
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
            defaultValue={useFiltroExplicito && fDesde ? fDesde : apiDesde}
            className="mt-1 rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white"
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
            defaultValue={useFiltroExplicito && fHasta ? fHasta : apiHasta}
            className="mt-1 rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label htmlFor="filtro-estado" className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Estado
          </label>
          <select
            id="filtro-estado"
            name="estado"
            defaultValue={estadoFiltro}
            className="mt-1 min-w-[140px] rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white"
          >
            <option value="todas">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="aprobada">Aprobada</option>
            <option value="rechazada">Rechazada</option>
            <option value="registrada">Registrada</option>
          </select>
        </div>
        <div>
          <label htmlFor="filtro-tipo" className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Tipo
          </label>
          <select
            id="filtro-tipo"
            name="tipo"
            defaultValue={tipoFiltro}
            className="mt-1 min-w-[140px] rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white"
          >
            <option value="todos">Todos</option>
            <option value="devolucion">Devolución</option>
            <option value="cambio">Cambio</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500"
          >
            Filtrar
          </button>
          <a
            href="/admin/caja-solicitudes/historial"
            className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
          >
            Limpiar
          </a>
        </div>
      </form>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Total</p>
          <p className="mt-1 text-xl font-semibold text-white">{resumen.total}</p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wide text-amber-200/70">Pendientes</p>
          <p className="mt-1 text-xl font-semibold text-amber-100">{resumen.pendientes}</p>
        </div>
        <div className="rounded-xl border border-sky-500/20 bg-sky-950/20 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wide text-sky-200/70">Aprobadas</p>
          <p className="mt-1 text-xl font-semibold text-sky-100">{resumen.aprobadas}</p>
        </div>
        <div className="rounded-xl border border-rose-500/20 bg-rose-950/20 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wide text-rose-200/70">Rechazadas</p>
          <p className="mt-1 text-xl font-semibold text-rose-100">{resumen.rechazadas}</p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wide text-emerald-200/70">Registradas</p>
          <p className="mt-1 text-xl font-semibold text-emerald-100">{resumen.registradas}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Egreso registrado</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-slate-100">
            Bs {fmtBs(resumen.montoDevueltoRegistradasBs)}
          </p>
        </div>
      </div>

      <p className="mb-4 text-xs text-slate-500">
        {useFiltroExplicito
          ? `Mostrando solicitudes del ${apiDesde} al ${apiHasta}`
          : `Últimos 30 días (${apiDesde} al ${apiHasta})`}
        {nombreSucursalActiva ? ` · ${nombreSucursalActiva}` : ""}
        {estadoFiltro !== "todas" ? ` · ${labelEstado(estadoFiltro)}` : ""}
        {tipoFiltro !== "todos" ? ` · ${labelTipo(tipoFiltro)}` : ""}
        {" · "}
        {rows.length} fila{rows.length === 1 ? "" : "s"}
        {rows.length >= 500 ? " (máx. 500)" : ""}
      </p>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.04] text-xs uppercase tracking-wide text-slate-400">
              <th className="px-3 py-2">Solicitud</th>
              <th className="px-3 py-2">Sucursal</th>
              <th className="px-3 py-2">Cajero</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Devuelto</th>
              <th className="px-3 py-2">Entregado</th>
              <th className="px-3 py-2">Resolución</th>
              <th className="px-3 py-2">Registro caja</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-slate-500">
                  No hay solicitudes con estos filtros.
                </td>
              </tr>
            ) : (
              rows.map((s) => (
                <tr key={s.id} className="border-b border-white/5 align-top text-slate-200">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="font-mono text-xs text-slate-400">#{s.id}</div>
                    <div className="text-xs">{fmtFecha(s.fechaSolicitud)}</div>
                  </td>
                  <td className="px-3 py-2">{s.sucursalNombre}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-100">{s.cajeroNombre}</div>
                    <div className="text-[11px] font-mono text-slate-500">{s.cajeroUsername}</div>
                  </td>
                  <td className="px-3 py-2">{labelTipo(s.tipo)}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${badgeEstado(s.estado)}`}>
                      {labelEstado(s.estado)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-mono text-xs text-slate-300">{s.codigoDevuelto}</div>
                    <div className="text-xs">{s.nombreDevuelto ?? "—"}</div>
                    <div className="text-[11px] text-slate-500">
                      Cant: {s.cantidadDevuelta} · Bs {fmtBs(s.montoDevueltoBs)}
                    </div>
                    {s.notaCajero ? (
                      <div className="mt-1 text-[11px] text-slate-500">Nota: {s.notaCajero}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    {s.tipo === "cambio" ? (
                      <>
                        <div className="font-mono text-xs text-slate-300">{s.codigoEntregado ?? "—"}</div>
                        <div className="text-xs">{s.nombreEntregado ?? "—"}</div>
                        <div className="text-[11px] text-slate-500">
                          Cant: {s.cantidadEntregada ?? 1} · Bs {fmtBs(s.montoEntregadoBs ?? 0)}
                        </div>
                      </>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {s.estado === "pendiente" ? (
                      <span className="text-slate-500">—</span>
                    ) : (
                      <>
                        <div className="text-xs">{fmtFecha(s.fechaResolucion)}</div>
                        <div className="text-[11px] text-slate-500">{s.adminNombre ?? "—"}</div>
                        {s.notaAdmin ? (
                          <div className="mt-1 text-[11px] text-slate-500">{s.notaAdmin}</div>
                        ) : null}
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {s.estado === "registrada" ? (
                      <>
                        <div className="text-xs">{fmtFecha(s.fechaRegistro)}</div>
                        <div className="text-[11px] text-slate-500">
                          Egreso #{s.movimientoEgresoId ?? "—"}
                          {s.movimientoIngresoId != null ? ` · Ingreso #${s.movimientoIngresoId}` : ""}
                        </div>
                      </>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminPageShell>
  );
}

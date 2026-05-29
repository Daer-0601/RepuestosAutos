"use client";

import { formatoMostrarFechaHoraBo } from "@/lib/fecha-bolivia";
import { Check, Loader2, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type CajaSolicitud = {
  id: number;
  sucursalNombre: string;
  cajeroUsername: string;
  cajeroNombre: string;
  tipo: "devolucion" | "cambio";
  estado: "pendiente" | "aprobada" | "rechazada" | "registrada";
  codigoDevuelto: string;
  nombreDevuelto: string | null;
  cantidadDevuelta: number;
  montoDevueltoBs: number;
  codigoEntregado: string | null;
  nombreEntregado: string | null;
  cantidadEntregada: number | null;
  montoEntregadoBs: number | null;
  notaCajero: string | null;
  notaAdmin: string | null;
  adminNombre: string | null;
  fechaSolicitud: string;
};

function fmtBs(n: number) {
  const x = Math.round(Number(n) * 100) / 100;
  return x.toFixed(2);
}

function fmtFecha(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-BO", formatoMostrarFechaHoraBo);
}

export function CajaSolicitudesAdminPanel() {
  const [estado, setEstado] = useState<"pendiente" | "todas">("pendiente");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [solicitudes, setSolicitudes] = useState<CajaSolicitud[]>([]);
  const [nota, setNota] = useState<Record<number, string>>({});
  const [pendingId, setPendingId] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const q = new URLSearchParams({ estado });
      const res = await fetch(`/api/admin/caja-solicitudes?${q}`, { cache: "no-store" });
      const json = (await res.json()) as { error?: string; solicitudes?: CajaSolicitud[] };
      if (!res.ok) {
        setSolicitudes([]);
        setErr(json.error ?? "No se pudieron cargar las solicitudes.");
        return;
      }
      setSolicitudes(Array.isArray(json.solicitudes) ? json.solicitudes : []);
    } catch {
      setSolicitudes([]);
      setErr("Error de red.");
    } finally {
      setLoading(false);
    }
  }, [estado]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const pendientes = useMemo(() => solicitudes.filter((s) => s.estado === "pendiente"), [solicitudes]);

  const resolver = async (id: number, decision: "aprobar" | "rechazar") => {
    setPendingId(id);
    setErr(null);
    try {
      const res = await fetch("/api/admin/caja-solicitudes/resolver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          decision,
          nota: (nota[id] ?? "").trim() || undefined,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErr(json.error ?? "No se pudo resolver la solicitud.");
        return;
      }
      await cargar();
    } catch {
      setErr("Error de red.");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {err ? (
        <p className="rounded-xl border border-rose-500/35 bg-rose-950/30 px-4 py-3 text-sm text-rose-100" role="alert">
          {err}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-300">
            <span className="mr-2 text-xs text-slate-500">Estado</span>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value === "todas" ? "todas" : "pendiente")}
              className="rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1 text-sm text-slate-100"
            >
              <option value="pendiente">Pendientes</option>
              <option value="todas">Todas</option>
            </select>
          </label>
          {estado === "pendiente" ? (
            <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs text-amber-200">
              {pendientes.length} pendientes
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void cargar()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-sm text-slate-200 hover:bg-white/5 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.04] text-xs uppercase tracking-wide text-slate-400">
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Sucursal</th>
              <th className="px-3 py-2">Cajero</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Devuelto</th>
              <th className="px-3 py-2">Entregado</th>
              <th className="px-3 py-2">Nota</th>
              <th className="px-3 py-2">Acción</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                  <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
                  Cargando…
                </td>
              </tr>
            ) : solicitudes.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                  No hay solicitudes.
                </td>
              </tr>
            ) : (
              solicitudes.map((s) => (
                <tr key={s.id} className="border-b border-white/5 align-top text-slate-200">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="text-xs text-slate-400">{fmtFecha(s.fechaSolicitud)}</div>
                    <div className="text-[11px] text-slate-500">#{s.id} · {s.estado}</div>
                  </td>
                  <td className="px-3 py-2">{s.sucursalNombre}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-100">{s.cajeroNombre}</div>
                    <div className="text-[11px] font-mono text-slate-500">{s.cajeroUsername}</div>
                  </td>
                  <td className="px-3 py-2 capitalize">{s.tipo}</td>
                  <td className="px-3 py-2">
                    <div className="font-mono text-xs text-slate-300">{s.codigoDevuelto}</div>
                    <div className="text-xs">{s.nombreDevuelto ?? "—"}</div>
                    <div className="text-[11px] text-slate-500">
                      Cant: {s.cantidadDevuelta} · Bs {fmtBs(s.montoDevueltoBs)}
                    </div>
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
                    <div className="text-xs text-slate-300">{s.notaCajero ?? "—"}</div>
                    {s.estado === "pendiente" ? (
                      <input
                        type="text"
                        value={nota[s.id] ?? ""}
                        onChange={(e) => setNota((prev) => ({ ...prev, [s.id]: e.target.value }))}
                        placeholder="Nota admin (opcional)"
                        className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-600"
                      />
                    ) : (
                      <div className="mt-2 text-[11px] text-slate-500">
                        Admin: {s.adminNombre ?? "—"}{s.notaAdmin ? ` · ${s.notaAdmin}` : ""}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {s.estado === "pendiente" ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void resolver(s.id, "aprobar")}
                          disabled={pendingId === s.id}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                        >
                          {pendingId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          Aprobar
                        </button>
                        <button
                          type="button"
                          onClick={() => void resolver(s.id, "rechazar")}
                          disabled={pendingId === s.id}
                          className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
                        >
                          {pendingId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                          Rechazar
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


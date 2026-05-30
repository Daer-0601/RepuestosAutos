"use client";

import { Loader2, RefreshCw, Unlock } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type ClienteBloqueado = {
  id: number;
  nombre: string;
  telefono: string | null;
  carnetIdentidad: string | null;
  saldoVencidoBs: number;
  creditosVencidos: number;
  fechaLimiteMasAntigua: string | null;
};

export function ClientesBloqueadosPanel() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ClienteBloqueado[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [activandoId, setActivandoId] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/clientes/bloqueados-credito", { cache: "no-store" });
      const data = (await res.json()) as { clientes?: ClienteBloqueado[]; error?: string };
      if (!res.ok) {
        setRows([]);
        setErr(data.error ?? "No se pudo cargar la lista.");
        return;
      }
      setRows(Array.isArray(data.clientes) ? data.clientes : []);
    } catch {
      setErr("Error de red.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function reactivar(clienteId: number) {
    if (!confirm("¿Reactivar este cliente? Podrá volver a recibir crédito si no tiene otros saldos vencidos.")) {
      return;
    }
    setActivandoId(clienteId);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/clientes/bloqueados-credito", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMsg(data.error ?? "No se pudo reactivar.");
        return;
      }
      setMsg("Cliente reactivado.");
      void cargar();
    } catch {
      setMsg("Error de red.");
    } finally {
      setActivandoId(null);
    }
  }

  return (
    <div className="space-y-4">
      {err ? (
        <p className="rounded-xl border border-rose-500/35 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">{err}</p>
      ) : null}
      {msg ? (
        <p className="rounded-xl border border-emerald-500/35 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100">
          {msg}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void cargar()}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-300"
      >
        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        Actualizar
      </button>

      {loading ? (
        <p className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">No hay clientes bloqueados por crédito vencido.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-black/20 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Teléfono</th>
                <th className="px-4 py-3 text-right">Saldo vencido</th>
                <th className="px-4 py-3 text-right">Créditos</th>
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-b border-white/5 text-slate-200">
                  <td className="px-4 py-3 font-medium">{c.nombre}</td>
                  <td className="px-4 py-3 text-slate-400">{c.telefono ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-rose-200">
                    {c.saldoVencidoBs.toFixed(2)} Bs
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.creditosVencidos}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={activandoId === c.id}
                      onClick={() => void reactivar(c.id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {activandoId === c.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Unlock className="h-3.5 w-3.5" />
                      )}
                      Reactivar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

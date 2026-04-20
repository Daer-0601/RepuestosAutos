"use client";

import { Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type SucursalOpt = { id: number; nombre: string };

type ProductoRow = {
  producto_id: number;
  codigo: string;
  nombre: string;
  stock: number;
};

type LineaState = {
  key: string;
  query: string;
  buscando: boolean;
  resultados: ProductoRow[];
  productoId: number | null;
  codigo: string;
  nombre: string;
  stockOrigen: number;
  cantidad: string;
};

function newLine(): LineaState {
  return {
    key: typeof crypto !== "undefined" ? crypto.randomUUID() : String(Math.random()),
    query: "",
    buscando: false,
    resultados: [],
    productoId: null,
    codigo: "",
    nombre: "",
    stockOrigen: 0,
    cantidad: "1",
  };
}

export function TraspasoForm({ sucursales }: { sucursales: SucursalOpt[] }) {
  const [sucursalOrigenId, setSucursalOrigenId] = useState(sucursales[0]?.id ? String(sucursales[0].id) : "");
  const [sucursalDestinoId, setSucursalDestinoId] = useState(sucursales[1]?.id ? String(sucursales[1].id) : "");
  const [nota, setNota] = useState("");
  const [lineas, setLineas] = useState<LineaState[]>([newLine()]);
  const [stockOrigenRows, setStockOrigenRows] = useState<ProductoRow[]>([]);
  const [stockOrigenLoading, setStockOrigenLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const origenNum = Number(sucursalOrigenId);
  const destinoNum = Number(sucursalDestinoId);

  const puedeEnviar = useMemo(
    () =>
      Number.isFinite(origenNum) &&
      origenNum > 0 &&
      Number.isFinite(destinoNum) &&
      destinoNum > 0 &&
      origenNum !== destinoNum &&
      lineas.some((l) => l.productoId != null),
    [destinoNum, lineas, origenNum]
  );

  const resumenStock = useMemo(
    () =>
      lineas
        .filter((l) => l.productoId != null)
        .map((l) => {
          const cant = Math.trunc(Number(l.cantidad));
          const cantidad = Number.isFinite(cant) && cant > 0 ? cant : 0;
          return {
            key: l.key,
            codigo: l.codigo,
            nombre: l.nombre,
            stockOrigen: l.stockOrigen,
            cantidad,
            stockRestante: l.stockOrigen - cantidad,
          };
        }),
    [lineas]
  );

  useEffect(() => {
    if (!Number.isFinite(origenNum) || origenNum < 1) {
      setStockOrigenRows([]);
      return;
    }
    let cancelled = false;
    setStockOrigenLoading(true);
    fetch(`/api/admin/traspasos?sucursal=${origenNum}&limit=10`, { cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json()) as { productos?: ProductoRow[]; error?: string };
        if (!res.ok) {
          throw new Error(data.error || "No se pudo cargar stock de origen.");
        }
        if (!cancelled) {
          setStockOrigenRows(data.productos ?? []);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setStockOrigenRows([]);
          setErr(e instanceof Error ? e.message : "No se pudo cargar stock de origen.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setStockOrigenLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [origenNum]);

  function updateLine(key: string, patch: Partial<LineaState>) {
    setLineas((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLineas((prev) => [...prev, newLine()]);
  }

  function removeLine(key: string) {
    setLineas((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.key !== key)));
  }

  async function buscarLinea(key: string) {
    const q = lineas.find((l) => l.key === key)?.query.trim() ?? "";
    if (!q) return;
    if (!Number.isFinite(origenNum) || origenNum < 1) {
      setErr("Elegí sucursal origen.");
      return;
    }

    updateLine(key, { buscando: true, resultados: [] });
    try {
      const res = await fetch(`/api/admin/traspasos?sucursal=${origenNum}&q=${encodeURIComponent(q)}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as { productos?: ProductoRow[]; error?: string };
      if (!res.ok) throw new Error(data.error || "No se pudo buscar productos.");
      updateLine(key, { resultados: data.productos ?? [], buscando: false });
    } catch (e) {
      updateLine(key, { buscando: false });
      setErr(e instanceof Error ? e.message : "No se pudo buscar productos.");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);

    if (!Number.isFinite(origenNum) || origenNum < 1 || !Number.isFinite(destinoNum) || destinoNum < 1) {
      setErr("Elegí sucursal origen y destino.");
      return;
    }
    if (origenNum === destinoNum) {
      setErr("Origen y destino deben ser sucursales distintas.");
      return;
    }

    const payloadLineas = lineas
      .map((l) => ({
        productoId: l.productoId,
        cantidad: Number(l.cantidad),
        codigo: l.codigo,
        stockOrigen: l.stockOrigen,
      }))
      .filter((l) => l.productoId != null);

    if (payloadLineas.length === 0) {
      setErr("Agregá al menos un producto.");
      return;
    }
    for (const l of payloadLineas) {
      if (!Number.isFinite(l.cantidad) || l.cantidad < 1) {
        setErr(`Cantidad inválida para ${l.codigo || "producto"}.`);
        return;
      }
      if (l.cantidad > l.stockOrigen) {
        setErr(`La cantidad excede stock disponible para ${l.codigo}.`);
        return;
      }
    }

    setPending(true);
    try {
      const res = await fetch("/api/admin/traspasos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sucursalOrigenId: origenNum,
          sucursalDestinoId: destinoNum,
          nota: nota.trim() || null,
          lineas: payloadLineas.map((l) => ({ productoId: l.productoId, cantidad: Math.trunc(l.cantidad) })),
        }),
      });
      const data = (await res.json()) as { ok?: boolean; referenciaId?: number; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "No se pudo registrar el traspaso.");
      }
      setOk(`Traspaso registrado. Referencia #${data.referenciaId}.`);
      setNota("");
      setLineas([newLine()]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo registrar el traspaso.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">Sucursal origen</label>
          <select
            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white"
            value={sucursalOrigenId}
            onChange={(e) => setSucursalOrigenId(e.target.value)}
            disabled={pending}
          >
            <option value="">Elegir…</option>
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">Sucursal destino</label>
          <select
            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white"
            value={sucursalDestinoId}
            onChange={(e) => setSucursalDestinoId(e.target.value)}
            disabled={pending}
          >
            <option value="">Elegir…</option>
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">Nota (opcional)</label>
          <input
            type="text"
            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            disabled={pending}
            placeholder="Ej: reposición rápida"
          />
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Stock en sucursal origen </h3>
          <p className="mt-1 text-xs text-slate-500">Vista rápida para orientarte antes de agregar líneas.</p>
          <div className="mt-2 overflow-x-auto rounded-xl border border-white/10 bg-slate-950/40">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="border-b border-white/10 bg-black/25 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Código</th>
                  <th className="px-3 py-2">Producto</th>
                  <th className="px-3 py-2">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {stockOrigenLoading ? (
                  <tr>
                    <td className="px-3 py-4 text-slate-500" colSpan={3}>
                      Cargando stock...
                    </td>
                  </tr>
                ) : stockOrigenRows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-slate-500" colSpan={3}>
                      Sin stock disponible o elegí sucursal origen.
                    </td>
                  </tr>
                ) : (
                  stockOrigenRows.map((r) => (
                    <tr key={`stock-${r.producto_id}`} className="hover:bg-white/[0.02]">
                      <td className="px-3 py-2 font-mono text-slate-300">{r.codigo}</td>
                      <td className="max-w-[360px] truncate px-3 py-2 text-white">{r.nombre}</td>
                      <td className="px-3 py-2 text-emerald-300">{r.stock}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Productos a traspasar</h3>
          <button
            type="button"
            onClick={addLine}
            className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-slate-800 px-2.5 py-1.5 text-xs text-white hover:bg-slate-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar línea
          </button>
        </div>

        <div className="space-y-2">
          {lineas.map((l) => (
            <div key={l.key} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={l.query}
                    onChange={(e) => updateLine(l.key, { query: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void buscarLinea(l.key);
                      }
                    }}
                    placeholder="Buscar por código, nombre o descripción"
                    className="w-full rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white"
                    disabled={pending}
                  />
                  <button
                    type="button"
                    onClick={() => buscarLinea(l.key)}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-slate-800 px-2.5 py-2 text-xs text-white hover:bg-slate-700"
                    disabled={pending || l.buscando}
                  >
                    <Search className="h-3.5 w-3.5" />
                    {l.buscando ? "Buscando…" : "Buscar"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => removeLine(l.key)}
                  className="inline-flex items-center justify-center rounded-lg border border-rose-500/30 bg-rose-950/30 px-2 py-2 text-rose-200 hover:bg-rose-900/40"
                  title="Quitar línea"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {l.resultados.length > 0 ? (
                <div className="mt-2 max-h-40 overflow-auto rounded-lg border border-white/10 bg-slate-950/70">
                  {l.resultados.map((r) => (
                    <button
                      key={`${l.key}-${r.producto_id}`}
                      type="button"
                      onClick={() =>
                        updateLine(l.key, {
                          productoId: r.producto_id,
                          codigo: r.codigo,
                          nombre: r.nombre,
                          stockOrigen: r.stock,
                          cantidad: "1",
                          resultados: [],
                          query: `${r.codigo} · ${r.nombre}`,
                        })
                      }
                      className="flex w-full items-start justify-between gap-3 border-b border-white/5 px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/5"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-mono text-xs text-slate-400">{r.codigo}</span>
                        <span className="block truncate">{r.nombre}</span>
                      </span>
                      <span className="shrink-0 text-xs text-emerald-300">Stock: {r.stock}</span>
                    </button>
                  ))}
                </div>
              ) : null}

              {l.productoId ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                  <div>
                    <p className="font-mono text-xs text-slate-400">{l.codigo}</p>
                    <p className="truncate text-sm text-white">{l.nombre}</p>
                  </div>
                  <p className="text-xs text-emerald-300">Disponible: {l.stockOrigen}</p>
                  <div>
                    <label className="block text-[11px] uppercase tracking-wide text-slate-500">Cantidad</label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      className="mt-1 w-24 rounded-lg border border-white/10 bg-slate-950/80 px-2 py-1.5 text-sm text-white"
                      value={l.cantidad}
                      onChange={(e) => updateLine(l.key, { cantidad: e.target.value })}
                      disabled={pending}
                    />
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500">Seleccioná un producto para esta línea.</p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-slate-950/40">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-white/10 bg-black/25 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Producto</th>
                <th className="px-3 py-2">Stock origen</th>
                <th className="px-3 py-2">Cant. mover</th>
                <th className="px-3 py-2">Stock restante</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {resumenStock.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-slate-500" colSpan={5}>
                    Todavía no hay productos seleccionados.
                  </td>
                </tr>
              ) : (
                resumenStock.map((r) => (
                  <tr key={r.key} className="hover:bg-white/[0.02]">
                    <td className="px-3 py-2 font-mono text-slate-300">{r.codigo}</td>
                    <td className="max-w-[280px] truncate px-3 py-2 text-white">{r.nombre}</td>
                    <td className="px-3 py-2 text-emerald-300">{r.stockOrigen}</td>
                    <td className="px-3 py-2 text-amber-200">{r.cantidad}</td>
                    <td
                      className={`px-3 py-2 font-medium ${
                        r.stockRestante < 0 ? "text-rose-300" : "text-sky-200"
                      }`}
                    >
                      {r.stockRestante}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {err ? <p className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">{err}</p> : null}
      {ok ? <p className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200">{ok}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending || !puedeEnviar}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Registrando..." : "Registrar traspaso"}
        </button>
      </div>
    </form>
  );
}

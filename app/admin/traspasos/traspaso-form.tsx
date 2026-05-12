"use client";

import { Plus, Search, Trash2 } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";

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

  useEffect(() => {
    if (!Number.isFinite(origenNum) || origenNum < 1) {
      setStockOrigenRows([]);
      return;
    }
    let cancelled = false;
    setStockOrigenLoading(true);
    fetch(`/api/admin/traspasos?sucursal=${origenNum}&limit=50`, { cache: "no-store" })
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

  const tablaHeadCls = "border-b border-white/10 bg-black/25 text-xs uppercase tracking-wide text-slate-500";
  const ctrlInp =
    "w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white disabled:opacity-50";

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/40">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className={tablaHeadCls}>
              <th className="px-3 py-2.5">Sucursal origen</th>
              <th className="px-3 py-2.5">Sucursal destino</th>
              <th className="min-w-[200px] px-3 py-2.5">Nota (opcional)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="align-top hover:bg-white/[0.02]">
              <td className="border-b border-white/5 px-3 py-2.5">
                <select
                  className={ctrlInp}
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
              </td>
              <td className="border-b border-white/5 px-3 py-2.5">
                <select
                  className={ctrlInp}
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
              </td>
              <td className="border-b border-white/5 px-3 py-2.5">
                <input
                  type="text"
                  className={ctrlInp}
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  disabled={pending}
                  placeholder="Ej: reposición rápida"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="space-y-5 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white">Productos a traspasar</h3>
            <button
              type="button"
              onClick={addLine}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/15 bg-slate-800 px-2.5 py-1.5 text-xs text-white hover:bg-slate-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar fila
            </button>
          </div>

        <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/20">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead>
              <tr className={tablaHeadCls}>
                <th className="min-w-[220px] px-3 py-2.5">Buscar</th>
                <th className="min-w-[100px] px-3 py-2.5">Código</th>
                <th className="min-w-[200px] px-3 py-2.5">Producto</th>
                <th className="w-24 whitespace-nowrap px-3 py-2.5">Stock origen</th>
                <th className="w-28 whitespace-nowrap px-3 py-2.5">Cantidad</th>
                <th className="w-28 whitespace-nowrap px-3 py-2.5">Restante</th>
                <th className="w-14 px-3 py-2.5">
                  <span className="sr-only">Quitar</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {lineas.map((l) => {
                const cantTrunc = Math.trunc(Number(l.cantidad));
                const cantParsed = Number.isFinite(cantTrunc) && cantTrunc > 0 ? cantTrunc : 0;
                const restante =
                  l.productoId != null ? l.stockOrigen - cantParsed : null;
                const restNegativo = restante != null && restante < 0;

                return (
                  <Fragment key={l.key}>
                    <tr className="align-top hover:bg-white/[0.02]">
                      <td className="px-3 py-2.5">
                        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-stretch">
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
                            placeholder="Código, nombre…"
                            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950/80 px-2.5 py-2 text-sm text-white"
                            disabled={pending}
                          />
                          <button
                            type="button"
                            onClick={() => buscarLinea(l.key)}
                            className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border border-white/15 bg-slate-800 px-3 py-2 text-xs text-white hover:bg-slate-700 sm:max-w-[7rem]"
                            disabled={pending || l.buscando}
                          >
                            <Search className="h-3.5 w-3.5 shrink-0" />
                            <span className="hidden sm:inline">{l.buscando ? "…" : "Buscar"}</span>
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-slate-400">
                        {l.productoId ? l.codigo : "—"}
                      </td>
                      <td className="max-w-[280px] px-3 py-2.5">
                        <span className="line-clamp-2 text-slate-100" title={l.nombre}>
                          {l.productoId ? l.nombre : "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-emerald-300 tabular-nums">
                        {l.productoId != null ? l.stockOrigen : "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          type="number"
                          min={1}
                          step={1}
                          className="w-full min-w-[4.5rem] rounded-lg border border-white/10 bg-slate-950/80 px-2 py-1.5 tabular-nums text-sm text-white disabled:opacity-50"
                          value={l.cantidad}
                          onChange={(e) => updateLine(l.key, { cantidad: e.target.value })}
                          disabled={pending || l.productoId == null}
                        />
                      </td>
                      <td
                        className={`px-3 py-2.5 tabular-nums font-medium ${
                          restNegativo ? "text-rose-300" : "text-sky-200"
                        }`}
                      >
                        {restante == null ? "—" : restante}
                      </td>
                      <td className="px-2 py-2.5 align-top">
                        <button
                          type="button"
                          onClick={() => removeLine(l.key)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-950/30 text-rose-200 hover:bg-rose-900/40"
                          title="Quitar fila"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                    {l.resultados.length > 0 ? (
                      <tr className="bg-slate-950/45">
                        <td className="px-3 pb-3 pt-0" colSpan={7}>
                          <div className="rounded-lg border border-white/10">
                            <table className="w-full min-w-[520px] text-left text-sm">
                              <caption className="border-b border-white/10 px-3 py-2 text-left text-[11px] uppercase tracking-wide text-slate-500">
                                Resultados de búsqueda — pulsá una fila para usarla
                              </caption>
                              <thead>
                                <tr className={tablaHeadCls}>
                                  <th className="px-3 py-2">Código</th>
                                  <th className="px-3 py-2">Producto</th>
                                  <th className="w-28 whitespace-nowrap px-3 py-2">Stock</th>
                                  <th className="w-20 px-3 py-2">
                                    <span className="sr-only">Acción</span>
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5">
                                {l.resultados.map((r) => {
                                  const seleccionar = (): void =>
                                    updateLine(l.key, {
                                      productoId: r.producto_id,
                                      codigo: r.codigo,
                                      nombre: r.nombre,
                                      stockOrigen: r.stock,
                                      cantidad: "1",
                                      resultados: [],
                                      query: `${r.codigo} · ${r.nombre}`,
                                    });
                                  return (
                                    <tr
                                      key={`${l.key}-${r.producto_id}`}
                                      tabIndex={0}
                                      role="button"
                                      className="cursor-pointer hover:bg-white/[0.06]"
                                      onClick={seleccionar}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                          e.preventDefault();
                                          seleccionar();
                                        }
                                      }}
                                    >
                                      <td className="px-3 py-2 font-mono text-xs text-slate-300">{r.codigo}</td>
                                      <td className="max-w-[360px] px-3 py-2 text-slate-100">{r.nombre}</td>
                                      <td className="px-3 py-2 tabular-nums text-emerald-300">{r.stock}</td>
                                      <td className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-sky-300/95">
                                        Usar
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-slate-500">
          Una vez que busques, elegí una fila en la tabla de resultados; la cantidad no puede superar el stock en origen.
        </p>
        </div>

        <div className="border-t border-white/10 pt-4">
          <h3 className="text-sm font-semibold text-white">Stock en sucursal origen</h3>
          <p className="mt-1 text-xs text-slate-500">
            Referencia rápida antes de cargar líneas (misma sucursal que «Origen»).
          </p>
          <div className="mt-2 overflow-x-auto rounded-xl border border-white/10 bg-slate-950/40">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead>
                <tr className={tablaHeadCls}>
                  <th className="px-3 py-2">Código</th>
                  <th className="px-3 py-2">Producto</th>
                  <th className="px-3 py-2">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {stockOrigenLoading ? (
                  <tr>
                    <td className="px-3 py-4 text-slate-500" colSpan={3}>
                      Cargando stock…
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
                      <td className="px-3 py-2 tabular-nums text-emerald-300">{r.stock}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3 border-t border-white/10 pt-4">
          {err ? (
            <p className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">{err}</p>
          ) : null}
          {ok ? (
            <p className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200">{ok}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={pending || !puedeEnviar}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Registrando…" : "Registrar traspaso"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

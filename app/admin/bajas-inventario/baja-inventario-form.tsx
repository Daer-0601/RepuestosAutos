"use client";

import { ProductosCatalogoTabla } from "@/app/admin/productos/_components/productos-catalogo-tabla";
import {
  BajaLineasTabla,
  type BajaLineaRow,
} from "@/app/admin/bajas-inventario/_components/baja-lineas-tabla";
import { CATALOGO_FILAS_DEFAULT } from "@/lib/catalogo-productos-constants";
import {
  applyCatalogoTextFilterChange,
  type CatalogoTextFilterName,
} from "@/lib/catalogo-filtros-texto";
import type { ProductoCatalogoRowConStock } from "@/lib/data/productos-catalogo";
import type { SucursalRow } from "@/lib/data/sucursales";
import { ChevronDown, ChevronUp, Loader2, Plus, ScanLine } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

const STOCK_REFERENCIA_LIMIT = 10;

const inp =
  "w-full rounded border border-white/10 bg-slate-950/80 px-2 py-1.5 text-xs text-white placeholder:text-slate-600 outline-none focus:border-rose-500/40";

const inpBuscarTodo =
  "w-full rounded border border-white/10 bg-slate-950/80 px-1.5 py-1 text-[11px] leading-snug text-white placeholder:text-slate-600 outline-none focus:border-rose-500/40 placeholder:text-[10px]";

type CatalogoRowJson = Omit<ProductoCatalogoRowConStock, "stocksPorSucursal"> & {
  stocksPorSucursal: Record<string, number>;
};

type ProductoRow = {
  producto_id: number;
  codigo: string;
  nombre: string;
  stock: number;
};

function hydrateCatalogoRow(r: CatalogoRowJson): ProductoCatalogoRowConStock {
  const map = new Map<number, number>();
  for (const [k, v] of Object.entries(r.stocksPorSucursal ?? {})) {
    map.set(Number(k), Number(v));
  }
  return { ...r, stocksPorSucursal: map };
}

function metadatosLineaDesdeProducto(p: ProductoCatalogoRowConStock) {
  return {
    codigo: p.codigo,
    codigoPieza: p.codigo_pieza,
    medida: p.medida,
    nombre: p.nombre,
    unidad: p.unidad,
    descripcion: p.descripcion,
    qrPayload: p.qr_payload?.trim() ? p.qr_payload.trim() : p.codigo,
    imagenesUrls: Array.isArray(p.imagenes_urls) ? p.imagenes_urls : [],
  };
}

function nuevaLineaDesdeProducto(p: ProductoCatalogoRowConStock, stockSucursal: number): BajaLineaRow {
  return {
    key: typeof crypto !== "undefined" ? crypto.randomUUID() : String(Math.random()),
    productoId: p.id,
    ...metadatosLineaDesdeProducto(p),
    stockSucursal,
    cantidad: "1",
  };
}

function parseQty(s: string): number {
  const n = Math.trunc(Number(s.replace(",", ".")));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function snapCantidadBaja(raw: string, stockSucursal: number): string {
  const max = Math.max(0, Math.trunc(stockSucursal));
  const q = parseQty(raw);
  if (max < 1) return q > 0 ? String(q) : "1";
  if (q < 1) return "1";
  if (q > max) return String(max);
  return String(q);
}

export function BajaInventarioForm({ sucursales }: { sucursales: SucursalRow[] }) {
  const [sucursalId, setSucursalId] = useState(sucursales[0]?.id ? String(sucursales[0].id) : "");
  const [nota, setNota] = useState("");

  const [q, setQ] = useState("");
  const [codigo, setCodigo] = useState("");
  const [codigoPieza, setCodigoPieza] = useState("");
  const [especificacion, setEspecificacion] = useState("");
  const [medida, setMedida] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [repuesto, setRepuesto] = useState("");
  const [soloConStockEnSucursal, setSoloConStockEnSucursal] = useState(true);
  const [perPage, setPerPage] = useState(String(CATALOGO_FILAS_DEFAULT));

  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogBuscado, setCatalogBuscado] = useState(false);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [catalogRows, setCatalogRows] = useState<ProductoCatalogoRowConStock[]>([]);
  const [catalogoExpandido, setCatalogoExpandido] = useState(true);

  const [codigoBuscar, setCodigoBuscar] = useState("");
  const [buscandoCodigo, setBuscandoCodigo] = useState(false);

  const [lineas, setLineas] = useState<BajaLineaRow[]>([]);
  const [stockRows, setStockRows] = useState<ProductoRow[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const sucursalNum = Number(sucursalId);
  const idsEnCarrito = useMemo(() => new Set(lineas.map((l) => l.productoId)), [lineas]);

  function onCatalogoTextFilterChange(name: CatalogoTextFilterName, value: string) {
    const next = applyCatalogoTextFilterChange(name, value, {
      q,
      codigo,
      codigo_pieza: codigoPieza,
      especificacion,
      medida,
      descripcion,
      repuesto,
    });
    setQ(next.q);
    setCodigo(next.codigo);
    setCodigoPieza(next.codigo_pieza);
    setEspecificacion(next.especificacion);
    setMedida(next.medida);
    setDescripcion(next.descripcion);
    setRepuesto(next.repuesto);
  }

  const puedeEnviar = useMemo(
    () => Number.isFinite(sucursalNum) && sucursalNum > 0 && lineas.length > 0,
    [lineas.length, sucursalNum]
  );

  const stockEnSucursal = useCallback(
    (p: ProductoCatalogoRowConStock) => p.stocksPorSucursal.get(sucursalNum) ?? 0,
    [sucursalNum]
  );

  const agregarProducto = useCallback(
    (p: ProductoCatalogoRowConStock) => {
      const stock = stockEnSucursal(p);
      if (stock < 1) {
        setErr(`${p.codigo}: sin stock en esta sucursal.`);
        return;
      }
      setErr(null);
      setLineas((prev) => {
        const idx = prev.findIndex((l) => l.productoId === p.id);
        if (idx >= 0) {
          const copy = [...prev];
          const cur = parseQty(copy[idx].cantidad);
          const next = Math.min(stock, cur + 1);
          copy[idx] = {
            ...copy[idx],
            ...metadatosLineaDesdeProducto(p),
            stockSucursal: stock,
            cantidad: String(Math.max(1, next)),
          };
          return copy;
        }
        return [...prev, nuevaLineaDesdeProducto(p, stock)];
      });
    },
    [stockEnSucursal]
  );

  const recargarTablaStock = useCallback(
    async (opts?: { silencioso?: boolean }) => {
      if (!Number.isFinite(sucursalNum) || sucursalNum < 1) {
        setStockRows([]);
        return;
      }
      setStockLoading(true);
      if (!opts?.silencioso) setErr(null);
      try {
        const res = await fetch(
          `/api/admin/bajas-inventario?sucursal=${sucursalNum}&limit=${STOCK_REFERENCIA_LIMIT}`,
          { cache: "no-store" }
        );
        const data = (await res.json()) as { productos?: ProductoRow[]; error?: string };
        if (!res.ok) throw new Error(data.error || "No se pudo cargar stock.");
        setStockRows(data.productos ?? []);
      } catch (e) {
        setStockRows([]);
        if (!opts?.silencioso) {
          setErr(e instanceof Error ? e.message : "No se pudo cargar stock.");
        }
      } finally {
        setStockLoading(false);
      }
    },
    [sucursalNum]
  );

  const ejecutarBusquedaCatalogo = useCallback(async () => {
    if (!Number.isFinite(sucursalNum) || sucursalNum < 1) {
      setErr("Elegí sucursal antes de buscar.");
      return;
    }
    setErr(null);
    setCatalogLoading(true);
    try {
      const per = Math.trunc(Number(perPage));
      const res = await fetch("/api/admin/bajas-inventario/catalogo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sucursalId: sucursalNum,
          soloConStockEnSucursal,
          q,
          codigo,
          codigo_pieza: codigoPieza,
          especificacion,
          medida,
          descripcion,
          repuesto,
          perPage: Number.isFinite(per) && per >= 10 ? per : CATALOGO_FILAS_DEFAULT,
        }),
      });
      const data = (await res.json()) as {
        total?: number;
        rows?: CatalogoRowJson[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "No se pudo buscar en el catálogo.");
      setCatalogTotal(Number(data.total ?? 0));
      setCatalogRows((data.rows ?? []).map(hydrateCatalogoRow));
    } catch (e) {
      setCatalogRows([]);
      setCatalogTotal(0);
      setErr(e instanceof Error ? e.message : "Error al buscar en catálogo.");
    } finally {
      setCatalogBuscado(true);
      setCatalogLoading(false);
    }
  }, [
    codigo,
    codigoPieza,
    descripcion,
    especificacion,
    medida,
    perPage,
    q,
    repuesto,
    soloConStockEnSucursal,
    sucursalNum,
  ]);

  const onCatalogFilterKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "Enter") return;
      const el = e.target;
      if (!(el instanceof HTMLInputElement) || el.type === "checkbox") return;
      e.preventDefault();
      e.stopPropagation();
      if (catalogLoading || !sucursalId) return;
      void ejecutarBusquedaCatalogo();
    },
    [catalogLoading, ejecutarBusquedaCatalogo, sucursalId]
  );

  useEffect(() => {
    setLineas([]);
    setCatalogBuscado(false);
    setCatalogRows([]);
    setCatalogTotal(0);
    void recargarTablaStock({ silencioso: true });
  }, [sucursalNum, recargarTablaStock]);

  useEffect(() => {
    if (catalogBuscado && Number.isFinite(sucursalNum) && sucursalNum > 0) {
      void ejecutarBusquedaCatalogo();
    }
    // Solo al cambiar filtro de stock en sucursal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soloConStockEnSucursal]);

  async function buscarPorCodigo() {
    const raw = codigoBuscar.trim();
    if (!raw) return;
    if (!Number.isFinite(sucursalNum) || sucursalNum < 1) {
      setErr("Elegí sucursal.");
      return;
    }
    setBuscandoCodigo(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/bajas-inventario/catalogo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sucursalId: sucursalNum,
          soloConStockEnSucursal: false,
          codigo: raw,
          perPage: 20,
        }),
      });
      const data = (await res.json()) as { rows?: CatalogoRowJson[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "No se encontró el producto.");
      const rows = (data.rows ?? []).map(hydrateCatalogoRow);
      if (rows.length === 0) {
        setErr(`No hay producto activo con código «${raw}».`);
        return;
      }
      const exacto =
        rows.find((r) => r.codigo.trim() === raw || r.qr_payload?.trim() === raw) ?? rows[0];
      agregarProducto(exacto);
      setCodigoBuscar("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al buscar por código.");
    } finally {
      setBuscandoCodigo(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);

    if (!Number.isFinite(sucursalNum) || sucursalNum < 1) {
      setErr("Elegí sucursal.");
      return;
    }

    const payloadLineas: { productoId: number; cantidad: number }[] = [];
    for (const ln of lineas) {
      const cant = parseQty(ln.cantidad);
      if (cant < 1) {
        setErr(`Cantidad inválida para ${ln.codigo}.`);
        return;
      }
      if (cant > ln.stockSucursal) {
        setErr(`La cantidad supera el stock disponible para ${ln.codigo} (máx. ${ln.stockSucursal}).`);
        return;
      }
      payloadLineas.push({ productoId: ln.productoId, cantidad: cant });
    }

    if (payloadLineas.length === 0) {
      setErr("Agregá al menos un producto.");
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/admin/bajas-inventario", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sucursalId: sucursalNum,
          nota: nota.trim() || null,
          lineas: payloadLineas,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; referenciaId?: number; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "No se pudo registrar la baja.");
      }
      setOk(
        `Baja registrada. Referencia #${data.referenciaId}. El stock y los lotes (FIFO) ya fueron descontados.`
      );
      setNota("");
      setLineas([]);
      setCatalogBuscado(false);
      setCatalogRows([]);
      setCatalogTotal(0);
      await recargarTablaStock({ silencioso: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo registrar la baja.");
    } finally {
      setPending(false);
    }
  }

  const ctrlInp =
    "w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white disabled:opacity-50";

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/40">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-black/25 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2.5">Sucursal</th>
              <th className="min-w-[240px] px-3 py-2.5">Motivo / nota (opcional)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="align-top hover:bg-white/[0.02]">
              <td className="border-b border-white/5 px-3 py-2.5">
                <select
                  className={ctrlInp}
                  value={sucursalId}
                  onChange={(e) => setSucursalId(e.target.value)}
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
                  placeholder="Ej: rotura, vencimiento, inventario físico"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-4">
        <h3 className="text-sm font-semibold text-white">Agregar con código o QR</h3>
        <p className="mt-1 text-xs text-slate-500">
          Misma búsqueda exacta que en traspasos. Enter o el botón agrega (solo con stock en la sucursal).
        </p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <div className="relative min-w-0 flex-1">
            <ScanLine
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-rose-400/70"
              aria-hidden
            />
            <input
              className={`${ctrlInp} pl-9`}
              value={codigoBuscar}
              onChange={(e) => setCodigoBuscar(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                  void buscarPorCodigo();
                }
              }}
              placeholder="Código interno o QR…"
              disabled={pending || !sucursalId}
            />
          </div>
          <button
            type="button"
            disabled={pending || buscandoCodigo || !codigoBuscar.trim() || !sucursalId}
            onClick={() => void buscarPorCodigo()}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
          >
            {buscandoCodigo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Agregar
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <button
          type="button"
          onClick={() => setCatalogoExpandido((v) => !v)}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-left hover:border-rose-500/30"
        >
          <div>
            <p className="text-sm font-semibold text-white">Catálogo de productos</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Misma tabla que en Admin → Productos; la columna de la sucursal queda resaltada.
            </p>
          </div>
          {catalogoExpandido ? (
            <ChevronUp className="h-5 w-5 text-slate-500" />
          ) : (
            <ChevronDown className="h-5 w-5 text-slate-500" />
          )}
        </button>

        {catalogoExpandido ? (
          <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
            <p className="text-xs text-slate-500">En cualquier filtro de abajo, Enter ejecuta la búsqueda en catálogo.</p>
            <div
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5"
              onKeyDown={onCatalogFilterKeyDown}
            >
              <div className="max-w-full sm:max-w-md lg:col-span-2">
                <label className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                  Buscar (todo)
                </label>
                <input
                  value={q}
                  onChange={(e) => onCatalogoTextFilterChange("q", e.target.value)}
                  placeholder="QR, código pieza, nombre…"
                  className={`${inpBuscarTodo} mt-1`}
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Código</label>
                <input
                  value={codigo}
                  onChange={(e) => onCatalogoTextFilterChange("codigo", e.target.value)}
                  className={`${inp} mt-1 font-mono`}
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Cód. pieza</label>
                <input
                  value={codigoPieza}
                  onChange={(e) => onCatalogoTextFilterChange("codigo_pieza", e.target.value)}
                  className={`${inp} mt-1`}
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Especificación</label>
                <input
                  value={especificacion}
                  onChange={(e) => onCatalogoTextFilterChange("especificacion", e.target.value)}
                  className={`${inp} mt-1`}
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Medida</label>
                <input
                  value={medida}
                  onChange={(e) => onCatalogoTextFilterChange("medida", e.target.value)}
                  className={`${inp} mt-1`}
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Descripción</label>
                <input
                  value={descripcion}
                  onChange={(e) => onCatalogoTextFilterChange("descripcion", e.target.value)}
                  className={`${inp} mt-1`}
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Repuesto</label>
                <input
                  value={repuesto}
                  onChange={(e) => onCatalogoTextFilterChange("repuesto", e.target.value)}
                  className={`${inp} mt-1`}
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Máx. filas</label>
                <input
                  value={perPage}
                  onChange={(e) => setPerPage(e.target.value)}
                  inputMode="numeric"
                  className={`${inp} mt-1 font-mono`}
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400">
              <input
                type="checkbox"
                checked={soloConStockEnSucursal}
                onChange={(e) => setSoloConStockEnSucursal(e.target.checked)}
                className="rounded border-white/20"
              />
              Solo productos con stock en esta sucursal
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={catalogLoading || !sucursalId}
                onClick={() => void ejecutarBusquedaCatalogo()}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
              >
                {catalogLoading ? "Buscando…" : "Buscar en catálogo"}
              </button>
              <button
                type="button"
                className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
                onClick={() => {
                  setQ("");
                  setCodigo("");
                  setCodigoPieza("");
                  setEspecificacion("");
                  setMedida("");
                  setDescripcion("");
                  setRepuesto("");
                  setSoloConStockEnSucursal(true);
                  setPerPage(String(CATALOGO_FILAS_DEFAULT));
                }}
              >
                Limpiar filtros
              </button>
            </div>

            <p className="text-xs text-slate-500">
              {catalogLoading
                ? "Consultando…"
                : !catalogBuscado
                  ? "Elegí sucursal, filtros y pulsá «Buscar en catálogo»."
                  : catalogTotal === 0
                    ? "Sin resultados con estos criterios."
                    : `Mostrando ${catalogRows.length} de ${catalogTotal} producto(s).`}
            </p>

            {catalogLoading && catalogRows.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
                <Loader2 className="h-6 w-6 animate-spin text-rose-500" />
                Cargando catálogo…
              </div>
            ) : catalogBuscado ? (
              <ProductosCatalogoTabla
                rows={catalogRows}
                sucursales={sucursales}
                modoAccion="agregar"
                mostrarPrecioCompra={false}
                sucursalReferenciaId={sucursalNum > 0 ? sucursalNum : null}
                onAgregar={agregarProducto}
                idsEnCarrito={idsEnCarrito}
              />
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
        <h3 className="text-sm font-semibold text-white">Líneas de la baja</h3>
        <p className="text-xs text-slate-500">
          Ajustá cantidades; «Restante» no puede quedar negativo (no supera el stock en sucursal).
        </p>
        <BajaLineasTabla
          lineas={lineas}
          onCantidadChange={(key, value) =>
            setLineas((prev) => prev.map((l) => (l.key === key ? { ...l, cantidad: value } : l)))
          }
          onCantidadBlur={(key) =>
            setLineas((prev) =>
              prev.map((l) =>
                l.key === key ? { ...l, cantidad: snapCantidadBaja(l.cantidad, l.stockSucursal) } : l
              )
            )
          }
          onRemove={(key) => setLineas((prev) => prev.filter((l) => l.key !== key))}
        />
      </section>

      <div className="space-y-3">
        {err ? (
          <p className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">{err}</p>
        ) : null}
        {ok ? (
          <p className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200">
            {ok}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending || !puedeEnviar}
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Registrando…" : "Confirmar baja de inventario"}
        </button>
      </div>

      <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-4">
        <h3 className="text-sm font-semibold text-white">Stock con saldo en esta sucursal</h3>
        <p className="mt-1 text-xs text-slate-500">
          Muestra hasta {STOCK_REFERENCIA_LIMIT} productos como referencia rápida (se actualiza al confirmar una baja).
        </p>
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
              {stockLoading ? (
                <tr>
                  <td className="px-3 py-4 text-slate-500" colSpan={3}>
                    Cargando stock…
                  </td>
                </tr>
              ) : stockRows.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-slate-500" colSpan={3}>
                    Sin stock disponible o elegí sucursal.
                  </td>
                </tr>
              ) : (
                stockRows.map((r) => (
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
      </section>
    </form>
  );
}

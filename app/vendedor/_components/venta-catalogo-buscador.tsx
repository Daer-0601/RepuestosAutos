"use client";

import { VentaCatalogoTabla } from "@/app/vendedor/ventas/nueva/_components/venta-catalogo-tabla";
import { CATALOGO_FILAS_DEFAULT } from "@/lib/catalogo-productos-constants";
import {
  applyCatalogoTextFilterChange,
  type CatalogoTextFilterName,
} from "@/lib/catalogo-filtros-texto";
import type { ModoCatalogoVenta, VentaCatalogoApiRow } from "@/lib/types/venta-vendedor-catalogo";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

const inp =
  "w-full min-w-0 rounded border border-white/10 bg-slate-950/80 px-2 py-1.5 text-xs text-white outline-none placeholder:text-slate-600 focus:border-amber-500/40";

export function VentaCatalogoBuscador({
  miSucursalId,
  onAgregar,
  permitirSinStock = false,
  collapsible = false,
  defaultExpanded = true,
  descripcionStock,
}: {
  miSucursalId: number;
  /** Si se omite, la tabla es solo consulta (sin columna Agregar). */
  onAgregar?: (row: VentaCatalogoApiRow) => void;
  permitirSinStock?: boolean;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  descripcionStock?: string;
}) {
  const [q, setQ] = useState("");
  const [codigo, setCodigo] = useState("");
  const [codigoPieza, setCodigoPieza] = useState("");
  const [especificacion, setEspecificacion] = useState("");
  const [medida, setMedida] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [repuesto, setRepuesto] = useState("");
  const [modoCatalogo, setModoCatalogo] = useState<ModoCatalogoVenta>("mi_sucursal");
  const [perPage, setPerPage] = useState(String(CATALOGO_FILAS_DEFAULT));

  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogBuscado, setCatalogBuscado] = useState(false);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [catalogSucursales, setCatalogSucursales] = useState<{ id: number; nombre: string }[]>([]);
  const [catalogRows, setCatalogRows] = useState<VentaCatalogoApiRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandido, setExpandido] = useState(defaultExpanded);

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

  async function ejecutarBusquedaCatalogo() {
    if (!miSucursalId) return;
    setError(null);
    setCatalogLoading(true);
    try {
      const per = Math.trunc(Number(perPage));
      const res = await fetch("/api/vendedor/productos/catalogo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q,
          codigo,
          codigo_pieza: codigoPieza,
          especificacion,
          medida,
          descripcion,
          repuesto,
          modo: modoCatalogo,
          perPage: Number.isFinite(per) && per >= 10 ? per : CATALOGO_FILAS_DEFAULT,
        }),
      });
      const data = (await res.json()) as {
        total?: number;
        sucursales?: { id: number; nombre: string }[];
        rows?: VentaCatalogoApiRow[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "No se pudo buscar en el catálogo.");
        setCatalogRows([]);
        setCatalogTotal(0);
        return;
      }
      setCatalogTotal(Number(data.total ?? 0));
      setCatalogSucursales(Array.isArray(data.sucursales) ? data.sucursales : []);
      setCatalogRows(Array.isArray(data.rows) ? data.rows : []);
    } catch {
      setError("Error de red en la búsqueda del catálogo.");
      setCatalogRows([]);
    } finally {
      setCatalogBuscado(true);
      setCatalogLoading(false);
    }
  }

  function limpiarFiltros() {
    setQ("");
    setCodigo("");
    setCodigoPieza("");
    setEspecificacion("");
    setMedida("");
    setDescripcion("");
    setRepuesto("");
    setModoCatalogo("mi_sucursal");
    setPerPage(String(CATALOGO_FILAS_DEFAULT));
    setError(null);
  }

  const stockHint =
    descripcionStock ??
    (permitirSinStock
      ? "Stock por sucursal (solo referencia; no limita agregar líneas)."
      : onAgregar
        ? "Stock por sucursal; podés agregar al carrito solo si tu depósito tiene existencia."
        : "Stock por sucursal; tu depósito va resaltado. Solo consulta.");

  const contenido = (
    <div className="space-y-4">
      <form
        className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 sm:p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (catalogLoading) return;
          void ejecutarBusquedaCatalogo();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Texto</label>
            <input
              name="q"
              value={q}
              onChange={(e) => onCatalogoTextFilterChange("q", e.target.value)}
              placeholder="Palabras en código, nombre, descripción…"
              className={`${inp} mt-1`}
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Código exacto
            </label>
            <input
              value={codigo}
              onChange={(e) => onCatalogoTextFilterChange("codigo", e.target.value)}
              placeholder="Ej. 1000"
              className={`${inp} mt-1 font-mono`}
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Cód. pieza</label>
            <input
              value={codigoPieza}
              onChange={(e) => onCatalogoTextFilterChange("codigo_pieza", e.target.value)}
              placeholder="OEM / referencia"
              className={`${inp} mt-1`}
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Especificación
            </label>
            <input
              value={especificacion}
              onChange={(e) => onCatalogoTextFilterChange("especificacion", e.target.value)}
              className={`${inp} mt-1`}
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Medida</label>
            <input
              value={medida}
              onChange={(e) => onCatalogoTextFilterChange("medida", e.target.value)}
              className={`${inp} mt-1`}
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Descripción</label>
            <input
              value={descripcion}
              onChange={(e) => onCatalogoTextFilterChange("descripcion", e.target.value)}
              className={`${inp} mt-1`}
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Repuesto</label>
            <input
              value={repuesto}
              onChange={(e) => onCatalogoTextFilterChange("repuesto", e.target.value)}
              className={`${inp} mt-1`}
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Qué stock ver</label>
            <select
              value={modoCatalogo}
              onChange={(e) => setModoCatalogo(e.target.value as ModoCatalogoVenta)}
              className={`${inp} mt-1`}
            >
              <option value="mi_sucursal">Solo lo vendible en mi sucursal</option>
              <option value="referencia">Referencia: con stock en alguna sucursal</option>
              <option value="todos">Todos los activos</option>
            </select>
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
        <div className="mt-4 flex flex-wrap gap-2 border-t border-white/5 pt-4">
          <button
            type="submit"
            disabled={catalogLoading}
            className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-40"
          >
            {catalogLoading ? "Buscando…" : "Buscar en catálogo"}
          </button>
          <button
            type="button"
            className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
            onClick={limpiarFiltros}
          >
            Limpiar filtros
          </button>
        </div>
      </form>

      {error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-950/40 px-4 py-2 text-sm text-rose-100" role="alert">
          {error}
        </p>
      ) : null}

      <p className="text-xs text-slate-500">
        {catalogLoading
          ? "Consultando…"
          : !catalogBuscado
            ? "Elegí filtros y pulsá «Buscar en catálogo»."
            : catalogTotal === 0
              ? "Sin resultados. Probá otro criterio o modo de stock."
              : `Mostrando ${catalogRows.length} de ${catalogTotal} producto(s). Tu sucursal va resaltada.`}
      </p>

      <VentaCatalogoTabla
        miSucursalId={miSucursalId}
        sucursales={catalogSucursales}
        rows={catalogRows}
        loading={catalogLoading}
        sinConsulta={!catalogBuscado}
        onAgregar={onAgregar}
        permitirSinStock={permitirSinStock}
      />
    </div>
  );

  if (!collapsible) {
    return contenido;
  }

  return (
    <section className="space-y-3">
      <button
        type="button"
        onClick={() => setExpandido((v) => !v)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-left transition hover:border-amber-500/30 hover:bg-slate-900/60"
      >
        <div>
          <p className="text-sm font-semibold text-white">Buscador de repuestos</p>
          <p className="mt-0.5 text-xs text-slate-500">{stockHint}</p>
        </div>
        {expandido ? (
          <ChevronUp className="h-5 w-5 shrink-0 text-slate-500" />
        ) : (
          <ChevronDown className="h-5 w-5 shrink-0 text-slate-500" />
        )}
      </button>
      {expandido ? contenido : null}
    </section>
  );
}

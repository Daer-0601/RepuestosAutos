"use client";

import { formatoMostrarFechaHoraBo } from "@/lib/fecha-bolivia";
import { rangoPrecioListaTopeBs } from "@/lib/venta-precio-lista-tope-range";
import { FileText, Loader2, Plus, Save, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const inp =
  "w-full min-w-0 rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50";
const inpNum = `${inp} font-mono`;

/** Mismo estilo que admin / pedidos (búsqueda de catálogo). */
const inpCatalogoBuscar =
  "w-full min-w-0 rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50";

type ProductoCatalogoCot = {
  id: number;
  codigo: string;
  codigo_pieza: string | null;
  nombre: string;
  medida: string | null;
  marca_auto: string | null;
  especificacion: string | null;
  repuesto: string | null;
  precio_venta_lista_bs: string | null;
  precio_venta_lista_usd: string | null;
  punto_tope: string | null;
  stock_total: number;
};

type LineaCot = {
  key: string;
  productoId: number;
  codigo: string;
  nombre: string;
  cantidad: string;
  precioUnitBs: string;
  precioListaBs: number | null;
  puntoTope: number | null;
};

type CotResumen = {
  id: number;
  fecha: string;
  total_bs: string;
  total_usd: string;
  cliente_nombre: string | null;
  lineas: number;
};

function nuevaLinea(p: ProductoCatalogoCot): LineaCot {
  const lista = p.precio_venta_lista_bs != null && p.precio_venta_lista_bs !== "" ? Number(p.precio_venta_lista_bs) : null;
  const tope = p.punto_tope != null && p.punto_tope !== "" ? Number(p.punto_tope) : null;
  const precioIni =
    lista !== null && Number.isFinite(lista) && lista > 0 ? String(Math.round(lista * 100) / 100) : "";
  return {
    key: typeof crypto !== "undefined" ? crypto.randomUUID() : String(Math.random()),
    productoId: p.id,
    codigo: p.codigo,
    nombre: p.nombre,
    cantidad: "1",
    precioUnitBs: precioIni,
    precioListaBs: lista !== null && Number.isFinite(lista) && lista > 0 ? lista : null,
    puntoTope: tope !== null && Number.isFinite(tope) && tope > 0 ? tope : null,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function parseQty(s: string): number {
  const n = Math.trunc(Number(s.replace(",", ".")));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function parsePrecio(s: string, lista: number | null): number | null {
  const t = s.trim();
  if (!t) {
    return lista !== null && lista > 0 ? round2(lista) : null;
  }
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? round2(n) : null;
}

function subtotalLineaBs(ln: LineaCot): number | null {
  const q = parseQty(ln.cantidad);
  if (q < 1) return null;
  const p = parsePrecio(ln.precioUnitBs, ln.precioListaBs);
  if (p === null) return null;
  return round2(q * p);
}

const PER_PAGE = 50;

export function CotizacionesPanel() {
  const [tipoCambio, setTipoCambio] = useState<{ id: number; valor_bs_por_usd: number } | null>(null);
  const [historial, setHistorial] = useState<CotResumen[]>([]);
  const [sucursalNombre, setSucursalNombre] = useState("");
  const [ctxLoading, setCtxLoading] = useState(true);

  const [vista, setVista] = useState<"paginado" | "busqueda">("paginado");
  const [page, setPage] = useState(1);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [filasCatalogo, setFilasCatalogo] = useState<ProductoCatalogoCot[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const [busquedaCodigo, setBusquedaCodigo] = useState("");
  const [busquedaGeneral, setBusquedaGeneral] = useState("");
  const [buscando, setBuscando] = useState(false);

  const [lineas, setLineas] = useState<LineaCot[]>([]);
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteNit, setClienteNit] = useState("");
  const [notas, setNotas] = useState("");

  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  /** Evita que una respuesta tardía del listado paginado pise resultados de búsqueda (u otra petición). */
  const catalogoReqSeqRef = useRef(0);

  const loadContext = useCallback(async () => {
    setCtxLoading(true);
    try {
      const res = await fetch("/api/vendedor/cotizaciones", { cache: "no-store" });
      const data = (await res.json()) as {
        tipoCambio?: { id: number; valor_bs_por_usd: number } | null;
        cotizaciones?: CotResumen[];
        sucursalNombre?: string;
        error?: string;
      };
      if (!res.ok) {
        setMsg({ type: "err", text: data.error ?? "No se pudo cargar el contexto." });
        return;
      }
      setTipoCambio(data.tipoCambio ?? null);
      setHistorial(data.cotizaciones ?? []);
      setSucursalNombre(data.sucursalNombre?.trim() ?? "");
    } catch {
      setMsg({ type: "err", text: "Error de red al cargar cotizaciones." });
    } finally {
      setCtxLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const cargarPagina = useCallback(async (p: number) => {
    const seq = ++catalogoReqSeqRef.current;
    setCatalogLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/vendedor/cotizaciones/catalogo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ listarActivos: true, page: p, perPage: PER_PAGE }),
      });
      const data = (await res.json()) as {
        productos?: ProductoCatalogoCot[];
        total?: number;
        page?: number;
        error?: string;
      };
      if (seq !== catalogoReqSeqRef.current) return;
      if (!res.ok) {
        setFilasCatalogo([]);
        setMsg({ type: "err", text: data.error ?? "No se pudo cargar el catálogo." });
        return;
      }
      setFilasCatalogo(data.productos ?? []);
      setCatalogTotal(Number(data.total ?? 0));
      setPage(Number(data.page ?? p));
    } catch {
      if (seq !== catalogoReqSeqRef.current) return;
      setFilasCatalogo([]);
      setMsg({ type: "err", text: "Error de red al cargar productos." });
    } finally {
      if (seq === catalogoReqSeqRef.current) {
        setCatalogLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (vista === "paginado") {
      void cargarPagina(page);
    }
  }, [vista, page, cargarPagina]);

  const buscarPorCodigo = useCallback(async () => {
    const t = busquedaCodigo.trim();
    if (!t) {
      catalogoReqSeqRef.current += 1;
      setBuscando(false);
      setCatalogLoading(false);
      setFilasCatalogo([]);
      setCatalogTotal(0);
      setVista("paginado");
      setPage(1);
      return;
    }
    const seq = ++catalogoReqSeqRef.current;
    setCatalogLoading(false);
    setBuscando(true);
    setFilasCatalogo([]);
    setMsg(null);
    setVista("busqueda");
    try {
      const res = await fetch("/api/vendedor/cotizaciones/catalogo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ codigo: t, perPage: 80 }),
      });
      const data = (await res.json()) as {
        productos?: ProductoCatalogoCot[];
        total?: number;
        error?: string;
      };
      if (seq !== catalogoReqSeqRef.current) return;
      if (!res.ok) {
        setFilasCatalogo([]);
        setMsg({ type: "err", text: data.error ?? "Búsqueda fallida." });
        return;
      }
      const rows = (data.productos ?? []) as ProductoCatalogoCot[];
      setFilasCatalogo(rows);
      setCatalogTotal(rows.length > 0 ? Number(data.total ?? rows.length) : 0);
    } catch {
      if (seq !== catalogoReqSeqRef.current) return;
      setFilasCatalogo([]);
      setMsg({ type: "err", text: "Error de red en la búsqueda." });
    } finally {
      if (seq === catalogoReqSeqRef.current) {
        setBuscando(false);
      }
    }
  }, [busquedaCodigo]);

  const buscarPorGeneral = useCallback(async () => {
    const t = busquedaGeneral.trim();
    if (!t) {
      catalogoReqSeqRef.current += 1;
      setBuscando(false);
      setCatalogLoading(false);
      setFilasCatalogo([]);
      setCatalogTotal(0);
      setVista("paginado");
      setPage(1);
      return;
    }
    const seq = ++catalogoReqSeqRef.current;
    setCatalogLoading(false);
    setBuscando(true);
    setFilasCatalogo([]);
    setMsg(null);
    setVista("busqueda");
    try {
      const res = await fetch("/api/vendedor/cotizaciones/catalogo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ q: t, perPage: 80 }),
      });
      const data = (await res.json()) as {
        productos?: ProductoCatalogoCot[];
        total?: number;
        error?: string;
      };
      if (seq !== catalogoReqSeqRef.current) return;
      if (!res.ok) {
        setFilasCatalogo([]);
        setMsg({ type: "err", text: data.error ?? "Búsqueda fallida." });
        return;
      }
      const rows = (data.productos ?? []) as ProductoCatalogoCot[];
      setFilasCatalogo(rows);
      setCatalogTotal(rows.length > 0 ? Number(data.total ?? rows.length) : 0);
    } catch {
      if (seq !== catalogoReqSeqRef.current) return;
      setFilasCatalogo([]);
      setMsg({ type: "err", text: "Error de red en la búsqueda." });
    } finally {
      if (seq === catalogoReqSeqRef.current) {
        setBuscando(false);
      }
    }
  }, [busquedaGeneral]);

  function agregarProducto(p: ProductoCatalogoCot) {
    let agregado = false;
    setLineas((prev) => {
      if (prev.some((x) => x.productoId === p.id)) return prev;
      agregado = true;
      return [...prev, nuevaLinea(p)];
    });
    if (vista === "busqueda" && agregado) {
      setBusquedaCodigo("");
      setBusquedaGeneral("");
      setFilasCatalogo([]);
      setCatalogTotal(0);
    }
  }

  const totales = useMemo(() => {
    let bs = 0;
    for (const ln of lineas) {
      const st = subtotalLineaBs(ln);
      if (st !== null) bs = round2(bs + st);
    }
    const tc = tipoCambio?.valor_bs_por_usd ?? 0;
    const usd = tc > 0 ? Math.round((bs / tc) * 1e4) / 1e4 : 0;
    return { bs, usd, tc };
  }, [lineas, tipoCambio]);

  const totalPaginas = Math.max(1, Math.ceil(catalogTotal / PER_PAGE));

  async function guardarCotizacion() {
    setMsg(null);
    if (!tipoCambio) {
      setMsg({ type: "err", text: "No hay tipo de cambio: no se puede cotizar." });
      return;
    }
    if (lineas.length === 0) {
      setMsg({ type: "err", text: "Agregá al menos un producto a la cotización." });
      return;
    }
    const payloadLineas = [];
    for (const ln of lineas) {
      const q = parseQty(ln.cantidad);
      if (q < 1) {
        setMsg({ type: "err", text: `Cantidad inválida para ${ln.codigo}.` });
        return;
      }
      const p = parsePrecio(ln.precioUnitBs, ln.precioListaBs);
      if (p === null) {
        setMsg({ type: "err", text: `Definí precio en Bs para ${ln.codigo}.` });
        return;
      }
      const rango = rangoPrecioListaTopeBs(ln.precioListaBs, ln.puntoTope);
      if (rango && (p < rango.lo || p > rango.hi)) {
        setMsg({
          type: "err",
          text: `${ln.codigo}: el precio debe estar entre ${rango.lo.toFixed(2)} y ${rango.hi.toFixed(2)} Bs.`,
        });
        return;
      }
      if (!rango && ln.puntoTope !== null && p > ln.puntoTope) {
        setMsg({ type: "err", text: `${ln.codigo}: el precio supera el tope (${ln.puntoTope.toFixed(2)} Bs).` });
        return;
      }
      payloadLineas.push({ productoId: ln.productoId, cantidad: q, precioUnitarioBs: p });
    }

    setGuardando(true);
    try {
      const res = await fetch("/api/vendedor/cotizaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          tipoCambioId: tipoCambio.id,
          tipoCambioSnapshot: tipoCambio.valor_bs_por_usd,
          clienteNombre: clienteNombre.trim() || null,
          clienteNit: clienteNit.trim() || null,
          notas: notas.trim() || null,
          lineas: payloadLineas,
        }),
      });
      const data = (await res.json()) as { cotizacionId?: number; error?: string };
      if (!res.ok) {
        setMsg({ type: "err", text: data.error ?? "No se pudo guardar." });
        return;
      }
      setMsg({ type: "ok", text: `Cotización #${data.cotizacionId} guardada.` });
      setLineas([]);
      setClienteNombre("");
      setClienteNit("");
      setNotas("");
      void loadContext();
    } catch {
      setMsg({ type: "err", text: "Error de red al guardar." });
    } finally {
      setGuardando(false);
    }
  }

  if (ctxLoading) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-slate-900/50 py-16 text-slate-400">
        <Loader2 className="h-7 w-7 animate-spin text-amber-400" />
        <span className="text-sm">Cargando…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {msg ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            msg.type === "ok"
              ? "border-emerald-500/35 bg-emerald-950/25 text-emerald-100"
              : "border-rose-500/35 bg-rose-950/30 text-rose-100"
          }`}
          role="status"
        >
          {msg.text}
        </div>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Tipo de cambio (referencia)</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Los importes en USD de la cotización usan este valor al momento de guardar.
            </p>
          </div>
          {tipoCambio ? (
            <p className="font-mono text-lg font-semibold tabular-nums text-amber-100">
              {tipoCambio.valor_bs_por_usd.toFixed(4)} <span className="text-xs font-normal text-slate-500">Bs/USD</span>
            </p>
          ) : (
            <p className="text-sm text-amber-200/90">No hay tipo de cambio cargado.</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
        <h2 className="text-sm font-semibold text-white">Buscar producto</h2>
        <p className="mt-1 text-xs text-slate-500">
          <span className="font-medium text-slate-400">Código de barra / QR:</span> solo el{" "}
          <span className="text-slate-300">código interno</span> de la etiqueta o el{" "}
          <span className="text-slate-300">texto del QR</span> (coincidencia exacta, pensado para lector).{" "}
          <span className="font-medium text-slate-400">Texto (todo):</span> ahí va código pieza, nombre, descripción y
          el resto del catálogo amplio.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          También podés recorrer <span className="text-slate-300">todos los productos activos</span> por páginas (abajo)
          sin usar los buscadores.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Código de barra o QR (lector)
            </label>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <input
                value={busquedaCodigo}
                onChange={(e) => setBusquedaCodigo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void buscarPorCodigo();
                  }
                }}
                className={`${inpCatalogoBuscar} font-mono sm:min-w-0 sm:flex-1`}
                placeholder="Escaneá o pegá código interno o QR"
              />
              <button
                type="button"
                onClick={() => void buscarPorCodigo()}
                disabled={buscando || !busquedaCodigo.trim()}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {buscando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Search className="h-4 w-4" aria-hidden />}
                {buscando ? "Buscando…" : "Buscar"}
              </button>
            </div>
          </div>
          <div className="min-w-0">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Texto (todo)</label>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <input
                value={busquedaGeneral}
                onChange={(e) => setBusquedaGeneral(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void buscarPorGeneral();
                  }
                }}
                className={`${inpCatalogoBuscar} sm:min-w-0 sm:flex-1`}
                placeholder="Palabras en código, nombre, descripción…"
              />
              <button
                type="button"
                onClick={() => void buscarPorGeneral()}
                disabled={buscando || !busquedaGeneral.trim()}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {buscando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Search className="h-4 w-4" aria-hidden />}
                {buscando ? "Buscando…" : "Buscar"}
              </button>
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              catalogoReqSeqRef.current += 1;
              setBuscando(false);
              setCatalogLoading(false);
              setBusquedaCodigo("");
              setBusquedaGeneral("");
              setFilasCatalogo([]);
              setCatalogTotal(0);
              setVista("paginado");
              setPage(1);
            }}
            className="rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-300 hover:bg-white/5"
          >
            Limpiar búsquedas
          </button>
        </div>

        {vista === "paginado" ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>
              Catálogo activo: página {page} de {totalPaginas} · {catalogTotal} producto(s)
            </span>
            <button
              type="button"
              disabled={page <= 1 || catalogLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded border border-white/10 px-2 py-1 text-slate-200 hover:bg-white/5 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={page >= totalPaginas || catalogLoading}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border border-white/10 px-2 py-1 text-slate-200 hover:bg-white/5 disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-500">
            Resultados de búsqueda: {catalogTotal} coincidencia(s). «Limpiar búsquedas» volvé al listado paginado.
          </p>
        )}

        {catalogLoading ? (
          <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-950/60 py-10 text-sm text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin text-sky-500" />
            Cargando productos…
          </div>
        ) : filasCatalogo.length > 0 ? (
          <ul className="mt-3 max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-slate-950/60 py-1 text-sm">
            {filasCatalogo.map((p) => {
              const yaEnCotizacion = lineas.some((l) => l.productoId === p.id);
              return (
                <li key={p.id} className="border-b border-white/5 last:border-0">
                  <button
                    type="button"
                    disabled={yaEnCotizacion}
                    onClick={() => agregarProducto(p)}
                    className={`flex w-full items-start gap-3 px-3 py-2.5 text-left ${
                      yaEnCotizacion
                        ? "cursor-not-allowed opacity-45"
                        : "hover:bg-sky-500/15"
                    }`}
                  >
                    <Plus className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="font-mono text-sky-300">{p.codigo}</span>
                      {p.codigo_pieza ? (
                        <span className="ml-2 font-mono text-xs text-slate-500">{p.codigo_pieza}</span>
                      ) : null}
                      <span className="mt-0.5 block text-slate-200">{p.nombre}</span>
                      <span className="mt-0.5 block text-[11px] text-slate-500">
                        Lista Bs {p.precio_venta_lista_bs ?? "—"} · Stock total {p.stock_total}
                        {yaEnCotizacion ? " · ya en la cotización" : null}
                      </span>
                      {p.marca_auto ? (
                        <span className="mt-0.5 block text-[11px] text-slate-500">Marca: {p.marca_auto}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : vista === "paginado" && !catalogLoading ? (
          <p className="mt-3 text-xs text-slate-500">No hay productos en esta página.</p>
        ) : vista === "busqueda" && !buscando && !catalogLoading ? (
          <p className="mt-3 text-xs text-slate-500">Sin coincidencias con ese criterio.</p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
        <h2 className="text-sm font-semibold text-white">Datos del cliente (opcional)</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Nombre / razón social</label>
            <input className={`${inp} mt-1`} value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">NIT</label>
            <input className={`${inp} mt-1 font-mono`} value={clienteNit} onChange={(e) => setClienteNit(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Notas</label>
            <textarea
              className={`${inp} mt-1 min-h-[72px] resize-y`}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Condiciones, validez, observaciones…"
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Líneas de la cotización</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Ajustá cantidades y precio unitario en Bs. Se valida contra el tope del producto si existe.
            </p>
          </div>
          <button
            type="button"
            disabled={guardando || !tipoCambio || lineas.length === 0}
            onClick={() => void guardarCotizacion()}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar cotización
          </button>
        </div>

        {lineas.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="border-b border-white/10 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2 pr-2">Código</th>
                  <th className="py-2 pr-2">Producto</th>
                  <th className="py-2 pr-2">Cant.</th>
                  <th className="py-2 pr-2">P. unit. Bs</th>
                  <th className="py-2 pr-2 text-right">Subtotal Bs</th>
                  <th className="w-10 py-2" />
                </tr>
              </thead>
              <tbody>
                {lineas.map((ln) => {
                  const sub = subtotalLineaBs(ln);
                  return (
                    <tr key={ln.key} className="border-b border-white/5">
                      <td className="py-2 pr-2 font-mono text-amber-200/90">{ln.codigo}</td>
                      <td className="max-w-[220px] py-2 pr-2 text-slate-200">
                        <span className="line-clamp-2">{ln.nombre}</span>
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          className={`${inpNum} w-16`}
                          value={ln.cantidad}
                          onChange={(e) =>
                            setLineas((prev) =>
                              prev.map((x) => (x.key === ln.key ? { ...x, cantidad: e.target.value } : x))
                            )
                          }
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          className={`${inpNum} w-28`}
                          value={ln.precioUnitBs}
                          onChange={(e) =>
                            setLineas((prev) =>
                              prev.map((x) => (x.key === ln.key ? { ...x, precioUnitBs: e.target.value } : x))
                            )
                          }
                        />
                      </td>
                      <td className="py-2 pr-2 text-right font-mono text-slate-200">
                        {sub !== null ? sub.toFixed(2) : "—"}
                      </td>
                      <td className="py-1">
                        <button
                          type="button"
                          onClick={() => setLineas((prev) => prev.filter((x) => x.key !== ln.key))}
                          className="rounded p-2 text-rose-400 hover:bg-rose-500/15"
                          aria-label="Quitar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">Todavía no hay líneas.</p>
        )}

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-t border-white/10 pt-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Total cotización</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-white">{totales.bs.toFixed(2)} Bs</p>
            {totales.tc > 0 ? (
              <p className="mt-1 font-mono text-sm text-slate-400">≈ {totales.usd.toFixed(4)} USD</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <FileText className="h-4 w-4 text-slate-400" />
          Últimas cotizaciones
        </h2>
        {sucursalNombre ? (
          <p className="mt-1 text-xs text-slate-500">Solo cotizaciones hechas desde vendedores de {sucursalNombre}.</p>
        ) : null}
        {historial.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">Todavía no hay cotizaciones en tu sucursal.</p>
        ) : (
          <ul className="mt-3 divide-y divide-white/10 text-sm">
            {historial.map((c) => (
              <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span className="font-mono text-slate-300">#{c.id}</span>
                <span className="text-slate-500">{new Date(c.fecha).toLocaleString("es-BO", formatoMostrarFechaHoraBo)}</span>
                <span className="min-w-0 flex-1 truncate text-slate-400">{c.cliente_nombre ?? "—"}</span>
                <span className="font-mono text-slate-200">{c.total_bs} Bs</span>
                <span className="text-xs text-slate-500">{c.lineas} línea(s)</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

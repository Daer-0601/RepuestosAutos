"use client";

import { formatoMostrarFechaHoraBo } from "@/lib/fecha-bolivia";
import { rangoPrecioListaTopeBs } from "@/lib/venta-precio-lista-tope-range";
import { Loader2, Plus, Printer, Search, Trash2 } from "lucide-react";
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
  codigoPieza: string | null;
  medida: string | null;
  nombre: string;
  cantidad: string;
  precioUnitBs: string;
  precioListaBs: number | null;
  puntoTope: number | null;
};

function nuevaLinea(p: ProductoCatalogoCot): LineaCot {
  const lista = p.precio_venta_lista_bs != null && p.precio_venta_lista_bs !== "" ? Number(p.precio_venta_lista_bs) : null;
  const tope = p.punto_tope != null && p.punto_tope !== "" ? Number(p.punto_tope) : null;
  const listaOk = lista !== null && Number.isFinite(lista) && lista > 0 ? round2(lista) : null;
  const topeOk = tope !== null && Number.isFinite(tope) && tope > 0 ? round2(tope) : null;
  const precioIni = defaultPrecioUnitBsStr({ precio_venta_lista_bs: listaOk });
  return {
    key: typeof crypto !== "undefined" ? crypto.randomUUID() : String(Math.random()),
    productoId: p.id,
    codigo: p.codigo,
    codigoPieza: p.codigo_pieza?.trim() ? p.codigo_pieza.trim() : null,
    medida: p.medida?.trim() ? p.medida.trim() : null,
    nombre: p.nombre,
    cantidad: "1",
    precioUnitBs: precioIni,
    precioListaBs: listaOk,
    puntoTope: topeOk,
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

/** Solo dígitos y un separador decimal (coma o punto → un solo punto). */
function sanitizePrecioUnitBsDigitos(raw: string): string {
  const s = raw.replace(/,/g, ".");
  let out = "";
  let dot = false;
  for (const ch of s) {
    if (ch >= "0" && ch <= "9") {
      out += ch;
      continue;
    }
    if (ch === "." && !dot) {
      out += ".";
      dot = true;
    }
  }
  return out;
}

/** Igual que nueva venta: intervalo entre lista y tope, o solo uno si falta el otro. */
function precioUnitBsBounds(lista: number | null, tope: number | null): { lo: number | null; hi: number | null } {
  const interval = rangoPrecioListaTopeBs(lista, tope);
  if (interval) {
    return { lo: round2(interval.lo), hi: round2(interval.hi) };
  }
  const listaOk = lista != null && Number.isFinite(lista) && lista > 0 ? round2(lista) : null;
  const topeOk = tope != null && Number.isFinite(tope) && tope > 0 ? round2(tope) : null;
  if (listaOk != null) return { lo: listaOk, hi: null };
  if (topeOk != null) return { lo: null, hi: topeOk };
  return { lo: null, hi: null };
}

function precioUnitLineaEfectivo(ln: LineaCot): number | null {
  const p = parsePrecio(ln.precioUnitBs, ln.precioListaBs);
  if (p === null) return null;
  const { lo, hi } = precioUnitBsBounds(ln.precioListaBs, ln.puntoTope);
  let v = p;
  if (hi != null) v = Math.min(v, hi);
  if (lo != null) v = Math.max(v, lo);
  return v;
}

function defaultPrecioUnitBsStr(p: { precio_venta_lista_bs: number | null }): string {
  const lista = p.precio_venta_lista_bs;
  if (lista != null && Number.isFinite(lista) && lista > 0) {
    return String(round2(lista));
  }
  return "";
}

function clampPrecioUnitBsInput(raw: string, lista: number | null, tope: number | null): string {
  const cleaned = sanitizePrecioUnitBsDigitos(raw);
  const t = cleaned.trim();
  if (t === "" || t === ".") return t;

  if (/^\d+\.$/.test(t)) {
    return t;
  }

  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return "";

  let v = round2(n);
  const { hi } = precioUnitBsBounds(lista, tope);
  if (hi != null) v = Math.min(v, hi);
  if (v <= 0) return "";

  return String(v);
}

function snapPrecioUnitBsToRange(raw: string, lista: number | null, tope: number | null): string {
  const cleaned = sanitizePrecioUnitBsDigitos(raw);
  const t = cleaned.trim();
  if (t === "" || t === ".") {
    return defaultPrecioUnitBsStr({ precio_venta_lista_bs: lista });
  }
  const parseT = t.endsWith(".") ? t.slice(0, -1) : t;
  const n = Number(parseT);
  if (!Number.isFinite(n) || n <= 0) {
    return defaultPrecioUnitBsStr({ precio_venta_lista_bs: lista });
  }
  let v = round2(n);
  const { lo, hi } = precioUnitBsBounds(lista, tope);
  if (hi != null) v = Math.min(v, hi);
  if (lo != null) v = Math.max(v, lo);
  return String(v);
}

function subtotalLineaBs(ln: LineaCot): number | null {
  const q = parseQty(ln.cantidad);
  if (q < 1) return null;
  const p = precioUnitLineaEfectivo(ln);
  if (p === null) return null;
  return round2(q * p);
}

function normalizarTextoLectorCodigo(s: string) {
  return s.replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/[\u0000-\u001F\u007F]/g, "");
}

/** Escapa texto para insertar en HTML de la ventana de impresión. */
function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const PER_PAGE = 50;

export function CotizacionesPanel() {
  const [tipoCambio, setTipoCambio] = useState<{ id: number; valor_bs_por_usd: number } | null>(null);
  const [sucursalNombre, setSucursalNombre] = useState("");
  const [ctxLoading, setCtxLoading] = useState(true);

  const [vista, setVista] = useState<"paginado" | "busqueda">("paginado");
  const [page, setPage] = useState(1);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [filasCatalogo, setFilasCatalogo] = useState<ProductoCatalogoCot[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const [busquedaCodigoBarra, setBusquedaCodigoBarra] = useState("");
  const [busquedaGeneral, setBusquedaGeneral] = useState("");
  const [buscando, setBuscando] = useState(false);

  const [lineas, setLineas] = useState<LineaCot[]>([]);

  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  /** Evita que una respuesta tardía del listado paginado pise resultados de búsqueda (u otra petición). */
  const catalogoReqSeqRef = useRef(0);

  const loadContext = useCallback(async () => {
    setCtxLoading(true);
    try {
      const res = await fetch("/api/vendedor/cotizaciones", { cache: "no-store" });
      const data = (await res.json()) as {
        tipoCambio?: { id: number; valor_bs_por_usd: number } | null;
        sucursalNombre?: string;
        error?: string;
      };
      if (!res.ok) {
        setMsg({ type: "err", text: data.error ?? "No se pudo cargar el contexto." });
        return;
      }
      setTipoCambio(data.tipoCambio ?? null);
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

  const buscarPorCodigoBarra = useCallback(async () => {
    const t = normalizarTextoLectorCodigo(busquedaCodigoBarra).trim();
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
        body: JSON.stringify({ codigoBarra: t, perPage: 80 }),
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
  }, [busquedaCodigoBarra]);

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
      setBusquedaCodigoBarra("");
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

  const imprimirCotizacion = useCallback(() => {
    if (lineas.length === 0) return;
    if (typeof document === "undefined") return;

    const fechaStr = new Date().toLocaleString("es-BO", formatoMostrarFechaHoraBo);
    const { bs, usd, tc } = totales;
    const metaRows: { k: string; v: string }[] = [{ k: "Fecha", v: fechaStr }];
    if (sucursalNombre.trim()) metaRows.push({ k: "Sucursal", v: sucursalNombre.trim() });
    metaRows.push(
      { k: "Tipo cambio (Bs/USD)", v: tipoCambio != null ? String(tipoCambio.valor_bs_por_usd) : "—" },
      { k: "Total Bs", v: bs.toFixed(2) },
      { k: "Total USD (referencia)", v: tc > 0 ? String(usd) : "—" }
    );
    const metaHtml = metaRows
      .map(
        ({ k, v }) =>
          `<tr><th style="text-align:left;padding:6px 10px;border:1px solid #ccc;width:200px;background:#f3f4f6">${escHtml(k)}</th><td style="padding:6px 10px;border:1px solid #ccc">${escHtml(v)}</td></tr>`
      )
      .join("");
    const bodyRows = lineas
      .map((ln) => {
        const q = parseQty(ln.cantidad);
        const unit = precioUnitLineaEfectivo(ln);
        const sub = subtotalLineaBs(ln);
        const pieza = ln.codigoPieza?.trim() || "—";
        const med = ln.medida?.trim() || "—";
        return `<tr>
          <td style="padding:10px 12px;border:1px solid #ccc">${escHtml(pieza)}</td>
          <td style="padding:10px 12px;border:1px solid #ccc">${escHtml(med)}</td>
          <td style="padding:10px 12px;border:1px solid #ccc">${escHtml(ln.nombre)}</td>
          <td style="padding:10px 12px;border:1px solid #ccc;text-align:right;font-variant-numeric:tabular-nums">${q}</td>
          <td style="padding:10px 12px;border:1px solid #ccc;text-align:right;font-variant-numeric:tabular-nums">${unit != null ? unit.toFixed(2) : "—"}</td>
          <td style="padding:10px 12px;border:1px solid #ccc;text-align:right;font-variant-numeric:tabular-nums">${sub != null ? sub.toFixed(2) : "—"}</td>
        </tr>`;
      })
      .join("");
    const doc = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escHtml(fechaStr)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; padding: 28px; color: #111; font-size: 16px; line-height: 1.5; }
    .meta { width: 100%; border-collapse: collapse; margin-bottom: 24px; max-width: 760px; font-size: 15px; }
    .items { width: 100%; border-collapse: collapse; font-size: 15px; }
    .items th { background: #f3f4f6; font-weight: 600; text-align: left; padding: 12px 14px; border: 1px solid #ccc; }
    .items td { padding: 12px 14px; }
    .items th.num { text-align: right; }
    @media print {
      body { padding: 14px; font-size: 15px; }
      .items th, .items td { padding: 10px 12px; font-size: 14px; }
    }
  </style>
</head>
<body>
  <table class="meta">${metaHtml}</table>
  <table class="items">
    <thead>
      <tr>
        <th>Cód. pieza</th>
        <th>Medida</th>
        <th>Producto</th>
        <th class="num">Cant.</th>
        <th class="num">P. unitario Bs</th>
        <th class="num">Subtotal Bs</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>
</body>
</html>`;

    const blob = new Blob([doc], { type: "text/html;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const w = globalThis.window?.open(objectUrl, "_blank");
    if (!w) {
      URL.revokeObjectURL(objectUrl);
      setMsg({ type: "err", text: "No se pudo abrir la ventana de impresión (¿bloqueador de ventanas?)." });
      return;
    }

    const teardown = () => {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        /* ignore */
      }
      try {
        w.close();
      } catch {
        /* ignore */
      }
    };

    w.addEventListener(
      "afterprint",
      () => {
        globalThis.setTimeout(teardown, 200);
      },
      { once: true }
    );

    const doPrint = () => {
      try {
        w.focus();
        w.print();
      } catch {
        setMsg({ type: "err", text: "No se pudo abrir el cuadro de impresión." });
        teardown();
      }
    };

    if (w.document.readyState === "complete") {
      globalThis.setTimeout(doPrint, 100);
    } else {
      w.addEventListener("load", () => globalThis.setTimeout(doPrint, 100), { once: true });
    }
  }, [lineas, tipoCambio, sucursalNombre, totales]);

  const totalPaginas = Math.max(1, Math.ceil(catalogTotal / PER_PAGE));

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
              Los importes en USD de la cotización usan este valor como referencia (también en la hoja de impresión).
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
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Código de barra o QR (como ingreso de compra)
            </label>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <input
                value={busquedaCodigoBarra}
                onChange={(e) => setBusquedaCodigoBarra(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void buscarPorCodigoBarra();
                  }
                }}
                className={`${inpCatalogoBuscar} font-mono sm:min-w-0 sm:flex-1`}
                placeholder="código interno"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => void buscarPorCodigoBarra()}
                disabled={buscando || !normalizarTextoLectorCodigo(busquedaCodigoBarra).trim()}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {buscando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Search className="h-4 w-4" aria-hidden />}
                {buscando ? "Buscando…" : "Buscar"}
              </button>
            </div>
          </div>
          <div className="min-w-0">
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Búsqueda en catálogo</label>
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
                placeholder="Código, nombre, descripción, código pieza…"
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
              setBusquedaCodigoBarra("");
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Líneas de la cotización</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              El precio unitario se carga con lista; solo números; debe quedar entre el menor y el mayor de precio de lista y
              P. tope (igual que en nueva venta). Al salir del campo se ajusta a ese rango. Podés{" "}
              <span className="text-slate-400">imprimir</span> una versión para papel (sin código interno, lista ni tope;
              incluye cód. pieza y medida).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={lineas.length === 0}
              onClick={() => imprimirCotizacion()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-400/40 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Printer className="h-4 w-4" aria-hidden />
              Imprimir cotización
            </button>
          </div>
        </div>

        {lineas.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-xs">
              <thead className="border-b border-white/10 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2 pr-2">Código</th>
                  <th className="py-2 pr-2">Cód. pieza</th>
                  <th className="py-2 pr-2">Medida</th>
                  <th className="py-2 pr-2">Producto</th>
                  <th className="py-2 pr-2">Cant.</th>
                  <th className="py-2 pr-2 text-right">Lista Bs</th>
                  <th className="py-2 pr-2 text-right">P. unit. Bs</th>
                  <th className="py-2 pr-2 text-right">P. tope</th>
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
                      <td className="max-w-[120px] py-2 pr-2 font-mono text-slate-400">
                        {ln.codigoPieza?.trim() || "—"}
                      </td>
                      <td className="max-w-[80px] py-2 pr-2 font-mono text-slate-400">{ln.medida?.trim() || "—"}</td>
                      <td className="max-w-[200px] py-2 pr-2 text-slate-200">
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
                      <td className="py-2 pr-2 text-right font-mono text-slate-400">
                        {ln.precioListaBs != null ? ln.precioListaBs.toFixed(2) : "—"}
                      </td>
                      <td className="py-2 pr-2 text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <input
                            className={`${inpNum} w-full max-w-[7.5rem] text-right`}
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            placeholder={ln.precioListaBs != null ? ln.precioListaBs.toFixed(2) : "—"}
                            value={ln.precioUnitBs}
                            onKeyDown={(e) => {
                              if (e.ctrlKey || e.metaKey || e.altKey) return;
                              if (e.key.length !== 1) return;
                              if (/[0-9.,]/.test(e.key)) return;
                              e.preventDefault();
                            }}
                            onChange={(e) =>
                              setLineas((prev) =>
                                prev.map((x) =>
                                  x.key === ln.key
                                    ? {
                                        ...x,
                                        precioUnitBs: clampPrecioUnitBsInput(
                                          e.target.value,
                                          x.precioListaBs,
                                          x.puntoTope
                                        ),
                                      }
                                    : x
                                )
                              )
                            }
                            onBlur={() =>
                              setLineas((prev) =>
                                prev.map((x) =>
                                  x.key === ln.key
                                    ? {
                                        ...x,
                                        precioUnitBs: snapPrecioUnitBsToRange(
                                          x.precioUnitBs,
                                          x.precioListaBs,
                                          x.puntoTope
                                        ),
                                      }
                                    : x
                                )
                              )
                            }
                          />
                          {ln.precioListaBs != null &&
                          Number.isFinite(ln.precioListaBs) &&
                          ln.precioListaBs > 0 ? (
                            <span className="max-w-[10rem] text-right text-[10px] font-mono leading-tight tabular-nums text-slate-500">
                              precioVenta ({ln.precioListaBs.toFixed(2)} Bs)
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-2 pr-2 text-right font-mono text-amber-100/85">
                        {ln.puntoTope != null ? ln.puntoTope.toFixed(2) : "—"}
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
    </div>
  );
}

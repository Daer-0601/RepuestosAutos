"use client";

import {
  VentaCarritoTabla,
  type VentaCarritoLinea,
  type VentaCarritoProducto,
} from "@/app/vendedor/ventas/nueva/_components/venta-carrito-tabla";
import { VentaCatalogoTabla } from "@/app/vendedor/ventas/nueva/_components/venta-catalogo-tabla";
import { VentaVendedorToolbar } from "@/app/vendedor/ventas/nueva/_components/venta-vendedor-toolbar";
import { CATALOGO_FILAS_DEFAULT } from "@/lib/catalogo-productos-constants";
import { rangoPrecioListaTopeBs } from "@/lib/venta-precio-lista-tope-range";
import type { ModoCatalogoVenta, ProductoVentaCompletoRow, VentaCatalogoApiRow } from "@/lib/types/venta-vendedor-catalogo";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  History,
  Loader2,
  OctagonX,
  Plus,
  ScanLine,
  ShoppingBag,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const inp =
  "w-full min-w-0 rounded border border-white/10 bg-slate-950/80 px-2 py-1.5 text-xs text-white outline-none placeholder:text-slate-600 focus:border-amber-500/40";

/** Inputs compactos estilo formulario clásico (salidas). */
const inpPos =
  "w-full min-w-0 rounded border border-slate-600/80 bg-slate-950/90 px-1.5 py-1 text-[11px] text-slate-100 outline-none focus:border-amber-500/50";

type Tc = { id: number; valor_bs_por_usd: number };

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function round4(n: number) {
  return Math.round(n * 1e4) / 1e4;
}

function strNum(s: string | null | undefined): number | null {
  if (s == null || s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
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

/** Rango [min, max] entre precio de lista y P. tope (ver `rangoPrecioListaTopeBs`). */
function precioUnitBsBounds(lista: number | null, tope: number | null): { lo: number | null; hi: number | null } {
  const interval = rangoPrecioListaTopeBs(lista, tope);
  if (interval) {
    return { lo: round2(interval.lo), hi: round2(interval.hi) };
  }
  const listaOk =
    lista != null && Number.isFinite(lista) && lista > 0 ? round2(lista) : null;
  const topeOk =
    tope != null && Number.isFinite(tope) && tope > 0 ? round2(tope) : null;
  if (listaOk != null) return { lo: listaOk, hi: null };
  if (topeOk != null) return { lo: null, hi: topeOk };
  return { lo: null, hi: null };
}

function precioUnitLineaEfectivo(ln: VentaCarritoLinea): number | null {
  const p = parsePrecio(ln.precioUnitBs, ln.producto.precio_venta_lista_bs);
  if (p === null) return null;
  const { lo, hi } = precioUnitBsBounds(ln.producto.precio_venta_lista_bs, ln.producto.punto_tope);
  let v = p;
  if (hi != null) v = Math.min(v, hi);
  if (lo != null) v = Math.max(v, lo);
  return v;
}

/** Valor inicial del campo: siempre precio de lista (precioVenta), nunca el tope. */
function defaultPrecioUnitBsStr(p: { precio_venta_lista_bs: number | null }): string {
  const lista = p.precio_venta_lista_bs;
  if (lista != null && Number.isFinite(lista) && lista > 0) {
    return String(round2(lista));
  }
  return "";
}

/**
 * Al escribir: solo números y techo (hi); el piso se aplica al salir del campo para poder teclear
 * valores intermedios (p. ej. pasar de 55 a 60 sin que "6" se convierta en 55 al instante).
 */
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

/** Al blur: ajusta al rango completo [lo, hi]. */
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

function subtotalLineaBs(ln: VentaCarritoLinea): number | null {
  const q = parseQty(ln.cantidad);
  if (q < 1) return null;
  const p = precioUnitLineaEfectivo(ln);
  if (p === null) return null;
  return round2(q * p);
}

/** Columna «Descripción»: evita repetir código, pieza, QR o el mismo texto que ya va en «Medida». */
function descripcionMostrarEnLineaVenta(input: {
  codigo: string;
  nombre: string;
  descripcion: string | null | undefined;
  codigo_pieza: string | null | undefined;
  medida?: string | null;
  qr_payload?: string | null;
}): string {
  const nombre = input.nombre.trim();
  const descRaw = (input.descripcion ?? "").trim();
  if (!descRaw) return nombre;
  const norm = (s: string) => s.trim().toLowerCase().replace(/\./g, "");
  const d = norm(descRaw);
  if (d === norm(nombre)) return nombre;
  const pieza = (input.codigo_pieza ?? "").trim();
  if (pieza && d === norm(pieza)) return nombre;
  const cod = input.codigo.trim();
  if (cod && d === norm(cod)) return nombre;
  const qr = (input.qr_payload ?? "").trim();
  if (qr && d === norm(qr)) return nombre;
  const med = (input.medida ?? "").trim();
  if (med && d === norm(med)) return nombre;
  return descRaw;
}

function mapCompletoToLookup(p: ProductoVentaCompletoRow): VentaCarritoProducto {
  const descripcionMostrar = descripcionMostrarEnLineaVenta({
    codigo: p.codigo,
    nombre: p.nombre,
    descripcion: p.descripcion,
    codigo_pieza: p.codigo_pieza,
    medida: p.medida,
    qr_payload: p.qr_payload,
  });
  return {
    id: p.id,
    codigo: p.codigo,
    nombre: p.nombre,
    descripcionMostrar,
    codigoPieza: p.codigo_pieza,
    medida: p.medida,
    stock: p.stockMiSucursal,
    precio_venta_lista_bs: p.precio_venta_lista_bs,
    precio_venta_lista_usd: p.precio_venta_lista_usd,
    punto_tope: p.punto_tope,
    qrPayload: p.qr_payload?.trim() ? p.qr_payload.trim() : p.codigo,
    imagenesUrls: Array.isArray(p.imagenes_urls) ? p.imagenes_urls : [],
  };
}

function mapCatalogRowToLookup(r: VentaCatalogoApiRow, miSucursalId: number): VentaCarritoProducto {
  const stock = r.stocksPorSucursal.find((x) => x.sucursalId === miSucursalId)?.stock ?? 0;
  const descripcionMostrar = descripcionMostrarEnLineaVenta({
    codigo: r.codigo,
    nombre: r.nombre,
    descripcion: r.descripcion,
    codigo_pieza: r.codigo_pieza,
    medida: r.medida,
    qr_payload: r.qr_payload,
  });
  return {
    id: r.id,
    codigo: r.codigo,
    nombre: r.nombre,
    descripcionMostrar,
    codigoPieza: r.codigo_pieza,
    medida: r.medida,
    stock,
    precio_venta_lista_bs: strNum(r.precio_venta_lista_bs),
    precio_venta_lista_usd: strNum(r.precio_venta_lista_usd),
    punto_tope: strNum(r.punto_tope),
    qrPayload: (r.qr_payload ?? "").trim() || r.codigo,
    imagenesUrls: Array.isArray(r.imagenes_urls) ? r.imagenes_urls : [],
  };
}

export function NuevaVentaForm() {
  const router = useRouter();
  const [loadingCtx, setLoadingCtx] = useState(true);
  const [ctxError, setCtxError] = useState<string | null>(null);
  const [miSucursalId, setMiSucursalId] = useState(0);
  const [sucursalNombre, setSucursalNombre] = useState("");
  const [tipoCambio, setTipoCambio] = useState<Tc | null>(null);

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

  const [codigoBuscar, setCodigoBuscar] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [ultimoScanReferencia, setUltimoScanReferencia] = useState<ProductoVentaCompletoRow | null>(null);

  const [lineas, setLineas] = useState<VentaCarritoLinea[]>([]);
  const [tipoPago, setTipoPago] = useState<"efectivo" | "qr" | "tarjeta">("efectivo");
  const [clienteNombreLibre, setClienteNombreLibre] = useState("");
  const [clienteNit, setClienteNit] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [ventaConfirmada, setVentaConfirmada] = useState<{
    ventaId: number;
    totalBs: string;
    at: number;
  } | null>(null);

  const [username, setUsername] = useState("");
  const [reloj, setReloj] = useState(() => new Date());
  const [catalogoExpandido, setCatalogoExpandido] = useState(false);

  const loadContext = useCallback(async () => {
    setLoadingCtx(true);
    setCtxError(null);
    try {
      const res = await fetch("/api/vendedor/ventas/context", { cache: "no-store" });
      if (res.status === 401) {
        setCtxError("Sesión vencida o sin permiso. Volvé a iniciar sesión.");
        return;
      }
      const data = (await res.json()) as {
        sucursalId?: number;
        sucursalNombre?: string;
        username?: string;
        tipoCambio?: Tc | null;
        error?: string;
      };
      if (!res.ok) {
        setCtxError(data.error ?? "No se pudo cargar el contexto.");
        return;
      }
      setMiSucursalId(Number(data.sucursalId ?? 0));
      setSucursalNombre(data.sucursalNombre ?? "");
      setUsername(data.username ?? "");
      setTipoCambio(data.tipoCambio ?? null);
    } catch {
      setCtxError("Error de red al cargar datos.");
    } finally {
      setLoadingCtx(false);
    }
  }, []);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  useEffect(() => {
    const id = setInterval(() => setReloj(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!ventaConfirmada) return;
    const { ventaId, totalBs, at } = ventaConfirmada;
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        new Notification("Venta confirmada", {
          body: `Venta #${ventaId} · ${totalBs} Bs`,
          tag: `venta-ok-${ventaId}-${at}`,
        });
      } catch {
        /* navegador puede bloquear notificaciones */
      }
    }
    const t = window.setTimeout(() => setVentaConfirmada(null), 10000);
    return () => window.clearTimeout(t);
  }, [ventaConfirmada]);

  const tcVal = tipoCambio?.valor_bs_por_usd ?? 0;

  const fechaHoraStr = useMemo(() => {
    const opts: Intl.DateTimeFormatOptions = { timeZone: "America/La_Paz" };
    const fecha = reloj.toLocaleDateString("es-BO", { ...opts, day: "2-digit", month: "2-digit", year: "numeric" });
    const hora = reloj.toLocaleTimeString("es-BO", { ...opts, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    return { fecha, hora };
  }, [reloj]);

  const totales = useMemo(() => {
    let bs = 0;
    let usd = 0;
    for (const ln of lineas) {
      const q = parseQty(ln.cantidad);
      if (q < 1) continue;
      const p = precioUnitLineaEfectivo(ln);
      if (p === null) continue;
      bs = round2(bs + q * p);
      if (tcVal > 0) {
        usd = round4(usd + (q * p) / tcVal);
      }
    }
    return { bs, usd };
  }, [lineas, tcVal]);

  function imprimirFacturaVenta() {
    if (lineas.length === 0) return;
    document.documentElement.classList.add("print-solo-factura-venta");
    const quitarClase = () => {
      document.documentElement.classList.remove("print-solo-factura-venta");
    };
    window.addEventListener("afterprint", quitarClase, { once: true });
    window.setTimeout(quitarClase, 5000);
    window.print();
  }

  function agregarAlCarrito(p: VentaCarritoProducto) {
    setUltimoScanReferencia(null);
    setLineas((prev) => {
      const idx = prev.findIndex((l) => l.producto.id === p.id);
      if (idx >= 0) {
        const copy = [...prev];
        const cur = parseQty(copy[idx].cantidad);
        const max = p.stock;
        const next = Math.min(max, cur + 1);
        const prevPrecio = copy[idx].precioUnitBs.trim();
        copy[idx] = {
          ...copy[idx],
          producto: p,
          cantidad: String(Math.max(1, next)),
          precioUnitBs:
            prevPrecio === "" ? defaultPrecioUnitBsStr(p) : copy[idx].precioUnitBs,
        };
        return copy;
      }
      return [
        ...prev,
        {
          key: typeof crypto !== "undefined" ? crypto.randomUUID() : String(Math.random()),
          producto: p,
          cantidad: "1",
          precioUnitBs: defaultPrecioUnitBsStr(p),
        },
      ];
    });
  }

  async function ejecutarBusquedaCatalogo() {
    if (!miSucursalId) return;
    setMsg(null);
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
        setMsg({ type: "err", text: data.error ?? "No se pudo buscar en el catálogo." });
        setCatalogRows([]);
        setCatalogTotal(0);
        return;
      }
      setCatalogTotal(Number(data.total ?? 0));
      setCatalogSucursales(Array.isArray(data.sucursales) ? data.sucursales : []);
      setCatalogRows(Array.isArray(data.rows) ? data.rows : []);
    } catch {
      setMsg({ type: "err", text: "Error de red en la búsqueda del catálogo." });
      setCatalogRows([]);
    } finally {
      setCatalogBuscado(true);
      setCatalogLoading(false);
    }
  }

  function onAgregarDesdeTabla(row: VentaCatalogoApiRow) {
    const p = mapCatalogRowToLookup(row, miSucursalId);
    if (p.stock < 1) {
      setMsg({
        type: "err",
        text: "Sin stock en tu sucursal. Revisá otras columnas o pedí un traspaso desde admin.",
      });
      return;
    }
    agregarAlCarrito(p);
  }

  async function buscarProducto(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const raw = codigoBuscar.trim();
    if (!raw) return;
    setBuscando(true);
    setUltimoScanReferencia(null);
    try {
      const res = await fetch("/api/vendedor/productos/venta-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: raw }),
      });
      const data = (await res.json()) as { producto?: ProductoVentaCompletoRow; error?: string };
      if (!res.ok) {
        setMsg({ type: "err", text: data.error ?? "No se encontró el producto." });
        return;
      }
      if (!data.producto) {
        setMsg({ type: "err", text: "Respuesta inválida." });
        return;
      }
      const p = data.producto;
      if (!p.puedeVenderEnMiSucursal) {
        setUltimoScanReferencia(p);
        setMsg({
          type: "err",
          text: `${p.codigo}: sin stock en ${sucursalNombre}. Mirá el cuadro de referencia abajo o el catálogo por sucursal.`,
        });
        return;
      }
      agregarAlCarrito(mapCompletoToLookup(p));
      setCodigoBuscar("");
    } catch {
      setMsg({ type: "err", text: "Error de red al buscar." });
    } finally {
      setBuscando(false);
    }
  }

  async function confirmarVenta(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!tipoCambio) {
      setMsg({ type: "err", text: "No hay tipo de cambio cargado; no se puede vender." });
      return;
    }
    if (lineas.length === 0) {
      setMsg({ type: "err", text: "Agregá productos al carrito." });
      return;
    }
    const payloadLineas = [];
    for (const ln of lineas) {
      const q = parseQty(ln.cantidad);
      if (q < 1) {
        setMsg({ type: "err", text: `Cantidad inválida para ${ln.producto.codigo}.` });
        return;
      }
      if (q > ln.producto.stock) {
        setMsg({ type: "err", text: `Stock insuficiente para ${ln.producto.codigo} (máx. ${ln.producto.stock}).` });
        return;
      }
      const precioLista = ln.producto.precio_venta_lista_bs;
      const precioExplicit = ln.precioUnitBs.trim()
        ? round2(Number(ln.precioUnitBs.replace(",", ".")))
        : null;
      if (precioExplicit !== null && (!Number.isFinite(precioExplicit) || precioExplicit <= 0)) {
        setMsg({ type: "err", text: `Precio inválido para ${ln.producto.codigo}.` });
        return;
      }
      if ((precioExplicit === null || precioExplicit === undefined) && (precioLista === null || precioLista <= 0)) {
        setMsg({ type: "err", text: `${ln.producto.codigo} no tiene precio de lista; ingresá precio manual.` });
        return;
      }
      const precioFinal = precioExplicit ?? precioLista;
      const tope = ln.producto.punto_tope;
      const { lo, hi } = precioUnitBsBounds(precioLista, tope);
      if (precioFinal != null && lo != null && precioFinal < lo) {
        setMsg({
          type: "err",
          text: `${ln.producto.codigo}: el precio debe ser al menos ${lo.toFixed(2)} Bs (rango con lista y tope).`,
        });
        return;
      }
      if (precioFinal != null && hi != null && precioFinal > hi) {
        setMsg({
          type: "err",
          text: `${ln.producto.codigo}: el precio no puede superar ${hi.toFixed(2)} Bs (rango con lista y tope).`,
        });
        return;
      }
      payloadLineas.push({
        productoId: ln.producto.id,
        cantidad: q,
        precioUnitarioBs: precioExplicit,
      });
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/vendedor/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipoPago,
          clienteId: null,
          tipoCambioId: tipoCambio.id,
          tipoCambioSnapshot: tipoCambio.valor_bs_por_usd,
          numeroDocumento: null,
          clienteNombreLibre: clienteNombreLibre.trim() || null,
          clienteNit: clienteNit.trim() || null,
          creditoFechaLimite: null,
          lineas: payloadLineas,
        }),
      });
      const data = (await res.json()) as { ventaId?: number; error?: string };
      if (!res.ok) {
        setMsg({ type: "err", text: data.error ?? "No se pudo registrar la venta." });
        return;
      }
      const vid = data.ventaId;
      if (vid == null || !Number.isFinite(vid)) {
        setMsg({ type: "err", text: "Respuesta inválida del servidor." });
        return;
      }
      setMsg(null);
      imprimirFacturaVenta();
      setVentaConfirmada({
        ventaId: vid,
        totalBs: totales.bs.toFixed(2),
        at: Date.now(),
      });
      setLineas([]);
      setClienteNombreLibre("");
      setClienteNit("");
      setUltimoScanReferencia(null);
      void ejecutarBusquedaCatalogo();
      router.refresh();
    } catch {
      setMsg({ type: "err", text: "Error de red al confirmar." });
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingCtx) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-slate-950/40 py-16 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400/90" />
        <p className="text-sm">Preparando tu puesto de venta…</p>
      </div>
    );
  }

  if (ctxError) {
    return (
      <div className="rounded-xl border border-rose-500/35 bg-rose-950/30 px-4 py-3 text-sm text-rose-100" role="alert">
        {ctxError}
      </div>
    );
  }

  const tcBs = tipoCambio?.valor_bs_por_usd ?? null;

  return (
    <div>
      <div className="space-y-6 text-slate-300">
      <VentaVendedorToolbar
        sucursalNombre={sucursalNombre}
        username={username}
        tipoCambioBsPorUsd={tcBs}
        fechaStr={fechaHoraStr.fecha}
        horaStr={fechaHoraStr.hora}
      />

      {msg ? (
        <div
          className={`flex gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed ${
            msg.type === "ok"
              ? "border-emerald-500/35 bg-emerald-950/30 text-emerald-50"
              : "border-rose-500/35 bg-rose-950/35 text-rose-50"
          }`}
          role="status"
        >
          {msg.type === "ok" ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400/90" aria-hidden />
          ) : (
            <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-rose-500/40" aria-hidden />
          )}
          <p>{msg.text}</p>
        </div>
      ) : null}

      {ventaConfirmada ? (
        <div
          className="fixed bottom-5 right-5 z-[200] w-[min(100vw-2.5rem,22rem)] overflow-hidden rounded-2xl border border-emerald-500/40 bg-slate-950/95 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.65)] shadow-emerald-900/20 ring-1 ring-white/10 backdrop-blur-md"
          role="alert"
          aria-live="polite"
        >
          <div className="flex items-start gap-3 border-b border-emerald-500/25 bg-emerald-950/40 px-4 py-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300">
              <CheckCircle2 className="h-6 w-6" strokeWidth={2} aria-hidden />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-200/90">Venta confirmada</p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-white">
                #{ventaConfirmada.ventaId}
              </p>
              <p className="mt-0.5 font-mono text-sm text-emerald-100/90">{ventaConfirmada.totalBs} Bs</p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Cerrar aviso"
              onClick={() => setVentaConfirmada(null)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 px-4 py-3">
            <Link
              href="/vendedor/ventas"
              className="inline-flex items-center rounded-lg bg-emerald-500/90 px-3 py-1.5 text-xs font-medium text-slate-950 transition hover:bg-emerald-400"
            >
              Ver historial
            </Link>
            {typeof Notification !== "undefined" && Notification.permission === "default" ? (
              <button
                type="button"
                className="text-xs text-slate-400 underline decoration-slate-500/60 underline-offset-2 hover:text-slate-200"
                onClick={async () => {
                  try {
                    await Notification.requestPermission();
                  } catch {
                    /* vacío */
                  }
                }}
              >
                Permitir avisos del sistema
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Datos del cobro (arriba del lector para ver forma de pago antes de escanear) */}
      <section className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 sm:p-5">
        <h2 className="text-base font-semibold text-white">Datos del cobro</h2>
        <p className="mt-1 text-xs text-slate-500">
          Solo cobro inmediato (efectivo, QR o tarjeta). Ventas a crédito y cuentas de cliente van en la sección de
          créditos. El tipo mostrado es referencia en pantalla e impresión.
        </p>
        <div className="mt-4 flex min-w-0 flex-nowrap items-center gap-x-3 gap-y-0 overflow-x-auto pb-1 sm:gap-x-4">
          <div className="flex shrink-0 items-center gap-2">
            <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Tipo (nota)
            </span>
            <span
              className={`${inp} inline-flex cursor-default items-center border-white/15 bg-slate-900/60 py-1.5 pl-2 pr-2.5 font-mono text-slate-200`}
              title="Tipo fijo para esta pantalla"
            >
              proforma_1
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <label
              htmlFor="venta-tipo-pago"
              className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-slate-500"
            >
              Forma de pago
            </label>
            <select
              id="venta-tipo-pago"
              className={`${inp} w-auto min-w-[7.5rem]`}
              value={tipoPago}
              onChange={(e) => setTipoPago(e.target.value as typeof tipoPago)}
            >
              <option value="efectivo">Efectivo</option>
              <option value="qr">QR</option>
              <option value="tarjeta">Tarjeta</option>
            </select>
          </div>
          <div className="flex min-w-[12rem] max-w-md flex-1 items-center gap-2">
            <label
              htmlFor="venta-cliente-nombre"
              className="shrink-0 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-slate-500"
            >
              Nombre del cliente <span className="font-normal normal-case text-slate-600">(opcional)</span>
            </label>
            <input
              id="venta-cliente-nombre"
              className={`${inp} min-w-[8rem] flex-1`}
              value={clienteNombreLibre}
              onChange={(e) => setClienteNombreLibre(e.target.value)}
              placeholder="Ej. razón social o nombre"
              autoComplete="name"
            />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <label
              htmlFor="venta-cliente-nit"
              className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-slate-500"
            >
              NIT <span className="font-normal normal-case text-slate-600">(opcional)</span>
            </label>
            <input
              id="venta-cliente-nit"
              className={`${inp} w-[7.5rem] min-w-[7rem] font-mono sm:w-36`}
              value={clienteNit}
              onChange={(e) => setClienteNit(e.target.value)}
              placeholder="NIT"
              autoComplete="off"
            />
          </div>
        </div>
      </section>

      {/* 1 · Entrada rápida (lector / teclado) */}
      <section className="rounded-2xl border border-amber-500/25 bg-gradient-to-b from-amber-500/[0.07] to-slate-950/40 p-4 sm:p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Agregar con código o QR</h2>
            <p className="mt-1 max-w-2xl text-xs text-slate-500">
              Enfocá el cursor acá, escaneá o pegá el código y pulsá Enter. Solo suma líneas si hay stock en tu
              sucursal.
            </p>
          </div>
          <Link
            href="/vendedor/ventas"
            className="inline-flex shrink-0 items-center gap-2 self-start rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-amber-500/30 hover:text-white"
          >
            <History className="h-3.5 w-3.5 text-amber-400/80" />
            Ver historial
          </Link>
        </div>
        <form onSubmit={buscarProducto} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <div className="relative min-w-0 flex-1">
            <ScanLine
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-amber-400/60"
              aria-hidden
            />
            <input
              className={`${inp} h-12 rounded-xl border-amber-500/25 bg-slate-950/90 pl-12 pr-4 text-sm shadow-inner shadow-black/30 placeholder:text-slate-600 focus:border-amber-500/50`}
              value={codigoBuscar}
              onChange={(e) => setCodigoBuscar(e.target.value)}
              placeholder="Código interno, QR o referencia…"
              autoComplete="off"
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={buscando || !codigoBuscar.trim()}
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-900/20 transition hover:bg-amber-400 disabled:pointer-events-none disabled:opacity-40"
          >
            {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" strokeWidth={2.5} />}
            Agregar
          </button>
        </form>

        {ultimoScanReferencia ? (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-slate-950/60 p-4 text-sm">
            <p className="font-medium text-amber-100">
              {ultimoScanReferencia.codigo}
              <span className="font-normal text-slate-500"> — sin stock en tu sucursal; referencia por depósito</span>
            </p>
            <p className="mt-1 font-mono text-xs text-slate-500">
              Lista Bs {ultimoScanReferencia.precio_venta_lista_bs?.toFixed(2) ?? "—"} · Tope{" "}
              {ultimoScanReferencia.punto_tope?.toFixed(2) ?? "—"}
            </p>
            <ul className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {ultimoScanReferencia.porSucursal.map((s) => (
                <li
                  key={s.sucursalId}
                  className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 font-mono text-xs ${
                    s.sucursalId === miSucursalId
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-50"
                      : "border-white/10 text-slate-400"
                  }`}
                >
                  <span className="min-w-0 truncate">{s.sucursalNombre}</span>
                  <span className={s.stock > 0 ? "text-emerald-300" : "text-slate-600"}>{s.stock}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* 2 · Carrito */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-amber-400/90" aria-hidden />
            <div>
              <h2 className="text-base font-semibold text-white">Líneas de esta venta</h2>
              <p className="text-xs text-slate-500">
                Ajustá cantidades y precio en Bs si hace falta. El precio se carga con lista; solo números; debe quedar
                entre el menor y el mayor de <span className="text-slate-400">precioVenta</span> (lista) y{" "}
                <span className="text-slate-400">P. tope</span>. Al salir del campo, el valor se ajusta a ese rango.
                Las columnas se redimensionan arrastrando el borde.
              </p>
            </div>
          </div>
          <p className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 font-mono text-xs text-slate-400">
            {lineas.length === 0 ? "Vacío" : `${lineas.length} ítem${lineas.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <VentaCarritoTabla
          lineas={lineas}
          inpPosClass={inpPos}
          subtotalLineaBs={subtotalLineaBs}
          onCantidadChange={(key, value) =>
            setLineas((prev) => prev.map((x) => (x.key === key ? { ...x, cantidad: value } : x)))
          }
          onPrecioChange={(key, value) =>
            setLineas((prev) =>
              prev.map((x) =>
                x.key === key
                  ? {
                      ...x,
                      precioUnitBs: clampPrecioUnitBsInput(
                        value,
                        x.producto.precio_venta_lista_bs,
                        x.producto.punto_tope
                      ),
                    }
                  : x
              )
            )
          }
          onPrecioBlur={(key) =>
            setLineas((prev) =>
              prev.map((x) =>
                x.key === key
                  ? {
                      ...x,
                      precioUnitBs: snapPrecioUnitBsToRange(
                        x.precioUnitBs,
                        x.producto.precio_venta_lista_bs,
                        x.producto.punto_tope
                      ),
                    }
                  : x
              )
            )
          }
          onRemove={(key) => setLineas((prev) => prev.filter((x) => x.key !== key))}
        />
      </section>

      {/* 3 · Cobro y confirmación */}
      <form onSubmit={confirmarVenta} className="space-y-5">
        <div className="flex flex-col gap-4 rounded-2xl border border-amber-500/20 bg-slate-950/60 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Total a cobrar</p>
            <p className="mt-1 font-mono text-3xl font-semibold tabular-nums text-amber-50">{totales.bs.toFixed(2)}</p>
            <p className="text-sm text-amber-200/80">bolivianos</p>
            {tcVal > 0 ? (
              <p className="mt-2 font-mono text-sm text-slate-500">
                ≈ <span className="text-slate-300">{totales.usd.toFixed(4)}</span> USD al tipo del día
              </p>
            ) : (
              <p className="mt-2 text-xs text-amber-200/60">Sin conversión a USD: no hay tipo de cambio cargado.</p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/5 pt-4 sm:border-t-0 sm:pt-0">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-sm text-rose-100 hover:bg-rose-900/55"
              onClick={() => {
                if (lineas.length === 0 && !clienteNombreLibre.trim() && !clienteNit.trim()) return;
                if (!confirm("¿Descartar esta venta y limpiar datos del cobro?")) return;
                setLineas([]);
                setClienteNombreLibre("");
                setClienteNit("");
                setTipoPago("efectivo");
                setMsg(null);
              }}
            >
              <OctagonX className="h-4 w-4" />
              Descartar
            </button>
            <button
              type="submit"
              disabled={submitting || !tipoCambio || lineas.length === 0}
              className="inline-flex min-w-[140px] items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 pl-5 pr-6 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-900/25 transition hover:bg-amber-400 disabled:pointer-events-none disabled:opacity-40"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />
              )}
              Confirmar venta
            </button>
          </div>
        </div>
      </form>

      {/* 4 · Buscador de catálogo */}
      <section className="space-y-3 border-t border-white/10 pt-6">
        <button
          type="button"
          onClick={() => setCatalogoExpandido((v) => !v)}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-left transition hover:border-amber-500/30 hover:bg-slate-900/60"
        >
          <div>
            <p className="text-sm font-semibold text-white">Buscador de repuestos</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Stock por sucursal; podés agregar al carrito solo si tu depósito tiene existencia.
            </p>
          </div>
          {catalogoExpandido ? (
            <ChevronUp className="h-5 w-5 shrink-0 text-slate-500" />
          ) : (
            <ChevronDown className="h-5 w-5 shrink-0 text-slate-500" />
          )}
        </button>
        {catalogoExpandido ? (
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
                    onChange={(e) => setQ(e.target.value)}
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
                    onChange={(e) => setCodigo(e.target.value)}
                    placeholder="Ej. 1000"
                    className={`${inp} mt-1 font-mono`}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Cód. pieza</label>
                  <input
                    value={codigoPieza}
                    onChange={(e) => setCodigoPieza(e.target.value)}
                    placeholder="OEM / referencia"
                    className={`${inp} mt-1`}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Especificación
                  </label>
                  <input value={especificacion} onChange={(e) => setEspecificacion(e.target.value)} className={`${inp} mt-1`} />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Medida</label>
                  <input value={medida} onChange={(e) => setMedida(e.target.value)} className={`${inp} mt-1`} />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Descripción</label>
                  <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className={`${inp} mt-1`} />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Repuesto</label>
                  <input value={repuesto} onChange={(e) => setRepuesto(e.target.value)} className={`${inp} mt-1`} />
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
                  onClick={() => {
                    setQ("");
                    setCodigo("");
                    setCodigoPieza("");
                    setEspecificacion("");
                    setMedida("");
                    setDescripcion("");
                    setRepuesto("");
                    setModoCatalogo("mi_sucursal");
                    setPerPage(String(CATALOGO_FILAS_DEFAULT));
                  }}
                >
                  Limpiar filtros
                </button>
              </div>
            </form>
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
              onAgregar={onAgregarDesdeTabla}
            />
          </div>
        ) : null}
      </section>
      </div>

      <div
        id="factura-venta-proforma"
        className="hidden bg-white text-[11px] leading-snug text-slate-900 print:block"
        role="document"
        aria-label="Factura preliminar de venta"
      >
        <div className="border-b border-slate-300 pb-2">
          <p className="text-base font-bold tracking-tight text-slate-900">Nota de venta</p>
          <p className="mt-0.5 font-mono text-[10px] text-slate-600">Tipo nota: proforma_1</p>
          <p className="mt-1 font-semibold text-slate-800">{sucursalNombre}</p>
          <p className="mt-0.5 font-mono text-[10px] text-slate-600">
            {fechaHoraStr.fecha} · {fechaHoraStr.hora} (La Paz)
          </p>
          <p className="mt-0.5 text-[10px] text-slate-700">Vendedor: {username || "—"}</p>
        </div>

        {clienteNombreLibre.trim() || clienteNit.trim() ? (
          <div className="mt-2 border-b border-slate-200 pb-2 text-[10px] text-slate-800">
            {clienteNombreLibre.trim() ? <p>Cliente: {clienteNombreLibre.trim()}</p> : null}
            {clienteNit.trim() ? <p className="font-mono">NIT: {clienteNit.trim()}</p> : null}
          </div>
        ) : null}

        <p className="mt-2 text-[10px] text-slate-800">
          <span className="font-semibold">Forma de pago:</span>{" "}
          {tipoPago === "efectivo" ? "Efectivo" : tipoPago === "qr" ? "QR" : "Tarjeta"}
        </p>

        <table className="mt-3 w-full border-collapse border border-slate-400 text-[10px]">
          <thead>
            <tr className="bg-slate-100 text-left text-slate-900">
              <th className="border border-slate-400 px-1.5 py-1 font-semibold">Código</th>
              <th className="border border-slate-400 px-1.5 py-1 font-semibold">Descripción</th>
              <th className="border border-slate-400 px-1 py-1 text-right font-semibold">Cant.</th>
              <th className="border border-slate-400 px-1 py-1 text-right font-semibold">P. unit. Bs</th>
              <th className="border border-slate-400 px-1 py-1 text-right font-semibold">Subt. Bs</th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((ln) => {
              const unit = precioUnitLineaEfectivo(ln);
              const sub = subtotalLineaBs(ln);
              const p = ln.producto;
              return (
                <tr key={ln.key}>
                  <td className="border border-slate-300 px-1.5 py-1 font-mono align-top text-slate-900">{p.codigo}</td>
                  <td className="border border-slate-300 px-1.5 py-1 align-top text-slate-800">{p.descripcionMostrar}</td>
                  <td className="border border-slate-300 px-1 py-1 text-right font-mono align-top text-slate-900">
                    {ln.cantidad}
                  </td>
                  <td className="border border-slate-300 px-1 py-1 text-right font-mono align-top text-slate-900">
                    {unit != null ? unit.toFixed(2) : "—"}
                  </td>
                  <td className="border border-slate-300 px-1 py-1 text-right font-mono align-top text-slate-900">
                    {sub != null ? sub.toFixed(2) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-3 flex items-end justify-between border-t-2 border-slate-800 pt-2 text-slate-900">
          <span className="text-xs font-bold uppercase">Total</span>
          <span className="font-mono text-sm font-bold">{totales.bs.toFixed(2)} Bs</span>
        </div>
      </div>
    </div>
  );
}

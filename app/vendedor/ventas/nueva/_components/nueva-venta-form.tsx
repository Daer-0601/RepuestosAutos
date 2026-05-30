"use client";

import {
  VentaCarritoTabla,
  type VentaCarritoLinea,
  type VentaCarritoProducto,
} from "@/app/vendedor/ventas/nueva/_components/venta-carrito-tabla";
import { VentaCatalogoTabla } from "@/app/vendedor/ventas/nueva/_components/venta-catalogo-tabla";
import { VentaVendedorToolbar } from "@/app/vendedor/ventas/nueva/_components/venta-vendedor-toolbar";
import {
  ClienteCreditoBuscador,
  type ClienteCreditoSeleccionado,
} from "@/app/vendedor/ventas/nueva/_components/cliente-credito-buscador";
import { CATALOGO_FILAS_DEFAULT } from "@/lib/catalogo-productos-constants";
import type { ModoCatalogoVenta, ProductoVentaCompletoRow, VentaCatalogoApiRow } from "@/lib/types/venta-vendedor-catalogo";
import {
  carritoProductoSinMetadatos,
  clampPrecioUnitBsInput,
  defaultPrecioUnitBsStr,
  fusionarProductoCarrito,
  mapCatalogRowToLookup,
  mapCompletoToLookup,
  parsePrecioUnitBsExplicito,
  parseQty,
  precioUnitLineaEfectivo,
  round2,
  round4,
  snapCantidadToStock,
  snapPrecioUnitBsToRange,
  subtotalLineaBs,
} from "@/lib/vendedor/venta-carrito-helpers";
import { validarPrecioVentaBs } from "@/lib/venta-precio-lista-tope-range";
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const inp =
  "w-full min-w-0 rounded border border-white/10 bg-slate-950/80 px-2 py-1.5 text-xs text-white outline-none placeholder:text-slate-600 focus:border-amber-500/40";

/** Inputs compactos estilo formulario clásico (salidas). */
const inpPos =
  "w-full min-w-0 rounded border border-slate-600/80 bg-slate-950/90 px-1.5 py-1 text-[11px] text-slate-100 outline-none focus:border-amber-500/50";

type Tc = { id: number; valor_bs_por_usd: number };

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
  const [cajeros, setCajeros] = useState<{ id: number; nombreCompleto: string; username: string }[]>([]);
  const [cajeroDestinoId, setCajeroDestinoId] = useState("");
  const [esCredito, setEsCredito] = useState(false);
  const [clienteCredito, setClienteCredito] = useState<ClienteCreditoSeleccionado | null>(null);
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
  const metadatosHidratadosRef = useRef(new Set<number>());
  const hidratandoMetadatosRef = useRef(false);

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
        cajeros?: { id: number; nombreCompleto: string; username: string }[];
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
      const listaCajeros = Array.isArray(data.cajeros) ? data.cajeros : [];
      setCajeros(listaCajeros);
      setCajeroDestinoId((prev) => {
        if (prev && listaCajeros.some((c) => String(c.id) === prev)) return prev;
        return listaCajeros.length === 1 ? String(listaCajeros[0].id) : "";
      });
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

  /** Si el catálogo ya trajo la fila, completar marca / procedencia / unidad sin otro request. */
  useEffect(() => {
    if (!miSucursalId || catalogRows.length === 0) return;
    setLineas((prev) => {
      let changed = false;
      const next = prev.map((ln) => {
        if (!carritoProductoSinMetadatos(ln.producto)) return ln;
        const row = catalogRows.find((r) => r.id === ln.producto.id);
        if (!row) return ln;
        changed = true;
        metadatosHidratadosRef.current.add(ln.producto.id);
        return {
          ...ln,
          producto: fusionarProductoCarrito(ln.producto, mapCatalogRowToLookup(row, miSucursalId)),
        };
      });
      return changed ? next : prev;
    });
  }, [catalogRows, miSucursalId]);

  /** Repone metadatos faltantes (p. ej. línea agregada antes del cambio de columnas). */
  useEffect(() => {
    if (!miSucursalId || lineas.length === 0 || hidratandoMetadatosRef.current) return;
    const pending = lineas.filter(
      (ln) =>
        carritoProductoSinMetadatos(ln.producto) && !metadatosHidratadosRef.current.has(ln.producto.id)
    );
    if (pending.length === 0) return;

    hidratandoMetadatosRef.current = true;
    let cancelled = false;

    (async () => {
      const updates = new Map<number, VentaCarritoProducto>();
      for (const ln of pending) {
        metadatosHidratadosRef.current.add(ln.producto.id);
        try {
          const res = await fetch("/api/vendedor/productos/venta-lookup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ codigo: ln.producto.codigo }),
          });
          const data = (await res.json()) as { producto?: ProductoVentaCompletoRow };
          if (res.ok && data.producto) {
            updates.set(ln.producto.id, mapCompletoToLookup(data.producto));
          }
        } catch {
          /* ignorar; no reintentar en bucle */
        }
      }
      if (!cancelled && updates.size > 0) {
        setLineas((prev) =>
          prev.map((ln) => {
            const fresh = updates.get(ln.producto.id);
            if (!fresh) return ln;
            return { ...ln, producto: fusionarProductoCarrito(ln.producto, fresh) };
          })
        );
      }
      hidratandoMetadatosRef.current = false;
    })();

    return () => {
      cancelled = true;
    };
  }, [lineas, miSucursalId]);

  useEffect(() => {
    const id = setInterval(() => setReloj(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!ventaConfirmada) return;
    const { ventaId, totalBs, at } = ventaConfirmada;
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        new Notification("Enviado a caja", {
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
          producto: fusionarProductoCarrito(copy[idx].producto, p),
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
        window.alert(
          `${ln.producto.codigo}: Cantidad no permitida: supera el stock disponible (máx. ${ln.producto.stock}).`
        );
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
      if (precioFinal != null) {
        const chk = validarPrecioVentaBs(precioFinal, ln.producto.punto_tope);
        if (!chk.ok) {
          window.alert(`${ln.producto.codigo}: ${chk.message}`);
          return;
        }
      }
      payloadLineas.push({
        productoId: ln.producto.id,
        cantidad: q,
        precioUnitarioBs: precioExplicit,
      });
    }

    if (!cajeroDestinoId.trim()) {
      setMsg({ type: "err", text: "Elegí el cajero que atenderá esta venta en caja." });
      return;
    }
    if (esCredito && !clienteCredito) {
      setMsg({ type: "err", text: "Buscá y elegí un cliente registrado para la venta a crédito." });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/vendedor/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cajeroDestinoUsuarioId: Number(cajeroDestinoId),
          esCredito,
          clienteId: esCredito && clienteCredito ? clienteCredito.id : null,
          tipoCambioId: tipoCambio.id,
          tipoCambioSnapshot: tipoCambio.valor_bs_por_usd,
          numeroDocumento: null,
          clienteNombreLibre: esCredito ? null : clienteNombreLibre.trim() || null,
          clienteNit: esCredito ? null : clienteNit.trim() || null,
          lineas: payloadLineas,
        }),
      });
      const data = (await res.json()) as { ventaId?: number; error?: string };
      if (!res.ok) {
        setMsg({ type: "err", text: data.error ?? "No se pudo enviar la venta a caja." });
        return;
      }
      const vid = data.ventaId;
      if (vid == null || !Number.isFinite(vid)) {
        setMsg({ type: "err", text: "Respuesta inválida del servidor." });
        return;
      }
      setMsg(null);
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

  if (cajeros.length === 0) {
    return (
      <div className="rounded-xl border border-amber-500/35 bg-amber-950/30 px-4 py-3 text-sm text-amber-100" role="alert">
        No hay cajeros activos en tu sucursal. Pedile al administrador que registre un usuario con rol cajero.
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-6 text-slate-300">
      <VentaVendedorToolbar
        sucursalNombre={sucursalNombre}
        username={username}
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
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-200/90">Enviado a caja</p>
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

      {/* Cliente y envío a caja */}
      <section className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 sm:p-5">
        <h2 className="text-base font-semibold text-white">Cliente y envío a caja</h2>
        <p className="mt-1 text-xs text-slate-500">
          {esCredito
            ? "Crédito: buscá un cliente de tu directorio, enviá a caja y el cajero entrega con Nota de entrega. Pago único en caja dentro de 1 mes."
            : "Armá la lista; el cobro al contado lo registra el cajero elegido."}
        </p>
        <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-amber-100">
          <input
            type="checkbox"
            checked={esCredito}
            onChange={(e) => {
              setEsCredito(e.target.checked);
              if (!e.target.checked) setClienteCredito(null);
            }}
            className="rounded border-white/20"
          />
          Venta a crédito (cliente registrado, pago único en 1 mes)
        </label>
        <div className="mt-4 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-3 pb-1 sm:gap-x-4">
          <div className="flex shrink-0 items-center gap-2">
            <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Tipo (nota)
            </span>
            <span
              className={`${inp} inline-flex cursor-default items-center border-white/15 bg-slate-900/60 py-1.5 pl-2 pr-2.5 font-mono text-slate-200`}
              title="Tipo de comprobante"
            >
              {esCredito ? "nota_entrega" : "proforma_1"}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <label
              htmlFor="venta-cajero-destino"
              className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-slate-500"
            >
              Cajero
            </label>
            <select
              id="venta-cajero-destino"
              className={`${inp} w-auto min-w-[10rem]`}
              value={cajeroDestinoId}
              onChange={(e) => setCajeroDestinoId(e.target.value)}
              required
            >
              <option value="">Elegir cajero…</option>
              {cajeros.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.nombreCompleto}
                </option>
              ))}
            </select>
          </div>
          {esCredito ? (
            <div className="flex min-w-[16rem] flex-1 flex-col gap-1 sm:flex-row sm:items-center">
              <label className="shrink-0 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Cliente <span className="text-rose-400">*</span>
              </label>
              <ClienteCreditoBuscador
                value={clienteCredito}
                onChange={setClienteCredito}
                disabled={submitting}
              />
            </div>
          ) : (
            <>
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
            </>
          )}
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

      {/* 2 · Buscador de catálogo */}
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

      {/* 3 · Líneas de esta venta */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-amber-400/90" aria-hidden />
            <div>
              <h2 className="text-base font-semibold text-white">Líneas de esta venta</h2>
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
          onCantidadBlur={(key) => {
            const ln = lineas.find((x) => x.key === key);
            if (ln) {
              const q = parseQty(ln.cantidad);
              const stock = ln.producto.stock;
              if (stock > 0 && q > stock) {
                window.alert(
                  `Cantidad no permitida: supera el stock disponible (máx. ${stock}).`
                );
              }
            }
            setLineas((prev) =>
              prev.map((x) =>
                x.key === key
                  ? { ...x, cantidad: snapCantidadToStock(x.cantidad, x.producto.stock) }
                  : x
              )
            );
          }}
          onPrecioChange={(key, value) =>
            setLineas((prev) =>
              prev.map((x) =>
                x.key === key
                  ? {
                      ...x,
                      precioUnitBs: clampPrecioUnitBsInput(value),
                    }
                  : x
              )
            )
          }
          onPrecioBlur={(key) => {
            const ln = lineas.find((x) => x.key === key);
            if (ln) {
              const ingresado = parsePrecioUnitBsExplicito(ln.precioUnitBs);
              if (ingresado != null) {
                const chk = validarPrecioVentaBs(ingresado, ln.producto.punto_tope);
                if (!chk.ok) {
                  window.alert(chk.message);
                }
              }
            }
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
            );
          }}
          onRemove={(key) => setLineas((prev) => prev.filter((x) => x.key !== key))}
        />
      </section>


      {/* 4 · Cobro y confirmación */}
      <form onSubmit={confirmarVenta} className="space-y-5">
        <div className="flex flex-col gap-4 rounded-2xl border border-amber-500/20 bg-slate-950/60 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Total de la venta</p>
            <p className="mt-1 font-mono text-3xl font-semibold tabular-nums text-amber-50">{totales.bs.toFixed(2)}</p>
            <p className="text-sm text-amber-200/80">bolivianos</p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/5 pt-4 sm:border-t-0 sm:pt-0">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-sm text-rose-100 hover:bg-rose-900/55"
              onClick={() => {
                if (lineas.length === 0 && !clienteNombreLibre.trim() && !clienteNit.trim()) return;
                if (!confirm("¿Descartar esta venta y limpiar los datos?")) return;
                setLineas([]);
                setClienteNombreLibre("");
                setClienteNit("");
                setCajeroDestinoId(cajeros.length === 1 ? String(cajeros[0].id) : "");
                setMsg(null);
              }}
            >
              <OctagonX className="h-4 w-4" />
              Descartar
            </button>
            <button
              type="submit"
              disabled={
                submitting ||
                !tipoCambio ||
                lineas.length === 0 ||
                !cajeroDestinoId.trim() ||
                cajeros.length === 0 ||
                (esCredito && !clienteCredito)
              }
              className="inline-flex min-w-[140px] items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 pl-5 pr-6 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-900/25 transition hover:bg-amber-400 disabled:pointer-events-none disabled:opacity-40"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />
              )}
              {esCredito ? "Enviar a caja (crédito)" : "Enviar a caja"}
            </button>
          </div>
        </div>
      </form>


      </div>
    </div>
  );
}

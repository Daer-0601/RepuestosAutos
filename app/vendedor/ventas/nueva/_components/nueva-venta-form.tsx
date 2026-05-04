"use client";

import { VentaCatalogoTabla } from "@/app/vendedor/ventas/nueva/_components/venta-catalogo-tabla";
import { CATALOGO_FILAS_DEFAULT } from "@/lib/catalogo-productos-constants";
import type { ModoCatalogoVenta, ProductoVentaCompletoRow, VentaCatalogoApiRow } from "@/lib/types/venta-vendedor-catalogo";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  OctagonX,
  Plus,
  Printer,
  RotateCcw,
  ScanLine,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const inp =
  "w-full min-w-0 rounded border border-white/10 bg-slate-950/80 px-2 py-1.5 text-xs text-white outline-none placeholder:text-slate-600 focus:border-amber-500/40";

/** Inputs compactos estilo formulario clásico (salidas). */
const inpPos =
  "w-full min-w-0 rounded border border-slate-600/80 bg-slate-950/90 px-1.5 py-1 text-[11px] text-slate-100 outline-none focus:border-amber-500/50";

const cellLinea =
  "border-r border-amber-500/20 px-1.5 py-1 align-middle text-[11px] leading-snug";

type Tc = { id: number; valor_bs_por_usd: number };
type ClienteOpt = { id: number; nombre: string };

type ProductoLookup = {
  id: number;
  codigo: string;
  nombre: string;
  /** Texto largo en columna descripción (catálogo o nombre). */
  descripcionMostrar: string;
  codigoPieza: string | null;
  medida: string | null;
  stock: number;
  precio_venta_lista_bs: number | null;
  precio_venta_lista_usd: number | null;
  punto_tope: number | null;
};

type LineaCarrito = {
  key: string;
  producto: ProductoLookup;
  cantidad: string;
  precioUnitBs: string;
};

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

function subtotalLineaBs(ln: LineaCarrito): number | null {
  const q = parseQty(ln.cantidad);
  if (q < 1) return null;
  const p = parsePrecio(ln.precioUnitBs, ln.producto.precio_venta_lista_bs);
  if (p === null) return null;
  return round2(q * p);
}

function mapCompletoToLookup(p: ProductoVentaCompletoRow): ProductoLookup {
  return {
    id: p.id,
    codigo: p.codigo,
    nombre: p.nombre,
    descripcionMostrar: p.nombre,
    codigoPieza: null,
    medida: null,
    stock: p.stockMiSucursal,
    precio_venta_lista_bs: p.precio_venta_lista_bs,
    precio_venta_lista_usd: p.precio_venta_lista_usd,
    punto_tope: p.punto_tope,
  };
}

function mapCatalogRowToLookup(r: VentaCatalogoApiRow, miSucursalId: number): ProductoLookup {
  const stock = r.stocksPorSucursal.find((x) => x.sucursalId === miSucursalId)?.stock ?? 0;
  const descripcionMostrar = r.descripcion?.trim() ? r.descripcion.trim() : r.nombre;
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
  };
}

export function NuevaVentaForm() {
  const router = useRouter();
  const [loadingCtx, setLoadingCtx] = useState(true);
  const [ctxError, setCtxError] = useState<string | null>(null);
  const [miSucursalId, setMiSucursalId] = useState(0);
  const [sucursalNombre, setSucursalNombre] = useState("");
  const [tipoCambio, setTipoCambio] = useState<Tc | null>(null);
  const [clientes, setClientes] = useState<ClienteOpt[]>([]);

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

  const [lineas, setLineas] = useState<LineaCarrito[]>([]);
  const [tipoPago, setTipoPago] = useState<"efectivo" | "qr" | "tarjeta" | "credito">("efectivo");
  const [clienteId, setClienteId] = useState("");
  const [creditoFechaLimite, setCreditoFechaLimite] = useState("");
  const [numeroDocumento, setNumeroDocumento] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [username, setUsername] = useState("");
  const [reloj, setReloj] = useState(() => new Date());
  /** Solo presentación (no se persiste en venta todavía). */
  const [tipoDocumentoUi, setTipoDocumentoUi] = useState("venta");
  const [catalogoExpandido, setCatalogoExpandido] = useState(true);

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
        clientes?: ClienteOpt[];
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
      setClientes(Array.isArray(data.clientes) ? data.clientes : []);
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
      const p = parsePrecio(ln.precioUnitBs, ln.producto.precio_venta_lista_bs);
      if (p === null) continue;
      bs = round2(bs + q * p);
      if (tcVal > 0) {
        usd = round4(usd + (q * p) / tcVal);
      }
    }
    return { bs, usd };
  }, [lineas, tcVal]);

  function agregarAlCarrito(p: ProductoLookup) {
    setUltimoScanReferencia(null);
    setLineas((prev) => {
      const idx = prev.findIndex((l) => l.producto.id === p.id);
      if (idx >= 0) {
        const copy = [...prev];
        const cur = parseQty(copy[idx].cantidad);
        const max = p.stock;
        const next = Math.min(max, cur + 1);
        copy[idx] = { ...copy[idx], producto: p, cantidad: String(Math.max(1, next)) };
        return copy;
      }
      return [
        ...prev,
        {
          key: typeof crypto !== "undefined" ? crypto.randomUUID() : String(Math.random()),
          producto: p,
          cantidad: "1",
          precioUnitBs: "",
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
    setMsg({ type: "ok", text: `${p.codigo} agregado al carrito.` });
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
      setMsg({ type: "ok", text: `${p.codigo} agregado al carrito.` });
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
    if (tipoPago === "credito") {
      const cid = Number(clienteId);
      if (!Number.isFinite(cid) || cid < 1) {
        setMsg({ type: "err", text: "Elegí un cliente para venta a crédito." });
        return;
      }
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
          clienteId: clienteId.trim() !== "" ? Number(clienteId) : null,
          tipoCambioId: tipoCambio.id,
          tipoCambioSnapshot: tipoCambio.valor_bs_por_usd,
          numeroDocumento: numeroDocumento.trim() || null,
          creditoFechaLimite: tipoPago === "credito" ? creditoFechaLimite.trim() || null : null,
          lineas: payloadLineas,
        }),
      });
      const data = (await res.json()) as { ventaId?: number; error?: string };
      if (!res.ok) {
        setMsg({ type: "err", text: data.error ?? "No se pudo registrar la venta." });
        return;
      }
      setMsg({ type: "ok", text: `Venta #${data.ventaId} registrada.` });
      setLineas([]);
      setNumeroDocumento("");
      setCreditoFechaLimite("");
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
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin text-amber-400/90" />
        Cargando sucursal y tipo de cambio…
      </div>
    );
  }

  if (ctxError) {
    return <p className="text-sm text-rose-200">{ctxError}</p>;
  }

  return (
    <div className="space-y-4 text-slate-300">
      <div className="rounded-lg border-2 border-amber-600/45 bg-slate-950/80 shadow-inner shadow-black/40">
        <div className="grid min-h-[92px] gap-2 border-b border-amber-700/30 p-2 sm:grid-cols-[minmax(96px,1fr)_auto_minmax(128px,1.1fr)] sm:items-stretch">
          <div className="flex min-h-[64px] items-center justify-center border border-amber-800/40 bg-black/40 px-2 py-2">
            <span className="max-w-full text-center text-lg font-bold uppercase leading-tight text-red-400 sm:text-xl">
              {sucursalNombre || "—"}
            </span>
          </div>
          <div className="flex flex-col items-center justify-center px-3 py-2">
            <span className="text-2xl font-black tracking-[0.18em] text-amber-100 drop-shadow-sm sm:text-3xl">
              SALIDAS
            </span>
            <span className="mt-0.5 font-mono text-[10px] text-slate-500">Sucursal #{miSucursalId}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 border border-slate-700/60 bg-slate-900/60 p-2 text-[10px] uppercase leading-tight">
            <span className="text-slate-500">Usuario</span>
            <span className="truncate text-right font-mono text-amber-100/90 normal-case">{username || "—"}</span>
            <span className="text-slate-500">Fecha</span>
            <span className="text-right font-mono normal-case">{fechaHoraStr.fecha}</span>
            <span className="text-slate-500">Hora</span>
            <span className="text-right font-mono normal-case">{fechaHoraStr.hora}</span>
            <span className="text-slate-500">Tipo cambio</span>
            <span className="text-right font-mono normal-case">
              {tipoCambio ? `${tipoCambio.valor_bs_por_usd.toFixed(2)} Bs/USD` : "Sin TC"}
            </span>
          </div>
        </div>
      </div>

      {msg ? (
        <p
          className={`rounded-xl border px-4 py-3 text-sm ${
            msg.type === "ok"
              ? "border-emerald-500/30 bg-emerald-950/35 text-emerald-100"
              : "border-rose-500/30 bg-rose-950/40 text-rose-100"
          }`}
          role="alert"
        >
          {msg.type === "ok" ? <CheckCircle2 className="mb-1 inline h-4 w-4 align-text-bottom opacity-90" /> : null}{" "}
          {msg.text}
        </p>
      ) : null}

      <form onSubmit={confirmarVenta} className="space-y-3">
        <div className="rounded-lg border border-amber-700/35 bg-slate-950/50 p-2">
          <div className="grid gap-2 sm:grid-cols-12">
            <div className="sm:col-span-2">
              <label className="block text-[9px] font-bold uppercase text-slate-500">Tipo doc.</label>
              <select
                value={tipoDocumentoUi}
                onChange={(e) => setTipoDocumentoUi(e.target.value)}
                className={`${inpPos} mt-0.5`}
              >
                <option value="venta">Venta</option>
                <option value="presupuesto">Presupuesto</option>
                <option value="nota">Nota</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[9px] font-bold uppercase text-slate-500">Nº doc. / ref.</label>
              <input
                className={`${inpPos} mt-0.5 font-mono`}
                value={numeroDocumento}
                onChange={(e) => setNumeroDocumento(e.target.value)}
              />
            </div>
            <div className="sm:col-span-4">
              <label className="block text-[9px] font-bold uppercase text-slate-500">Nombre cliente</label>
              <select
                className={`${inpPos} mt-0.5`}
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                required={tipoPago === "credito"}
              >
                <option value="">—</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end sm:col-span-2">
              <label className="flex cursor-pointer items-center gap-2 rounded border border-slate-600/70 bg-slate-900/80 px-2 py-1.5 text-[11px]">
                <input
                  type="checkbox"
                  className="accent-amber-500"
                  checked={tipoPago === "credito"}
                  onChange={(e) => {
                    if (e.target.checked) setTipoPago("credito");
                    else setTipoPago("efectivo");
                  }}
                />
                Crédito
              </label>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[9px] font-bold uppercase text-slate-500">Forma pago</label>
              <select
                className={`${inpPos} mt-0.5`}
                value={tipoPago}
                onChange={(e) => setTipoPago(e.target.value as typeof tipoPago)}
              >
                <option value="efectivo">Efectivo</option>
                <option value="qr">QR</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="credito">Crédito</option>
              </select>
            </div>
          </div>
          {tipoPago === "credito" ? (
            <div className="mt-2 max-w-xs">
              <label className="block text-[9px] font-bold uppercase text-slate-500">Fecha límite crédito</label>
              <input
                type="date"
                className={`${inpPos} mt-0.5`}
                value={creditoFechaLimite}
                onChange={(e) => setCreditoFechaLimite(e.target.value)}
              />
            </div>
          ) : null}
        </div>

        <div className="overflow-x-auto rounded-lg border border-amber-700/35 bg-slate-950/60">
          <table className="w-max min-w-full border-collapse text-left">
            <thead className="border-b border-amber-600/40 bg-slate-900/95 text-[9px] font-bold uppercase tracking-tight text-slate-500">
              <tr>
                <th className={`${cellLinea} w-7 text-center`} title="Quitar">
                  {" "}
                </th>
                <th className={`${cellLinea} min-w-[72px]`}>Código</th>
                <th className={`${cellLinea} min-w-[56px]`}>Nom. ref.</th>
                <th className={`${cellLinea} min-w-[48px]`}>Med.</th>
                <th className={`${cellLinea} min-w-[200px]`}>Descripción</th>
                <th className={`${cellLinea} w-[52px] text-right`}>Cant.</th>
                <th className={`${cellLinea} w-[44px] text-right`}>St.</th>
                <th className={`${cellLinea} min-w-[84px] text-right`}>Precio Bs</th>
                <th className={`${cellLinea} min-w-[72px] text-right`}>Parcial</th>
                <th className={`${cellLinea} w-10 border-r-0 text-center`} />
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-900/30">
              {lineas.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-xs text-slate-500">
                    Sin líneas. Escanear código abajo o buscar en el catálogo.
                  </td>
                </tr>
              ) : (
                lineas.map((ln) => {
                  const sub = subtotalLineaBs(ln);
                  return (
                    <tr key={ln.key} className="bg-slate-950/40">
                      <td className={`${cellLinea} text-center text-slate-600`} />
                      <td className={`${cellLinea} font-mono text-amber-200/90`}>{ln.producto.codigo}</td>
                      <td className={`${cellLinea} font-mono text-slate-400`}>
                        {ln.producto.codigoPieza?.trim()
                          ? ln.producto.codigoPieza.length > 12
                            ? `${ln.producto.codigoPieza.slice(0, 12)}…`
                            : ln.producto.codigoPieza
                          : "—"}
                      </td>
                      <td className={`${cellLinea} font-mono text-slate-400`}>{ln.producto.medida?.trim() || "—"}</td>
                      <td className={`${cellLinea} max-w-[320px]`}>
                        <span className="line-clamp-2 text-slate-100" title={ln.producto.descripcionMostrar}>
                          {ln.producto.descripcionMostrar}
                        </span>
                      </td>
                      <td className={`${cellLinea} text-right`}>
                        <input
                          className={`${inpPos} w-full text-right font-mono`}
                          inputMode="numeric"
                          value={ln.cantidad}
                          onChange={(e) =>
                            setLineas((prev) =>
                              prev.map((x) => (x.key === ln.key ? { ...x, cantidad: e.target.value } : x))
                            )
                          }
                        />
                      </td>
                      <td className={`${cellLinea} text-right font-mono text-emerald-200/80`}>{ln.producto.stock}</td>
                      <td className={`${cellLinea} text-right`}>
                        <input
                          className={`${inpPos} w-full text-right font-mono`}
                          placeholder={
                            ln.producto.precio_venta_lista_bs != null
                              ? ln.producto.precio_venta_lista_bs.toFixed(2)
                              : "—"
                          }
                          value={ln.precioUnitBs}
                          onChange={(e) =>
                            setLineas((prev) =>
                              prev.map((x) => (x.key === ln.key ? { ...x, precioUnitBs: e.target.value } : x))
                            )
                          }
                        />
                        {ln.producto.punto_tope != null ? (
                          <p className="mt-0.5 text-[9px] text-amber-200/70">Tope {ln.producto.punto_tope.toFixed(2)}</p>
                        ) : null}
                      </td>
                      <td className={`${cellLinea} text-right font-mono text-slate-200`}>
                        {sub != null ? sub.toFixed(2) : "—"}
                      </td>
                      <td className={`${cellLinea} border-r-0 text-center`}>
                        <button
                          type="button"
                          className="rounded p-1 text-slate-500 hover:bg-rose-500/15 hover:text-rose-200"
                          aria-label="Quitar"
                          onClick={() => setLineas((prev) => prev.filter((x) => x.key !== ln.key))}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-amber-800/25 pt-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-wrap items-end gap-4">
            <div className="rounded border border-slate-600/60 bg-slate-900/70 px-3 py-2">
              <p className="text-[9px] font-bold uppercase text-slate-500">Descuentos</p>
              <p className="mt-1 font-mono text-sm text-slate-400">0%</p>
            </div>
            <div className="rounded border border-amber-700/40 bg-black/30 px-4 py-2 text-right">
              <p className="text-[9px] font-bold uppercase text-slate-500">Sub total</p>
              <p className="font-mono text-lg text-amber-50">{totales.bs.toFixed(2)} Bs</p>
              {tcVal > 0 ? (
                <p className="font-mono text-xs text-slate-400">{totales.usd.toFixed(4)} USD</p>
              ) : null}
              <p className="mt-2 text-[9px] font-bold uppercase text-slate-500">Descuento Bs</p>
              <p className="font-mono text-sm text-slate-400">0.00</p>
              <p className="mt-2 text-[9px] font-bold uppercase text-amber-200/90">Sumar</p>
              <p className="font-mono text-xl font-semibold text-amber-100">{totales.bs.toFixed(2)} Bs</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-3 sm:border-t-0 sm:pt-0">
            <button
              type="button"
              disabled
              title="Próximamente"
              className="inline-flex items-center gap-1.5 rounded border border-white/10 bg-slate-900/80 px-2.5 py-1.5 text-[11px] text-slate-500"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Devolución
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded border border-white/10 bg-slate-900/80 px-2.5 py-1.5 text-[11px] text-slate-300 hover:bg-white/5"
              onClick={() => window.print()}
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir
            </button>
            <button
              type="submit"
              disabled={submitting || !tipoCambio || lineas.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/25 px-4 py-2 text-sm font-semibold text-amber-50 ring-1 ring-amber-500/40 hover:bg-amber-500/35 disabled:opacity-40"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 opacity-90" />}
              Confirmar
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5"
              onClick={() => {
                if (lineas.length === 0) return;
                if (!confirm("¿Vaciar todas las líneas del comprobante?")) return;
                setLineas([]);
                setMsg(null);
              }}
            >
              <Trash2 className="h-4 w-4" />
              Vaciar
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-600/50 bg-rose-950/40 px-3 py-2 text-sm font-medium text-rose-100 hover:bg-rose-900/50"
              onClick={() => {
                if (lineas.length === 0) return;
                if (!confirm("¿Descartar el comprobante actual?")) return;
                setLineas([]);
                setNumeroDocumento("");
                setClienteId("");
                setCreditoFechaLimite("");
                setTipoPago("efectivo");
                setMsg(null);
              }}
            >
              <OctagonX className="h-4 w-4" />
              Stop
            </button>
            <Link
              href="/vendedor/ventas"
              className="inline-flex items-center rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 hover:border-white/20 hover:text-white"
            >
              Historial
            </Link>
          </div>
        </div>
      </form>

      <section className="space-y-2 border-t border-white/10 pt-4">
        <button
          type="button"
          onClick={() => setCatalogoExpandido((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg border border-amber-700/30 bg-slate-900/40 px-3 py-2 text-left text-sm font-medium text-amber-100/90 hover:bg-slate-900/60"
        >
          <span>Catálogo y filtros (admin)</span>
          {catalogoExpandido ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {catalogoExpandido ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <div className="lg:col-span-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Buscar (texto)</label>
                  <input
                    name="q"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Una palabra: flexible. Dos+: todas deben aparecer (en cualquier campo)"
                    className={`${inp} mt-1`}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Código / QR exacto</label>
                  <input
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    placeholder="Ej. 1000 o 001000"
                    className={`${inp} mt-1`}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Código pieza</label>
                  <input
                    value={codigoPieza}
                    onChange={(e) => setCodigoPieza(e.target.value)}
                    placeholder="OEM / referencia"
                    className={`${inp} mt-1`}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Especificación</label>
                  <input
                    value={especificacion}
                    onChange={(e) => setEspecificacion(e.target.value)}
                    className={`${inp} mt-1`}
                  />
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
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Modo stock</label>
                  <select
                    value={modoCatalogo}
                    onChange={(e) => setModoCatalogo(e.target.value as ModoCatalogoVenta)}
                    className={`${inp} mt-1`}
                  >
                    <option value="mi_sucursal">Solo vendibles acá (stock en mi sucursal)</option>
                    <option value="referencia">Referencia: con stock en alguna sucursal</option>
                    <option value="todos">Todos los activos (ver también sin stock)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Filas máx.</label>
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
                  type="button"
                  disabled={catalogLoading}
                  onClick={() => void ejecutarBusquedaCatalogo()}
                  className="rounded-lg bg-amber-600/90 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-40"
                >
                  {catalogLoading ? "Buscando…" : "Buscar"}
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
                    setModoCatalogo("mi_sucursal");
                    setPerPage(String(CATALOGO_FILAS_DEFAULT));
                  }}
                >
                  Limpiar filtros
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              {catalogLoading
                ? "…"
                : !catalogBuscado
                  ? "Pulsá «Buscar» para consultar el catálogo (misma lógica de filtros que en admin)."
                  : catalogTotal === 0
                    ? "Sin resultados con estos filtros."
                    : `Mostrando ${catalogRows.length} de ${catalogTotal} producto(s). Columnas de sucursal: stock disponible; resaltamos la tuya.`}
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

      <section className="space-y-3 border-t border-white/10 pt-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-200/80">Código o QR rápido</h2>
        <form onSubmit={buscarProducto} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Escanear o pegar
            </label>
            <div className="relative">
              <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-400/50" />
              <input
                className={`${inp} rounded-lg pl-10 py-2`}
                value={codigoBuscar}
                onChange={(e) => setCodigoBuscar(e.target.value)}
                placeholder="Enter para agregar si hay stock en tu sucursal"
                autoComplete="off"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={buscando || !codigoBuscar.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500/20 px-5 py-2 text-sm font-medium text-amber-100 ring-1 ring-amber-500/35 transition hover:bg-amber-500/30 disabled:opacity-40"
          >
            {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Agregar
          </button>
        </form>

        {ultimoScanReferencia ? (
          <div className="rounded-xl border border-amber-500/25 bg-amber-950/20 p-4 text-sm text-slate-300">
            <p className="font-medium text-amber-100/90">
              {ultimoScanReferencia.codigo} · stock en otras sucursales
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Lista Bs: {ultimoScanReferencia.precio_venta_lista_bs?.toFixed(2) ?? "—"} · Tope:{" "}
              {ultimoScanReferencia.punto_tope?.toFixed(2) ?? "—"}
            </p>
            <ul className="mt-3 grid gap-1 sm:grid-cols-2">
              {ultimoScanReferencia.porSucursal.map((s) => (
                <li
                  key={s.sucursalId}
                  className={`flex justify-between gap-2 rounded-lg border border-white/5 px-2 py-1 font-mono text-xs ${
                    s.sucursalId === miSucursalId ? "border-amber-500/30 bg-amber-500/10" : ""
                  }`}
                >
                  <span className="truncate text-slate-400">{s.sucursalNombre}</span>
                  <span className={s.stock > 0 ? "text-emerald-300" : "text-slate-600"}>{s.stock}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}

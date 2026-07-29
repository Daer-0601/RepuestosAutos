"use client";

import {
  VentaCarritoTabla,
  type VentaCarritoLinea,
  type VentaCarritoProducto,
} from "@/app/vendedor/ventas/nueva/_components/venta-carrito-tabla";
import { VentaCatalogoTabla } from "@/app/vendedor/ventas/nueva/_components/venta-catalogo-tabla";
import { UsbBarcodeScanField } from "@/app/vendedor/_components/usb-barcode-scan-field";
import { CATALOGO_FILAS_DEFAULT } from "@/lib/catalogo-productos-constants";
import type { ModoCatalogoVenta, ProductoVentaCompletoRow, VentaCatalogoApiRow } from "@/lib/types/venta-vendedor-catalogo";
import {
  carritoProductoSinMetadatos,
  clampPrecioUnitBsInput,
  defaultPrecioUnitBsStr,
  fusionarProductoCarrito,
  mapCatalogRowToLookup,
  mapCompletoToLookup,
  nuevaLineaCarrito,
  parsePrecioUnitBsExplicito,
  parseQty,
  precioUnitLineaEfectivo,
  round2,
  round4,
  snapCantidadMinima,
  snapPrecioUnitBsToRange,
  subtotalLineaBs,
} from "@/lib/vendedor/venta-carrito-helpers";
import { validarPrecioVentaBs } from "@/lib/venta-precio-lista-tope-range";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  Send,
  ShoppingBag,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const inp =
  "w-full min-w-0 rounded border border-white/10 bg-slate-950/80 px-2 py-1.5 text-xs text-white outline-none placeholder:text-slate-600 focus:border-amber-500/40";

const inpPos =
  "w-full min-w-0 rounded border border-slate-600/80 bg-slate-950/90 px-1.5 py-1 text-[11px] text-slate-100 outline-none focus:border-amber-500/50";

type Tc = { id: number; valor_bs_por_usd: number };

export function CotizacionesPanel() {
  const [ctxLoading, setCtxLoading] = useState(true);
  const [miSucursalId, setMiSucursalId] = useState(0);
  const [tipoCambio, setTipoCambio] = useState<Tc | null>(null);

  const [q, setQ] = useState("");
  const [codigo, setCodigo] = useState("");
  const [codigoPieza, setCodigoPieza] = useState("");
  const [especificacion, setEspecificacion] = useState("");
  const [medida, setMedida] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [repuesto, setRepuesto] = useState("");
  const [modoCatalogo, setModoCatalogo] = useState<ModoCatalogoVenta>("todos");
  const [perPage, setPerPage] = useState(String(CATALOGO_FILAS_DEFAULT));

  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogBuscado, setCatalogBuscado] = useState(false);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [catalogSucursales, setCatalogSucursales] = useState<{ id: number; nombre: string }[]>([]);
  const [catalogRows, setCatalogRows] = useState<VentaCatalogoApiRow[]>([]);
  const [catalogoExpandido, setCatalogoExpandido] = useState(true);

  const [codigoBuscar, setCodigoBuscar] = useState("");
  const [buscando, setBuscando] = useState(false);

  const [lineas, setLineas] = useState<VentaCarritoLinea[]>([]);
  const [cajeros, setCajeros] = useState<{ id: number; nombreCompleto: string; username: string }[]>([]);
  const [cajeroDestinoId, setCajeroDestinoId] = useState("");
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteNit, setClienteNit] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cotizacionEnviada, setCotizacionEnviada] = useState<{ id: number; totalBs: string } | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const metadatosHidratadosRef = useRef(new Set<number>());
  const hidratandoMetadatosRef = useRef(false);

  const loadContext = useCallback(async () => {
    setCtxLoading(true);
    try {
      const res = await fetch("/api/vendedor/cotizaciones", { cache: "no-store" });
      const data = (await res.json()) as {
        sucursalId?: number;
        tipoCambio?: Tc | null;
        sucursalNombre?: string;
        cajeros?: { id: number; nombreCompleto: string; username: string }[];
        error?: string;
      };
      if (!res.ok) {
        setMsg({ type: "err", text: data.error ?? "No se pudo cargar el contexto." });
        return;
      }
      setMiSucursalId(Number(data.sucursalId ?? 0));
      setTipoCambio(data.tipoCambio ?? null);
      const listaCajeros = Array.isArray(data.cajeros) ? data.cajeros : [];
      setCajeros(listaCajeros);
      setCajeroDestinoId((prev) => {
        if (prev && listaCajeros.some((c) => String(c.id) === prev)) return prev;
        return listaCajeros.length === 1 ? String(listaCajeros[0].id) : "";
      });
    } catch {
      setMsg({ type: "err", text: "Error de red al cargar cotizaciones." });
    } finally {
      setCtxLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

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

  useEffect(() => {
    if (!miSucursalId || lineas.length === 0 || hidratandoMetadatosRef.current) return;
    const pending = lineas.filter(
      (ln) =>
        carritoProductoSinMetadatos(ln.producto) && !metadatosHidratadosRef.current.has(ln.producto.id)
    );
    if (pending.length === 0) return;

    hidratandoMetadatosRef.current = true;
    let cancelled = false;

    void (async () => {
      const updates = new Map<number, VentaCarritoProducto>();
      for (const ln of pending) {
        if (cancelled) break;
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
          /* omitir */
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

  const tcVal = tipoCambio?.valor_bs_por_usd ?? 0;

  const totales = useMemo(() => {
    let bs = 0;
    let usd = 0;
    for (const ln of lineas) {
      const st = subtotalLineaBs(ln);
      if (st !== null) bs = round2(bs + st);
    }
    if (tcVal > 0) usd = round4(bs / tcVal);
    return { bs, usd, tc: tcVal };
  }, [lineas, tcVal]);

  function agregarAlCarrito(p: VentaCarritoProducto) {
    setLineas((prev) => {
      const idx = prev.findIndex((l) => l.producto.id === p.id);
      if (idx >= 0) {
        const copy = [...prev];
        const cur = parseQty(copy[idx].cantidad);
        const prevPrecio = copy[idx].precioUnitBs.trim();
        copy[idx] = {
          ...copy[idx],
          producto: fusionarProductoCarrito(copy[idx].producto, p),
          cantidad: String(Math.max(1, cur + 1)),
          precioUnitBs: prevPrecio === "" ? defaultPrecioUnitBsStr(p) : copy[idx].precioUnitBs,
        };
        return copy;
      }
      return [...prev, nuevaLineaCarrito(p)];
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
    agregarAlCarrito(mapCatalogRowToLookup(row, miSucursalId));
  }

  async function buscarProductoPorCodigo(rawIn: string) {
    setMsg(null);
    const raw = rawIn.trim();
    if (!raw) return;
    setBuscando(true);
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
      agregarAlCarrito(mapCompletoToLookup(data.producto));
      setCodigoBuscar("");
      setMsg(null);
    } catch {
      setMsg({ type: "err", text: "Error de red al buscar." });
    } finally {
      setBuscando(false);
    }
  }

  async function enviarACaja() {
    if (lineas.length === 0) {
      setMsg({ type: "err", text: "Agregá al menos un producto." });
      return;
    }
    if (!tipoCambio) {
      setMsg({ type: "err", text: "No hay tipo de cambio cargado." });
      return;
    }
    if (!cajeroDestinoId.trim()) {
      setMsg({ type: "err", text: "Elegí el cajero que imprimirá la cotización." });
      return;
    }

    const payloadLineas: { productoId: number; cantidad: number; precioUnitarioBs: number }[] = [];
    for (const ln of lineas) {
      const q = parseQty(ln.cantidad);
      if (q < 1) {
        setMsg({ type: "err", text: `Cantidad inválida para ${ln.producto.codigo}.` });
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
      const p = precioUnitLineaEfectivo(ln);
      if (p === null) {
        setMsg({ type: "err", text: `Precio inválido para ${ln.producto.codigo}.` });
        return;
      }
      payloadLineas.push({
        productoId: ln.producto.id,
        cantidad: q,
        precioUnitarioBs: p,
      });
    }

    setSubmitting(true);
    setMsg(null);
    setCotizacionEnviada(null);
    try {
      const res = await fetch("/api/vendedor/cotizaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cajeroDestinoUsuarioId: Number(cajeroDestinoId),
          clienteNombre: clienteNombre.trim() || null,
          clienteNit: clienteNit.trim() || null,
          tipoCambioId: tipoCambio.id,
          tipoCambioSnapshot: tipoCambio.valor_bs_por_usd,
          lineas: payloadLineas,
        }),
      });
      const data = (await res.json()) as { cotizacionId?: number; error?: string };
      if (!res.ok) {
        setMsg({ type: "err", text: data.error ?? "No se pudo enviar la cotización a caja." });
        return;
      }
      const cid = data.cotizacionId;
      if (cid == null || !Number.isFinite(cid)) {
        setMsg({ type: "err", text: "Respuesta inválida del servidor." });
        return;
      }
      setCotizacionEnviada({ id: cid, totalBs: totales.bs.toFixed(2) });
      setLineas([]);
      setClienteNombre("");
      setClienteNit("");
    } catch {
      setMsg({ type: "err", text: "Error de red al enviar." });
    } finally {
      setSubmitting(false);
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

  if (cajeros.length === 0) {
    return (
      <div className="rounded-xl border border-amber-500/35 bg-amber-950/30 px-4 py-3 text-sm text-amber-100" role="alert">
        No hay cajeros activos en tu sucursal. Pedile al administrador que registre un usuario con rol cajero.
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-300">
      {cotizacionEnviada ? (
        <div
          className="rounded-xl border border-emerald-500/35 bg-emerald-950/25 px-4 py-3 text-sm text-emerald-100"
          role="status"
        >
          Cotización #{cotizacionEnviada.id} enviada a caja ({cotizacionEnviada.totalBs} Bs). El cajero la imprimirá
          para el cliente.
        </div>
      ) : null}

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
              Los importes en USD de la cotización usan este valor (también en la hoja de impresión).
            </p>
          </div>
          {tipoCambio ? (
            <p className="font-mono text-lg font-semibold tabular-nums text-amber-100">
              {tipoCambio.valor_bs_por_usd.toFixed(4)}{" "}
              <span className="text-xs font-normal text-slate-500">Bs/USD</span>
            </p>
          ) : (
            <p className="text-sm text-amber-200/90">No hay tipo de cambio cargado.</p>
          )}
        </div>
      </div>

      <section className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 sm:p-5">
        <h2 className="text-base font-semibold text-white">Cliente y envío a caja</h2>
        <p className="mt-1 text-xs text-slate-500">
          Armá la cotización; el cajero elegido la imprimirá para el cliente.
        </p>
        <div className="mt-4 flex min-w-0 flex-wrap items-end gap-4">
          <div className="min-w-[10rem]">
            <label
              htmlFor="cot-cajero"
              className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500"
            >
              Cajero
            </label>
            <select
              id="cot-cajero"
              className={`${inp} mt-1`}
              value={cajeroDestinoId}
              onChange={(e) => setCajeroDestinoId(e.target.value)}
            >
              <option value="">Elegir cajero…</option>
              {cajeros.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.nombreCompleto}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[12rem] flex-1">
            <label
              htmlFor="cot-cliente"
              className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500"
            >
              Cliente <span className="font-normal normal-case text-slate-600">(opcional)</span>
            </label>
            <input
              id="cot-cliente"
              className={`${inp} mt-1`}
              value={clienteNombre}
              onChange={(e) => setClienteNombre(e.target.value)}
              placeholder="Nombre o razón social"
            />
          </div>
          <div className="min-w-[8rem]">
            <label htmlFor="cot-nit" className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              NIT <span className="font-normal normal-case text-slate-600">(opcional)</span>
            </label>
            <input
              id="cot-nit"
              className={`${inp} mt-1 font-mono`}
              value={clienteNit}
              onChange={(e) => setClienteNit(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-amber-500/25 bg-gradient-to-b from-amber-500/[0.07] to-slate-950/40 p-4 sm:p-5">
        <h2 className="text-base font-semibold text-white">Agregar con lector QR / código</h2>
        <p className="mt-1 max-w-2xl text-xs text-slate-500">
          Conectá el ZKB209 por USB. En cotización podés incluir cualquier producto activo, tengas o no stock.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <UsbBarcodeScanField
            className="min-w-0 flex-1"
            value={codigoBuscar}
            onChange={setCodigoBuscar}
            onSubmitCodigo={buscarProductoPorCodigo}
            disabled={buscando || submitting}
            inputClassName={`${inp} h-12 rounded-xl border-amber-500/25 bg-slate-950/90 pl-12 pr-4 text-sm shadow-inner shadow-black/30 placeholder:text-slate-600 focus:border-amber-500/50`}
          />
          <button
            type="button"
            disabled={buscando || !codigoBuscar.trim()}
            onClick={() => void buscarProductoPorCodigo(codigoBuscar)}
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-900/20 transition hover:bg-amber-400 disabled:pointer-events-none disabled:opacity-40"
          >
            {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" strokeWidth={2.5} />}
            Agregar
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <button
          type="button"
          onClick={() => setCatalogoExpandido((v) => !v)}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-left transition hover:border-amber-500/30 hover:bg-slate-900/60"
        >
          <div>
            <p className="text-sm font-semibold text-white">Buscador de repuestos</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Misma tabla que nueva venta; el stock es solo referencia y no bloquea agregar líneas.
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
                    className={`${inp} mt-1 font-mono`}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Cód. pieza</label>
                  <input value={codigoPieza} onChange={(e) => setCodigoPieza(e.target.value)} className={`${inp} mt-1`} />
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
                    setModoCatalogo("todos");
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
                    : `Mostrando ${catalogRows.length} de ${catalogTotal} producto(s).`}
            </p>
            <VentaCatalogoTabla
              miSucursalId={miSucursalId}
              sucursales={catalogSucursales}
              rows={catalogRows}
              loading={catalogLoading}
              sinConsulta={!catalogBuscado}
              permitirSinStock
              onAgregar={onAgregarDesdeTabla}
            />
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-amber-400/90" aria-hidden />
            <h2 className="text-base font-semibold text-white">Líneas de la cotización</h2>
          </div>
          <p className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 font-mono text-xs text-slate-400">
            {lineas.length === 0 ? "Vacío" : `${lineas.length} ítem${lineas.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <VentaCarritoTabla
          lineas={lineas}
          inpPosClass={inpPos}
          modoCotizacion
          subtotalLineaBs={subtotalLineaBs}
          onCantidadChange={(key, value) =>
            setLineas((prev) => prev.map((x) => (x.key === key ? { ...x, cantidad: value } : x)))
          }
          onCantidadBlur={(key) =>
            setLineas((prev) =>
              prev.map((x) => (x.key === key ? { ...x, cantidad: snapCantidadMinima(x.cantidad) } : x))
            )
          }
          onPrecioChange={(key, value) =>
            setLineas((prev) =>
              prev.map((x) => (x.key === key ? { ...x, precioUnitBs: clampPrecioUnitBsInput(value) } : x))
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

        <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-amber-500/20 bg-slate-950/60 p-4 sm:p-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Total cotización</p>
            <p className="mt-1 font-mono text-3xl font-semibold tabular-nums text-amber-50">{totales.bs.toFixed(2)}</p>
            <p className="text-sm text-amber-200/80">bolivianos</p>
            {totales.tc > 0 ? (
              <p className="mt-1 font-mono text-sm text-slate-400">≈ {totales.usd.toFixed(4)} USD</p>
            ) : null}
          </div>
          <button
            type="button"
            disabled={
              submitting || lineas.length === 0 || !tipoCambio || !cajeroDestinoId.trim() || cajeros.length === 0
            }
            onClick={() => void enviarACaja()}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
            Enviar a caja
          </button>
        </div>
      </section>
    </div>
  );
}

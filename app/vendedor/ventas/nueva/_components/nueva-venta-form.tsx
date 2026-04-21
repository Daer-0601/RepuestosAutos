"use client";

import { VentaCatalogoTabla } from "@/app/vendedor/ventas/nueva/_components/venta-catalogo-tabla";
import type { ModoCatalogoVenta, ProductoVentaCompletoRow, VentaCatalogoApiRow } from "@/lib/types/venta-vendedor-catalogo";
import { CheckCircle2, Loader2, Plus, ScanLine, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const inp =
  "w-full min-w-0 rounded border border-white/10 bg-slate-950/80 px-2 py-1.5 text-xs text-white outline-none placeholder:text-slate-600 focus:border-amber-500/40";

type Tc = { id: number; valor_bs_por_usd: number };
type ClienteOpt = { id: number; nombre: string };

type ProductoLookup = {
  id: number;
  codigo: string;
  nombre: string;
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

function mapCompletoToLookup(p: ProductoVentaCompletoRow): ProductoLookup {
  return {
    id: p.id,
    codigo: p.codigo,
    nombre: p.nombre,
    stock: p.stockMiSucursal,
    precio_venta_lista_bs: p.precio_venta_lista_bs,
    precio_venta_lista_usd: p.precio_venta_lista_usd,
    punto_tope: p.punto_tope,
  };
}

function mapCatalogRowToLookup(r: VentaCatalogoApiRow, miSucursalId: number): ProductoLookup {
  const stock = r.stocksPorSucursal.find((x) => x.sucursalId === miSucursalId)?.stock ?? 0;
  return {
    id: r.id,
    codigo: r.codigo,
    nombre: r.nombre,
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
  const [perPage, setPerPage] = useState("40");

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

  const tcVal = tipoCambio?.valor_bs_por_usd ?? 0;

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
        copy[idx] = { ...copy[idx], cantidad: String(Math.max(1, next)) };
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
          perPage: Number.isFinite(per) && per >= 10 ? per : 40,
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

  async function buscarCatalogo(e: React.FormEvent) {
    e.preventDefault();
    await ejecutarBusquedaCatalogo();
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
    <div className="space-y-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-slate-400">
        <p>
          Tu sucursal:{" "}
          <span className="font-medium text-amber-100/90">{sucursalNombre}</span>
          <span className="ml-2 font-mono text-[11px] text-slate-500">#{miSucursalId}</span>
        </p>
        {tipoCambio ? (
          <p className="font-mono text-xs text-slate-300">
            TC: 1 USD = {tipoCambio.valor_bs_por_usd.toFixed(4)} Bs
          </p>
        ) : (
          <p className="text-amber-200/90">Sin tipo de cambio — no podés confirmar ventas.</p>
        )}
      </div>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-200/80">Catálogo (mismos criterios que admin)</h2>
        <form onSubmit={buscarCatalogo} className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <div className="lg:col-span-2">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Buscar (texto)</label>
              <input
                name="q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nombre, descripción, pieza… (palabras sueltas)"
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
              type="submit"
              disabled={catalogLoading}
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
                setPerPage("40");
              }}
            >
              Limpiar filtros
            </button>
          </div>
        </form>

        <p className="text-xs text-slate-500">
          {catalogLoading
            ? "…"
            : !catalogBuscado
              ? "Pulsá «Buscar» para consultar el catálogo (misma lógica de filtros que en admin)."
              : catalogTotal === 0
                ? "Sin resultados con estos filtros."
                : `Mostrando ${catalogRows.length} de ${catalogTotal} producto(s). Columnas de sucursal: stock disponible; resaltamos la tuya. P. tope = máximo permitido por política.`}
        </p>

        <VentaCatalogoTabla
          miSucursalId={miSucursalId}
          sucursales={catalogSucursales}
          rows={catalogRows}
          loading={catalogLoading}
          sinConsulta={!catalogBuscado}
          onAgregar={onAgregarDesdeTabla}
        />
      </section>

      <section className="space-y-3 border-t border-white/10 pt-8">
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

      <section className="space-y-4 border-t border-white/10 pt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-200/80">Carrito y cobro</h2>
        {lineas.length === 0 ? (
          <p className="text-sm text-slate-500">El carrito está vacío.</p>
        ) : (
          <form onSubmit={confirmarVenta} className="space-y-6">
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="border-b border-white/10 bg-black/25 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Producto</th>
                    <th className="w-24 px-3 py-2 font-medium">Cant.</th>
                    <th className="w-36 px-3 py-2 font-medium">P. unit. Bs</th>
                    <th className="w-10 px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {lineas.map((ln) => (
                    <tr key={ln.key} className="align-top">
                      <td className="px-3 py-2">
                        <p className="font-mono text-xs text-amber-200/80">{ln.producto.codigo}</p>
                        <p className="text-slate-200">{ln.producto.nombre}</p>
                        <p className="mt-0.5 text-xs text-slate-500">Stock en tu sucursal: {ln.producto.stock}</p>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className={`${inp} w-20 rounded-lg font-mono`}
                          inputMode="numeric"
                          value={ln.cantidad}
                          onChange={(e) =>
                            setLineas((prev) =>
                              prev.map((x) => (x.key === ln.key ? { ...x, cantidad: e.target.value } : x))
                            )
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className={`${inp} rounded-lg font-mono`}
                          placeholder={
                            ln.producto.precio_venta_lista_bs != null
                              ? `Lista ${ln.producto.precio_venta_lista_bs.toFixed(2)}`
                              : "Obligatorio"
                          }
                          value={ln.precioUnitBs}
                          onChange={(e) =>
                            setLineas((prev) =>
                              prev.map((x) => (x.key === ln.key ? { ...x, precioUnitBs: e.target.value } : x))
                            )
                          }
                        />
                        {ln.producto.punto_tope != null ? (
                          <p className="mt-1 text-[11px] text-slate-500">
                            Tope máx.: {ln.producto.punto_tope.toFixed(2)} Bs
                          </p>
                        ) : null}
                      </td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          className="rounded-lg p-2 text-slate-500 hover:bg-rose-500/15 hover:text-rose-200"
                          aria-label="Quitar"
                          onClick={() => setLineas((prev) => prev.filter((x) => x.key !== ln.key))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-end justify-between gap-4 border-t border-white/10 pt-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Total estimado</p>
                <p className="mt-1 font-mono text-lg text-white">{totales.bs.toFixed(2)} Bs</p>
                {tcVal > 0 ? (
                  <p className="font-mono text-sm text-slate-400">{totales.usd.toFixed(4)} USD</p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Tipo de pago
                </label>
                <select
                  className={`${inp} rounded-lg py-2`}
                  value={tipoPago}
                  onChange={(e) => setTipoPago(e.target.value as typeof tipoPago)}
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="qr">QR</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="credito">Crédito</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Nº documento (opcional)
                </label>
                <input
                  className={`${inp} rounded-lg py-2`}
                  value={numeroDocumento}
                  onChange={(e) => setNumeroDocumento(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Cliente {tipoPago === "credito" ? "(obligatorio)" : "(opcional)"}
                </label>
                <select
                  className={`${inp} rounded-lg py-2`}
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
              {tipoPago === "credito" ? (
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Fecha límite crédito (opcional)
                  </label>
                  <input
                    type="date"
                    className={`${inp} rounded-lg py-2`}
                    value={creditoFechaLimite}
                    onChange={(e) => setCreditoFechaLimite(e.target.value)}
                  />
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={submitting || !tipoCambio || lineas.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500/25 px-6 py-2.5 text-sm font-semibold text-amber-50 ring-1 ring-amber-500/40 transition hover:bg-amber-500/35 disabled:opacity-40"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Confirmar venta
              </button>
              <Link
                href="/vendedor/ventas"
                className="inline-flex items-center rounded-xl border border-white/10 px-5 py-2.5 text-sm text-slate-300 hover:border-white/20 hover:text-white"
              >
                Ver historial
              </Link>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

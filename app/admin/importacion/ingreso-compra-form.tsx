"use client";

import { AdminButtonLink } from "@/app/admin/_components/admin-button-link";
import { AlertTriangle, CheckCircle2, Trash2, X } from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";

const inp =
  "w-full min-w-0 rounded border border-white/10 bg-slate-950/80 px-2 py-1.5 text-xs text-white outline-none focus:border-sky-500/50";
const inpNum = `${inp} font-mono`;
const cellPad = "border-b border-white/5 px-2 py-2 align-top";

type SucursalOpt = { id: number; nombre: string };
type ProveedorOpt = { id: number; nombre: string };

type ProductoBusqueda = {
  id: number;
  codigo: string;
  codigo_pieza: string | null;
  nombre: string;
  qr_payload: string;
  medida: string | null;
  especificacion: string | null;
  descripcion: string | null;
  precio_venta_lista_bs: string | null;
  precio_venta_lista_usd: string | null;
  porcentaje_utilidad: string | null;
  punto_tope: string | null;
};

type LineState = {
  key: string;
  productoId: number | null;
  codigoLabel: string;
  nombreLabel: string;
  busqueda: string;
  resultados: ProductoBusqueda[];
  buscando: boolean;
  imagenPreview: string;
  codigoPieza: string;
  cantidad: string;
  precioCompraBs: string;
  precioCompraUsd: string;
  precioVentaBs: string;
  precioVentaUsd: string;
  porcentajeUtilidad: string;
  puntoTope: string;
  qrPayload: string;
  medida: string;
  descripcion: string;
  imagenesText: string;
  reemplazarImagenes: boolean;
};

function emptyLine(): LineState {
  return {
    key: typeof crypto !== "undefined" ? crypto.randomUUID() : String(Math.random()),
    productoId: null,
    codigoLabel: "",
    nombreLabel: "",
    busqueda: "",
    resultados: [],
    buscando: false,
    imagenPreview: "",
    codigoPieza: "",
    cantidad: "1",
    precioCompraBs: "",
    precioCompraUsd: "",
    precioVentaBs: "",
    precioVentaUsd: "",
    porcentajeUtilidad: "",
    puntoTope: "",
    qrPayload: "",
    medida: "",
    descripcion: "",
    imagenesText: "",
    reemplazarImagenes: false,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

function parseNumOrNull(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function fmt(n: number, d: number): string {
  return d === 2 ? round2(n).toFixed(2) : round4(n).toFixed(4);
}

/** Texto para la columna descripción del ingreso: prioriza descripción, luego especificación, luego nombre. */
function descripcionTextoParaLinea(
  descripcion: string | null | undefined,
  especificacion: string | null | undefined,
  nombre: string | null | undefined
): string {
  const d = descripcion?.trim();
  if (d) return d;
  const e = especificacion?.trim();
  if (e) return e;
  const n = nombre?.trim();
  return n ?? "";
}

/** Anchos iniciales (px); se pueden estirar arrastrando el borde derecho del encabezado. */
const DEFAULT_INGRESO_COL_WIDTHS = [
  56, 200, 128, 88, 220, 72, 112, 104, 104, 64, 64, 96, 120, 48,
];

const INGRESO_COL_LABELS = [
  "Img",
  "Cód. barra",
  "Cód. pieza",
  "Medida",
  "Descripción",
  "Ítems",
  "P/Compra",
  "P/Venta Bs",
  "P/Venta USD",
  "Flete %",
  "% Util.",
  "P/Tope",
  "Subtotal",
  "",
] as const;

const COL_MIN = 40;

export function IngresoCompraForm({
  sucursales,
  proveedoresIniciales,
  tipoCambio,
}: {
  sucursales: SucursalOpt[];
  proveedoresIniciales: ProveedorOpt[];
  tipoCambio: { id: number; valor_bs_por_usd: number } | null;
}) {
  const [proveedores, setProveedores] = useState(proveedoresIniciales);
  const [sucursalId, setSucursalId] = useState(sucursales[0]?.id ? String(sucursales[0].id) : "");
  const [proveedorId, setProveedorId] = useState(proveedores[0]?.id ? String(proveedores[0].id) : "");
  const [tipoPago, setTipoPago] = useState<string>("efectivo");
  const [pctFlete, setPctFlete] = useState("0");
  const [pctUtilidadGlobal, setPctUtilidadGlobal] = useState("0");
  const [fleteManualActivo, setFleteManualActivo] = useState(false);
  const [fleteManual, setFleteManual] = useState("");
  const [lines, setLines] = useState<LineState[]>(() => [emptyLine()]);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [provModal, setProvModal] = useState(false);
  const [provNombre, setProvNombre] = useState("");
  const [provTel, setProvTel] = useState("");
  const [provDir, setProvDir] = useState("");
  const [provSaving, setProvSaving] = useState(false);
  const [expandKey, setExpandKey] = useState<string | null>(null);
  const [colWidths, setColWidths] = useState<number[]>(() => [...DEFAULT_INGRESO_COL_WIDTHS]);
  const resizeDragRef = useRef<{ index: number; startX: number; startWidth: number } | null>(null);
  const compraFlashRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!msg) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
    compraFlashRef.current?.focus();
  }, [msg]);

  const tcVal = tipoCambio?.valor_bs_por_usd ?? 0;
  const tablaAnchoPx = useMemo(() => colWidths.reduce((a, w) => a + w, 0), [colWidths]);

  const onColumnResizeMove = useCallback((e: MouseEvent) => {
    const d = resizeDragRef.current;
    if (!d) return;
    const delta = e.clientX - d.startX;
    const nw = Math.max(COL_MIN, Math.round(d.startWidth + delta));
    setColWidths((prev) => {
      if (prev[d.index] === nw) return prev;
      const next = [...prev];
      next[d.index] = nw;
      return next;
    });
  }, []);

  const onColumnResizeEnd = useCallback(() => {
    resizeDragRef.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    document.removeEventListener("mousemove", onColumnResizeMove);
    document.removeEventListener("mouseup", onColumnResizeEnd);
  }, [onColumnResizeMove]);

  const beginColumnResize = useCallback(
    (e: React.MouseEvent, colIndex: number) => {
      e.preventDefault();
      e.stopPropagation();
      resizeDragRef.current = {
        index: colIndex,
        startX: e.clientX,
        startWidth: colWidths[colIndex],
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onColumnResizeMove);
      document.addEventListener("mouseup", onColumnResizeEnd);
    },
    [colWidths, onColumnResizeMove, onColumnResizeEnd]
  );

  const tcFmt = tcVal > 0 ? fmt(tcVal, 4).replace(/\.?0+$/, "") : "—";

  const resumenLineas = useMemo(() => {
    type R = { subBs: number; subUsd: number; flete: number; totBs: number; totUsd: number };
    const porKey: Record<string, R | null> = {};
    const valid: { key: string; subBs: number; subUsd: number }[] = [];
    let sumSubBs = 0;
    let sumSubUsd = 0;

    for (const line of lines) {
      if (line.productoId == null) {
        porKey[line.key] = null;
        continue;
      }
      const cant = Math.max(0, Math.trunc(Number(line.cantidad) || 0));
      const pBs = parseNumOrNull(line.precioCompraBs);
      if (cant < 1 || pBs == null) {
        porKey[line.key] = null;
        continue;
      }
      const pUsd =
        parseNumOrNull(line.precioCompraUsd) ?? (tcVal > 0 ? round4(pBs / tcVal) : 0);
      const subBs = round2(cant * pBs);
      const subUsd = round4(cant * pUsd);
      sumSubBs += subBs;
      sumSubUsd += subUsd;
      valid.push({ key: line.key, subBs, subUsd });
    }

    sumSubBs = round2(sumSubBs);
    sumSubUsd = round4(sumSubUsd);
    const fm = fleteManualActivo ? parseNumOrNull(fleteManual) : null;
    const pct = Math.min(100, Math.max(0, Number(pctFlete) || 0));
    const fleteTotal =
      fm != null && fm >= 0 ? round2(fm) : round2((sumSubBs * pct) / 100);

    if (valid.length === 0 || sumSubBs <= 0) {
      for (const v of valid) {
        porKey[v.key] = { subBs: v.subBs, subUsd: v.subUsd, flete: 0, totBs: v.subBs, totUsd: v.subUsd };
      }
      const totalBs = round2(Object.values(porKey).reduce((s, r) => s + (r?.totBs ?? 0), 0));
      const totalUsd = round4(Object.values(porKey).reduce((s, r) => s + (r?.totUsd ?? 0), 0));
      const qtyTotal = lines.reduce((s, l) => {
        if (l.productoId == null) return s;
        const c = Math.trunc(Number(l.cantidad) || 0);
        return s + (c >= 1 ? c : 0);
      }, 0);
      return { porKey, sumSubBs, sumSubUsd, fleteTotal, totalBs, totalUsd, qtyTotal };
    }

    let allocated = 0;
    valid.forEach((v, idx) => {
      let f = 0;
      if (idx === valid.length - 1) {
        f = round2(fleteTotal - allocated);
      } else {
        f = round2((fleteTotal * v.subBs) / sumSubBs);
        allocated = round2(allocated + f);
      }
      const totBs = round2(v.subBs + f);
      const totUsd = round4(v.subUsd + (tcVal > 0 ? f / tcVal : 0));
      porKey[v.key] = { subBs: v.subBs, subUsd: v.subUsd, flete: f, totBs, totUsd };
    });

    const totalBs = round2(valid.reduce((s, v) => s + (porKey[v.key]?.totBs ?? 0), 0));
    const totalUsd = round4(valid.reduce((s, v) => s + (porKey[v.key]?.totUsd ?? 0), 0));
    const qtyTotal = lines.reduce((s, l) => {
      if (l.productoId == null) return s;
      const c = Math.trunc(Number(l.cantidad) || 0);
      return s + (c >= 1 && parseNumOrNull(l.precioCompraBs) != null ? c : 0);
    }, 0);

    return { porKey, sumSubBs, sumSubUsd, fleteTotal, totalBs, totalUsd, qtyTotal };
  }, [lines, pctFlete, fleteManualActivo, fleteManual, tcVal]);

  const itemsValidos = useMemo(
    () => lines.filter((l) => l.productoId != null && parseNumOrNull(l.precioCompraBs) != null).length,
    [lines]
  );

  /** Aplica % utilidad global al costo unitario Bs de cada línea con producto. */
  function recalcVentasPorUtilidad(utilStr: string, targetLines: LineState[]): LineState[] {
    const u = Math.max(0, Number(utilStr) || 0);
    return targetLines.map((line) => {
      if (line.productoId == null) return line;
      const pBs = parseNumOrNull(line.precioCompraBs);
      if (pBs == null || tcVal <= 0) return { ...line, porcentajeUtilidad: utilStr };
      const ventaBs = round2(pBs * (1 + u / 100));
      const ventaUsd = round4(ventaBs / tcVal);
      return {
        ...line,
        porcentajeUtilidad: utilStr,
        precioVentaBs: fmt(ventaBs, 2),
        precioVentaUsd: fmt(ventaUsd, 4),
      };
    });
  }

  function updateLine(key: string, patch: Partial<LineState>) {
    setLines((prev) => {
      const next = prev.map((l) => (l.key === key ? { ...l, ...patch } : l));
      const line = next.find((l) => l.key === key);
      if (!line) return next;
      const uGlob = Number(pctUtilidadGlobal) || 0;

      if ("precioCompraBs" in patch && line.productoId != null) {
        const pBs = parseNumOrNull(line.precioCompraBs);
        let updated = { ...line };
        if (pBs != null && tcVal > 0) {
          updated.precioCompraUsd = fmt(round4(pBs / tcVal), 4);
          if (uGlob >= 0) {
            const ventaBs = round2(pBs * (1 + uGlob / 100));
            updated.precioVentaBs = fmt(ventaBs, 2);
            updated.precioVentaUsd = fmt(round4(ventaBs / tcVal), 4);
          }
        }
        return next.map((l) => (l.key === key ? updated : l));
      }

      if ("precioCompraUsd" in patch && line.productoId != null) {
        const pUsd = parseNumOrNull(line.precioCompraUsd);
        let updated = { ...line };
        if (pUsd != null && tcVal > 0) {
          const pBs = round2(pUsd * tcVal);
          updated.precioCompraBs = fmt(pBs, 2);
          if (uGlob >= 0) {
            const ventaBs = round2(pBs * (1 + uGlob / 100));
            updated.precioVentaBs = fmt(ventaBs, 2);
            updated.precioVentaUsd = fmt(round4(ventaBs / tcVal), 4);
          }
        }
        return next.map((l) => (l.key === key ? updated : l));
      }

      if ("precioVentaBs" in patch && line.productoId != null) {
        const vBs = parseNumOrNull(line.precioVentaBs);
        let updated = { ...line };
        if (vBs != null && tcVal > 0) {
          updated.precioVentaUsd = fmt(round4(vBs / tcVal), 4);
          const pBs = parseNumOrNull(line.precioCompraBs);
          if (pBs != null && pBs > 0) {
            const u = (vBs / pBs - 1) * 100;
            updated.porcentajeUtilidad = fmt(round2(u), 2);
          }
        }
        return next.map((l) => (l.key === key ? updated : l));
      }

      if ("precioVentaUsd" in patch && line.productoId != null) {
        const vUsd = parseNumOrNull(line.precioVentaUsd);
        let updated = { ...line };
        if (vUsd != null && tcVal > 0) {
          const vBs = round2(vUsd * tcVal);
          updated.precioVentaBs = fmt(vBs, 2);
          const pBs = parseNumOrNull(line.precioCompraBs);
          if (pBs != null && pBs > 0) {
            const u = (vBs / pBs - 1) * 100;
            updated.porcentajeUtilidad = fmt(round2(u), 2);
          }
        }
        return next.map((l) => (l.key === key ? updated : l));
      }

      if ("porcentajeUtilidad" in patch && line.productoId != null) {
        const pBs = parseNumOrNull(line.precioCompraBs);
        const uStr = String(line.porcentajeUtilidad).trim().replace(",", ".");
        const uRaw = Number(uStr);
        let updated = { ...line };
        if (pBs != null && tcVal > 0 && uStr !== "" && Number.isFinite(uRaw)) {
          const ventaBs = round2(pBs * (1 + uRaw / 100));
          updated.precioVentaBs = fmt(ventaBs, 2);
          updated.precioVentaUsd = fmt(round4(ventaBs / tcVal), 4);
        }
        return next.map((l) => (l.key === key ? updated : l));
      }

      return next;
    });
  }

  const buscarProductos = useCallback(async (key: string, texto: string, modo: "barra" | "pieza") => {
    const q = texto.trim();
    if (!q) {
      setLines((prev) =>
        prev.map((l) => (l.key === key ? { ...l, resultados: [], buscando: false } : l))
      );
      return;
    }
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, buscando: true } : l)));
    try {
      const res = await fetch(
        `/api/admin/productos/buscar?q=${encodeURIComponent(q)}&modo=${modo}`,
        { credentials: "same-origin" }
      );
      const data = (await res.json()) as { productos?: ProductoBusqueda[] };
      const productos = data.productos ?? [];
      setLines((prev) =>
        prev.map((l) => (l.key === key ? { ...l, resultados: productos, buscando: false } : l))
      );
    } catch {
      setLines((prev) =>
        prev.map((l) => (l.key === key ? { ...l, resultados: [], buscando: false } : l))
      );
    }
  }, []);

  async function seleccionarProducto(key: string, p: ProductoBusqueda) {
    setLines((prev) => {
      const merged = prev.map((l) => {
        if (l.key !== key) return l;
        return {
          ...l,
          productoId: p.id,
          codigoLabel: p.codigo,
          nombreLabel: p.nombre,
          busqueda: "",
          resultados: [],
          codigoPieza: p.codigo_pieza ?? "",
          qrPayload: p.qr_payload ?? "",
          medida: p.medida ?? "",
          descripcion: descripcionTextoParaLinea(p.descripcion, p.especificacion, p.nombre),
          precioVentaBs: p.precio_venta_lista_bs ?? "",
          precioVentaUsd: p.precio_venta_lista_usd ?? "",
          porcentajeUtilidad: p.porcentaje_utilidad ?? pctUtilidadGlobal,
          puntoTope: p.punto_tope ?? "",
        };
      });
      return recalcVentasPorUtilidad(pctUtilidadGlobal, merged);
    });

    try {
      const res = await fetch(`/api/admin/productos/${p.id}`, { credentials: "same-origin" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        producto: {
          nombre: string;
          codigo_pieza: string | null;
          qr_payload: string;
          medida: string | null;
          especificacion: string | null;
          descripcion: string | null;
          precio_venta_lista_bs: string | null;
          precio_venta_lista_usd: string | null;
          porcentaje_utilidad: string | null;
          punto_tope: string | null;
        };
        imagenes: string[];
      };
      const pr = data.producto;
      const firstImg = data.imagenes[0] ?? "";
      setLines((prev) => {
        const merged = prev.map((l) => {
          if (l.key !== key) return l;
          return {
            ...l,
            codigoPieza: pr.codigo_pieza ?? l.codigoPieza,
            qrPayload: pr.qr_payload ?? l.qrPayload,
            medida: pr.medida ?? "",
            descripcion: descripcionTextoParaLinea(pr.descripcion, pr.especificacion, pr.nombre),
            precioVentaBs: pr.precio_venta_lista_bs ?? l.precioVentaBs,
            precioVentaUsd: pr.precio_venta_lista_usd ?? l.precioVentaUsd,
            porcentajeUtilidad: pr.porcentaje_utilidad ?? l.porcentajeUtilidad,
            puntoTope: pr.punto_tope ?? l.puntoTope,
            imagenPreview: firstImg,
            imagenesText: data.imagenes.join("\n"),
          };
        });
        return recalcVentasPorUtilidad(pctUtilidadGlobal, merged);
      });
    } catch {
      /* ignore */
    }
  }

  async function guardarProveedor(e: React.FormEvent) {
    e.preventDefault();
    setProvSaving(true);
    try {
      const res = await fetch("/api/admin/proveedores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          nombre: provNombre,
          telefono: provTel || null,
          direccion: provDir || null,
        }),
      });
      const data = (await res.json()) as { error?: string; id?: number; nombre?: string };
      if (!res.ok) {
        setErr(data.error ?? "No se pudo crear el proveedor");
        return;
      }
      if (data.id && data.nombre) {
        setProveedores((prev) =>
          [...prev, { id: data.id!, nombre: data.nombre! }].sort((a, b) => a.nombre.localeCompare(b.nombre))
        );
        setProveedorId(String(data.id));
      }
      setProvModal(false);
      setProvNombre("");
      setProvTel("");
      setProvDir("");
      setErr(null);
    } catch {
      setErr("Error de red al crear proveedor");
    } finally {
      setProvSaving(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    if (!tipoCambio) {
      setErr("Registrá un tipo de cambio antes de ingresar compras.");
      return;
    }

    const sid = Number(sucursalId);
    const pid = Number(proveedorId);
    if (!Number.isFinite(sid) || sid < 1) {
      setErr("Elegí sucursal destino del stock.");
      return;
    }
    if (!Number.isFinite(pid) || pid < 1) {
      setErr("Elegí proveedor.");
      return;
    }

    const payloadLineas = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.productoId == null) continue;
      const cant = Math.trunc(Number(line.cantidad) || 0);
      const pBs = parseNumOrNull(line.precioCompraBs);
      if (cant < 1 || pBs == null || pBs < 0) {
        setErr(`Ítem ${i + 1}: completá cantidad y precio de compra (Bs).`);
        return;
      }
      const pUsdRaw = line.precioCompraUsd.trim();
      const imagenesUrls = line.imagenesText
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);

      payloadLineas.push({
        productoId: line.productoId,
        cantidad: cant,
        precioCompraUnitBs: pBs,
        precioCompraUnitUsd: pUsdRaw === "" ? null : parseNumOrNull(pUsdRaw),
        precioVentaRefBs: parseNumOrNull(line.precioVentaBs),
        precioVentaRefUsd: parseNumOrNull(line.precioVentaUsd),
        porcentajeUtilidad: parseNumOrNull(line.porcentajeUtilidad),
        puntoTope: parseNumOrNull(line.puntoTope),
        qrPayload: line.qrPayload,
        medida: line.medida,
        descripcion: line.descripcion,
        codigoPiezaCatalogo: line.codigoPieza.trim() || null,
        imagenesUrls,
        reemplazarImagenes: line.reemplazarImagenes,
      });
    }

    if (!payloadLineas.length) {
      setErr("Agregá al menos un producto del catálogo. Si no existe, usá «Nuevo producto».");
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/admin/compras/ingreso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          sucursalId: sid,
          proveedorId: pid,
          tipoPago,
          tipoCambioId: tipoCambio.id,
          tipoCambioSnapshot: tipoCambio.valor_bs_por_usd,
          numeroDocumento: null,
          observaciones: null,
          pctFlete: Number(pctFlete) || 0,
          fleteTotalBsManual:
            fleteManualActivo && fleteManual.trim() !== "" ? parseNumOrNull(fleteManual) : null,
          lineas: payloadLineas,
        }),
      });
      const data = (await res.json()) as { error?: string; compraId?: number };
      if (!res.ok) {
        setErr(data.error ?? "Error al registrar");
        return;
      }
      setMsg(`Compra #${data.compraId} registrada correctamente.`);
      setLines([emptyLine()]);
      setPctFlete("0");
      setPctUtilidadGlobal("0");
      setFleteManual("");
      setFleteManualActivo(false);
    } catch {
      setErr("No se pudo contactar al servidor.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <AdminButtonLink href="/admin/productos/nueva" variant="secondary">
          + Nuevo producto
        </AdminButtonLink>
      </div>

      {err || msg ? (
        <div
          className="fixed inset-x-3 bottom-4 z-[200] flex justify-center sm:inset-x-auto sm:left-1/2 sm:right-auto sm:w-full sm:max-w-lg sm:-translate-x-1/2"
          role="presentation"
        >
          <div
            ref={msg && !err ? compraFlashRef : undefined}
            tabIndex={msg && !err ? -1 : undefined}
            className={`flex w-full max-w-lg items-start gap-3 rounded-2xl border-2 px-4 py-4 shadow-2xl backdrop-blur-md outline-none ${
              err
                ? "border-rose-400/70 bg-rose-950/95 text-rose-50 ring-4 ring-rose-500/30"
                : "border-emerald-400/70 bg-emerald-950/95 text-white ring-4 ring-emerald-500/35"
            }`}
            role="alert"
            aria-live={err ? "assertive" : "polite"}
          >
            {err ? (
              <>
                <AlertTriangle className="mt-0.5 h-8 w-8 shrink-0 text-rose-400" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-rose-300">No se pudo completar</p>
                  <p className="mt-1 text-base font-semibold leading-snug">{err}</p>
                </div>
              </>
            ) : (
              <>
                <CheckCircle2 className="mt-0.5 h-9 w-9 shrink-0 text-emerald-400" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">Compra registrada</p>
                  <p className="mt-1 text-lg font-bold leading-snug">{msg}</p>
                </div>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                setErr(null);
                setMsg(null);
              }}
              className="-m-1 shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Cerrar aviso"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      ) : null}

      {!tipoCambio ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">
          Falta tipo de cambio.{" "}
          <a href="/admin/tipo-cambio" className="font-medium text-amber-200 underline">
            Cargar cotización
          </a>
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="rounded-xl border border-white/10 bg-slate-900/50 shadow-xl">
        {/* Cabecera estilo detalle compra */}
        <div className="border-b border-white/10 bg-slate-950/60 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-white">
              Detalle compra{" "}
              <span className="font-normal text-sky-300">
                ( TC : <span className="font-mono">{tcFmt}</span> )
              </span>
            </h2>
            <p className="text-sm text-slate-400">
              (<span className="font-mono text-slate-200">{itemsValidos}</span>) ítems
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6 xl:grid-cols-12">
            <div className="lg:col-span-2">
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Sucursal stock *
              </label>
              <select
                required
                value={sucursalId}
                onChange={(e) => setSucursalId(e.target.value)}
                className={inp}
                disabled={pending || sucursales.length === 0}
              >
                {sucursales.length === 0 ? <option value="">—</option> : null}
                {sucursales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Proveedor *
              </label>
              <div className="flex gap-1">
                <select
                  required
                  value={proveedorId}
                  onChange={(e) => setProveedorId(e.target.value)}
                  className={`${inp} flex-1`}
                  disabled={pending}
                >
                  <option value="">Seleccioná…</option>
                  {proveedores.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setProvModal(true)}
                  className="shrink-0 rounded border border-sky-500/50 bg-sky-600 px-2.5 text-sm font-bold text-white hover:bg-sky-500"
                  title="Nuevo proveedor"
                >
                  +
                </button>
              </div>
            </div>
            <div className="lg:col-span-2">
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Tipo pago *
              </label>
              <select
                value={tipoPago}
                onChange={(e) => setTipoPago(e.target.value)}
                className={`${inp} uppercase`}
                disabled={pending}
              >
                <option value="efectivo">Efectivo</option>
                <option value="qr">QR</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="credito">Crédito</option>
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                % Flete (s/ subtotal Bs)
              </label>
              <input
                value={pctFlete}
                onChange={(e) => setPctFlete(e.target.value)}
                className={inpNum}
                disabled={pending || fleteManualActivo}
                inputMode="decimal"
              />
              <label className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-500">
                <input
                  type="checkbox"
                  checked={fleteManualActivo}
                  onChange={(e) => setFleteManualActivo(e.target.checked)}
                  disabled={pending}
                />
                Flete Bs fijo
              </label>
              {fleteManualActivo ? (
                <input
                  value={fleteManual}
                  onChange={(e) => setFleteManual(e.target.value)}
                  className={`${inpNum} mt-1`}
                  disabled={pending}
                  placeholder="Total Bs"
                />
              ) : null}
            </div>
            <div className="lg:col-span-2">
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                % Utilidad (s/ P. compra)
              </label>
              <input
                value={pctUtilidadGlobal}
                onChange={(e) => {
                  const v = e.target.value;
                  setPctUtilidadGlobal(v);
                  setLines((prev) => recalcVentasPorUtilidad(v, prev));
                }}
                className={inpNum}
                disabled={pending || !tipoCambio}
                inputMode="decimal"
              />
            </div>
          </div>
        </div>

        {/* Tabla — columnas redimensionables (arrastrá el borde derecho del encabezado) */}
        <div className="overflow-x-auto">
          <table
            className="table-fixed border-collapse text-left text-xs"
            style={{ width: tablaAnchoPx, minWidth: tablaAnchoPx }}
          >
            <colgroup>
              {colWidths.map((w, i) => (
                <col key={i} style={{ width: w }} />
              ))}
            </colgroup>
            <thead>
              <tr className="border-b border-white/10 bg-slate-950/80 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {INGRESO_COL_LABELS.map((label, i) => (
                  <th
                    key={i}
                    className={`${cellPad} relative select-none ${
                      i === 5 || i === 9 || i === 10 ? "text-center" : ""
                    }`}
                    title="Arrastrá el borde derecho de la columna para cambiar el ancho"
                  >
                    {label ? label : <span className="text-slate-600">·</span>}
                    <span
                      className="absolute right-0 top-0 z-10 h-full w-3 max-w-[12px] cursor-col-resize hover:bg-sky-500/25"
                      style={{ transform: "translateX(50%)" }}
                      onMouseDown={(e) => beginColumnResize(e, i)}
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Redimensionar columna ${label || i + 1}`}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const resFila = resumenLineas.porKey[line.key];
                const cant = Math.trunc(Number(line.cantidad) || 0);
                const pBs = parseNumOrNull(line.precioCompraBs);
                const pUsd =
                  parseNumOrNull(line.precioCompraUsd) ??
                  (pBs != null && tcVal > 0 ? round4(pBs / tcVal) : null);
                const fletePctSobreCosto =
                  resFila && resFila.subBs > 0 ? round2((100 * resFila.flete) / resFila.subBs) : 0;

                return (
                  <Fragment key={line.key}>
                    <tr className="hover:bg-white/[0.02]">
                      <td className={cellPad}>
                        <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded border border-white/10 bg-black/40">
                          {line.imagenPreview ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={line.imagenPreview}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-[9px] text-slate-600">—</span>
                          )}
                        </div>
                      </td>
                      <td className={cellPad}>
                        {line.productoId ? (
                          <div>
                            <p className="font-mono text-[11px] text-sky-200">{line.codigoLabel}</p>
                            <button
                              type="button"
                              onClick={() =>
                                setLines((prev) =>
                                  prev.map((l) =>
                                    l.key === line.key
                                      ? {
                                          ...emptyLine(),
                                          key: l.key,
                                          cantidad: l.cantidad,
                                        }
                                      : l
                                  )
                                )
                              }
                              className="mt-0.5 text-[10px] text-slate-500 underline hover:text-slate-300"
                            >
                              Cambiar
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <input
                              value={line.busqueda}
                              onChange={(e) => updateLine(line.key, { busqueda: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  void buscarProductos(line.key, line.busqueda, "barra");
                                }
                              }}
                              className={inp}
                              placeholder="Cód. barra o nombre…"
                              disabled={pending}
                            />
                            <button
                              type="button"
                              onClick={() => buscarProductos(line.key, line.busqueda, "barra")}
                              disabled={pending || line.buscando}
                              className="w-full rounded-lg bg-slate-700 py-2 text-xs font-medium text-white hover:bg-slate-600"
                            >
                              {line.buscando ? "…" : "Buscar"}
                            </button>
                            {line.resultados.length > 0 ? (
                              <ul
                                className="mt-2 max-h-[min(60vh,480px)] w-full min-w-[14rem] overflow-y-auto overflow-x-hidden rounded-xl border border-white/15 bg-slate-900/98 py-2 text-sm shadow-2xl ring-1 ring-black/30 backdrop-blur-md"
                                role="listbox"
                              >
                                {line.resultados.map((p) => (
                                  <li key={p.id}>
                                    <button
                                      type="button"
                                      onClick={() => seleccionarProducto(line.key, p)}
                                      className="w-full px-3 py-3 text-left hover:bg-sky-500/15 active:bg-sky-500/25"
                                    >
                                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                        <span className="font-mono text-base font-semibold text-sky-300">
                                          {p.codigo}
                                        </span>
                                        {p.codigo_pieza ? (
                                          <span className="font-mono text-xs text-slate-400">
                                            {p.codigo_pieza}
                                          </span>
                                        ) : null}
                                      </div>
                                      <p className="mt-1 text-sm leading-snug text-slate-100">{p.nombre}</p>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className={cellPad}>
                        <input
                          value={line.codigoPieza}
                          onChange={(e) => updateLine(line.key, { codigoPieza: e.target.value })}
                          onKeyDown={(e) => {
                            if (!line.productoId && e.key === "Enter") {
                              e.preventDefault();
                              void buscarProductos(line.key, line.codigoPieza, "pieza");
                            }
                          }}
                          className={inp}
                          disabled={pending}
                          placeholder={line.productoId ? "" : "Cód. pieza…"}
                        />
                        {!line.productoId ? (
                          <button
                            type="button"
                            onClick={() => buscarProductos(line.key, line.codigoPieza, "pieza")}
                            disabled={pending || line.buscando}
                            className="mt-1 w-full rounded-lg bg-slate-700 py-2 text-xs font-medium text-white hover:bg-slate-600"
                          >
                            {line.buscando ? "…" : "Buscar"}
                          </button>
                        ) : null}
                      </td>
                      <td className={cellPad}>
                        <input
                          value={line.medida}
                          onChange={(e) => updateLine(line.key, { medida: e.target.value })}
                          className={inp}
                          disabled={pending || !line.productoId}
                        />
                      </td>
                      <td className={cellPad}>
                        <textarea
                          value={line.descripcion}
                          onChange={(e) => updateLine(line.key, { descripcion: e.target.value })}
                          rows={2}
                          className={inp}
                          disabled={pending || !line.productoId}
                        />
                        <button
                          type="button"
                          onClick={() => setExpandKey((k) => (k === line.key ? null : line.key))}
                          className="mt-1 text-[10px] text-sky-400 hover:underline"
                        >
                          {expandKey === line.key ? "Ocultar extras" : "QR · imágenes"}
                        </button>
                      </td>
                      <td className={`${cellPad} text-center`}>
                        <input
                          value={line.cantidad}
                          onChange={(e) => updateLine(line.key, { cantidad: e.target.value })}
                          className={`${inpNum} text-center`}
                          disabled={pending || !line.productoId}
                          inputMode="numeric"
                        />
                        <span className="mt-0.5 block text-[9px] text-slate-500">uds.</span>
                      </td>
                      <td className={cellPad}>
                        <input
                          value={line.precioCompraBs}
                          onChange={(e) => updateLine(line.key, { precioCompraBs: e.target.value })}
                          className={inpNum}
                          disabled={pending || !line.productoId}
                          inputMode="decimal"
                        />
                        <p className="mt-0.5 font-mono text-[10px] text-slate-400">
                          [{pUsd != null ? fmt(pUsd, 4) : "—"}] $us.
                        </p>
                      </td>
                      <td className={cellPad}>
                        <input
                          value={line.precioVentaBs}
                          onChange={(e) => updateLine(line.key, { precioVentaBs: e.target.value })}
                          className={inpNum}
                          disabled={pending || !line.productoId}
                        />
                        <p className="mt-0.5 font-mono text-[10px] text-slate-500">
                          ({line.precioVentaBs || "—"}) Bs.
                        </p>
                      </td>
                      <td className={cellPad}>
                        <input
                          value={line.precioVentaUsd}
                          onChange={(e) => updateLine(line.key, { precioVentaUsd: e.target.value })}
                          className={inpNum}
                          disabled={pending || !line.productoId}
                        />
                        <p className="mt-0.5 font-mono text-[10px] text-slate-500">
                          ({line.precioVentaUsd || "—"}) $us.
                        </p>
                      </td>
                      <td className={`${cellPad} text-center`}>
                        <span className="font-mono text-[11px] text-slate-300">
                          {line.productoId && resFila ? fletePctSobreCosto : "—"}
                        </span>
                        <span className="mt-0.5 block text-[9px] text-slate-500">%</span>
                      </td>
                      <td className={cellPad}>
                        <input
                          value={line.porcentajeUtilidad}
                          onChange={(e) => updateLine(line.key, { porcentajeUtilidad: e.target.value })}
                          className={`${inpNum} text-center`}
                          disabled={pending || !line.productoId}
                        />
                        <span className="mt-0.5 block text-center text-[9px] text-slate-500">%</span>
                      </td>
                      <td className={cellPad}>
                        <input
                          value={line.puntoTope}
                          onChange={(e) => updateLine(line.key, { puntoTope: e.target.value })}
                          className={inpNum}
                          disabled={pending || !line.productoId}
                        />
                        <p className="mt-0.5 font-mono text-[10px] text-slate-500">Bs.</p>
                      </td>
                      <td className={cellPad}>
                        {line.productoId && resFila ? (
                          <>
                            <p className="font-mono text-[12px] text-white">{fmt(resFila.subUsd, 4)}</p>
                            <p className="font-mono text-[10px] text-slate-500">$us.</p>
                            <p className="mt-1 font-mono text-[10px] text-slate-400">
                              {fmt(resFila.subBs, 2)} Bs.
                            </p>
                          </>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className={cellPad}>
                        <button
                          type="button"
                          onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                          disabled={pending || lines.length < 2}
                          className="rounded p-1.5 text-rose-400 hover:bg-rose-500/10 disabled:opacity-30"
                          title="Quitar línea"
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                        </button>
                      </td>
                    </tr>
                    {expandKey === line.key ? (
                      <tr className="bg-black/25">
                        <td colSpan={14} className="px-4 py-2">
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            <div>
                              <label className="text-[10px] text-slate-500">QR payload</label>
                              <input
                                value={line.qrPayload}
                                onChange={(e) => updateLine(line.key, { qrPayload: e.target.value })}
                                className={inp}
                                disabled={pending}
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="text-[10px] text-slate-500">URLs imágenes (una por línea)</label>
                              <textarea
                                value={line.imagenesText}
                                onChange={(e) => updateLine(line.key, { imagenesText: e.target.value })}
                                rows={2}
                                className={inp}
                                disabled={pending}
                              />
                              <label className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                                <input
                                  type="checkbox"
                                  checked={line.reemplazarImagenes}
                                  onChange={(e) =>
                                    updateLine(line.key, { reemplazarImagenes: e.target.checked })
                                  }
                                  disabled={pending}
                                />
                                Reemplazar galería del producto
                              </label>
                            </div>
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

        <div className="flex flex-wrap items-end justify-between gap-4 border-t border-white/10 bg-slate-950/60 px-4 py-4">
          <button
            type="button"
            onClick={() => setLines((prev) => [...prev, emptyLine()])}
            disabled={pending}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/10"
          >
            + Añadir línea
          </button>

          <div className="flex flex-wrap items-end justify-end gap-6">
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase text-slate-500">Cantidad</p>
              <p className="font-mono text-lg text-white">{resumenLineas.qtyTotal}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase text-slate-500">Precio total Bs</p>
              <p className="font-mono text-lg text-white">{fmt(resumenLineas.totalBs, 2)}</p>
              <p className="text-[10px] text-slate-500">
                Subt. {fmt(resumenLineas.sumSubBs, 2)} + flete {fmt(resumenLineas.fleteTotal, 2)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase text-slate-500">Precio total USD</p>
              <p className="font-mono text-lg text-sky-200">{fmt(resumenLineas.totalUsd, 4)}</p>
            </div>
            <button
              type="submit"
              disabled={pending || !tipoCambio}
              className="rounded-lg bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-950/40 hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Procesando…" : "Comprar ítems"}
            </button>
          </div>
        </div>
      </form>

      {provModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-slate-900 p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-white">Nuevo proveedor</h3>
            <form onSubmit={guardarProveedor} className="mt-3 space-y-2">
              <div>
                <label className="text-xs text-slate-500">Nombre *</label>
                <input
                  value={provNombre}
                  onChange={(e) => setProvNombre(e.target.value)}
                  className={inp}
                  required
                  minLength={2}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Teléfono</label>
                <input value={provTel} onChange={(e) => setProvTel(e.target.value)} className={inp} />
              </div>
              <div>
                <label className="text-xs text-slate-500">Dirección</label>
                <textarea value={provDir} onChange={(e) => setProvDir(e.target.value)} className={inp} rows={2} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setProvModal(false)}
                  className="rounded-lg px-3 py-2 text-xs text-slate-400 hover:bg-white/5"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={provSaving}
                  className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
                >
                  {provSaving ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

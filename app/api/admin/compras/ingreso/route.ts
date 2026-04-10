import { getAdminSession } from "@/lib/auth/admin-session";
import {
  registrarIngresoCompra,
  type LineaIngresoInput,
  type TipoPagoCompra,
} from "@/lib/data/compras-ingreso";
import { getUltimoTipoCambio } from "@/lib/data/tipo-cambio";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

const TIPOS_PAGO: TipoPagoCompra[] = ["efectivo", "qr", "tarjeta", "credito"];

function isTipoPago(s: string): s is TipoPagoCompra {
  return (TIPOS_PAGO as string[]).includes(s);
}

function parseLinea(raw: unknown): LineaIngresoInput | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const productoId = Number(o.productoId);
  const cantidad = Number(o.cantidad);
  const precioCompraUnitBs = Number(o.precioCompraUnitBs);
  const precioCompraUnitUsd =
    o.precioCompraUnitUsd === null || o.precioCompraUnitUsd === undefined || o.precioCompraUnitUsd === ""
      ? null
      : Number(o.precioCompraUnitUsd);

  if (!Number.isFinite(productoId) || productoId < 1) return null;
  if (!Number.isFinite(cantidad) || cantidad < 1) return null;
  if (!Number.isFinite(precioCompraUnitBs) || precioCompraUnitBs < 0) return null;
  if (
    precioCompraUnitUsd !== null &&
    (!Number.isFinite(precioCompraUnitUsd) || precioCompraUnitUsd < 0)
  ) {
    return null;
  }

  const numOrNull = (v: unknown): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  return {
    productoId,
    cantidad: Math.trunc(cantidad),
    precioCompraUnitBs,
    precioCompraUnitUsd,
    precioVentaRefBs: numOrNull(o.precioVentaRefBs),
    precioVentaRefUsd: numOrNull(o.precioVentaRefUsd),
    porcentajeUtilidad: numOrNull(o.porcentajeUtilidad),
    puntoTope: numOrNull(o.puntoTope),
    qrPayload: typeof o.qrPayload === "string" ? o.qrPayload : "",
    codigoPiezaLinea:
      typeof o.codigoPiezaCatalogo === "string"
        ? o.codigoPiezaCatalogo
        : typeof o.codigoPiezaLinea === "string"
          ? o.codigoPiezaLinea
          : "",
    medida: typeof o.medida === "string" ? o.medida : "",
    descripcion: typeof o.descripcion === "string" ? o.descripcion : "",
    imagenesUrls: Array.isArray(o.imagenesUrls)
      ? o.imagenesUrls.filter((u): u is string => typeof u === "string" && u.trim().length > 0)
      : [],
    reemplazarImagenes: Boolean(o.reemplazarImagenes),
  };
}

export async function POST(request: Request) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const sucursalId = Number(b.sucursalId);
  const proveedorId = Number(b.proveedorId);
  const tipoPagoRaw = typeof b.tipoPago === "string" ? b.tipoPago : "";
  const pctFlete = Number(b.pctFlete ?? 0);
  const fleteManual =
    b.fleteTotalBsManual === null || b.fleteTotalBsManual === undefined || b.fleteTotalBsManual === ""
      ? null
      : Number(b.fleteTotalBsManual);

  if (!Number.isFinite(sucursalId) || sucursalId < 1) {
    return NextResponse.json({ error: "Sucursal inválida." }, { status: 400 });
  }
  if (!Number.isFinite(proveedorId) || proveedorId < 1) {
    return NextResponse.json({ error: "Proveedor inválido." }, { status: 400 });
  }
  if (!isTipoPago(tipoPagoRaw)) {
    return NextResponse.json({ error: "Tipo de pago inválido." }, { status: 400 });
  }
  if (!Number.isFinite(pctFlete) || pctFlete < 0 || pctFlete > 100) {
    return NextResponse.json({ error: "% flete debe estar entre 0 y 100." }, { status: 400 });
  }
  if (fleteManual !== null && (!Number.isFinite(fleteManual) || fleteManual < 0)) {
    return NextResponse.json({ error: "Monto de flete inválido." }, { status: 400 });
  }

  const lineasRaw = b.lineas;
  if (!Array.isArray(lineasRaw) || lineasRaw.length === 0) {
    return NextResponse.json({ error: "Agregá al menos un ítem." }, { status: 400 });
  }

  const lineas: LineaIngresoInput[] = [];
  for (const row of lineasRaw) {
    const parsed = parseLinea(row);
    if (!parsed) {
      return NextResponse.json({ error: "Ítem con datos inválidos." }, { status: 400 });
    }
    lineas.push(parsed);
  }

  const tcBodyId = b.tipoCambioId !== undefined ? Number(b.tipoCambioId) : NaN;
  const tcBodyVal = b.tipoCambioSnapshot !== undefined ? Number(b.tipoCambioSnapshot) : NaN;

  const ultimo = await getUltimoTipoCambio();
  if (!ultimo) {
    return NextResponse.json(
      { error: "No hay tipo de cambio registrado. Cargá uno en Tipo de cambio." },
      { status: 400 }
    );
  }

  const tipoCambioId = Number.isFinite(tcBodyId) && tcBodyId === ultimo.id ? tcBodyId : ultimo.id;
  const tipoCambioSnapshot = Number.isFinite(tcBodyVal) && tcBodyVal > 0 ? tcBodyVal : ultimo.valor_bs_por_usd;

  const result = await registrarIngresoCompra({
    usuarioId: admin.userId,
    sucursalId,
    proveedorId,
    tipoPago: tipoPagoRaw,
    tipoCambioId,
    tipoCambioSnapshot,
    numeroDocumento:
      typeof b.numeroDocumento === "string" && b.numeroDocumento.trim() ? b.numeroDocumento.trim() : null,
    observaciones:
      typeof b.observaciones === "string" && b.observaciones.trim() ? b.observaciones.trim() : null,
    pctFlete,
    fleteTotalBsManual: fleteManual,
    lineas,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  revalidatePath("/admin/importacion");
  revalidatePath("/admin/productos");
  revalidatePath("/admin/reportes");

  return NextResponse.json({ compraId: result.compraId });
}

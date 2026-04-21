import { getVendedorStaffContextOrNull } from "@/lib/auth/staff-panel-context";
import { getUltimoTipoCambio } from "@/lib/data/tipo-cambio";
import {
  registrarVentaVendedor,
  type LineaVentaInput,
  type TipoPagoVenta,
} from "@/lib/data/ventas-vendedor";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

const TIPOS_PAGO: TipoPagoVenta[] = ["efectivo", "qr", "tarjeta", "credito"];

function isTipoPago(s: string): s is TipoPagoVenta {
  return (TIPOS_PAGO as string[]).includes(s);
}

function parseLinea(raw: unknown): LineaVentaInput | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const productoId = Number(o.productoId);
  const cantidad = Number(o.cantidad);
  const precioRaw = o.precioUnitarioBs;
  const precioUnitarioBs =
    precioRaw === null || precioRaw === undefined || precioRaw === ""
      ? null
      : Number(precioRaw);

  if (!Number.isFinite(productoId) || productoId < 1) return null;
  if (!Number.isFinite(cantidad) || cantidad < 1) return null;
  if (
    precioUnitarioBs !== null &&
    (!Number.isFinite(precioUnitarioBs) || precioUnitarioBs <= 0)
  ) {
    return null;
  }

  return {
    productoId: Math.trunc(productoId),
    cantidad: Math.trunc(cantidad),
    precioUnitarioBs,
  };
}

export async function POST(request: Request) {
  const ctx = await getVendedorStaffContextOrNull();
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const tipoPagoRaw = typeof b.tipoPago === "string" ? b.tipoPago : "";
  if (!isTipoPago(tipoPagoRaw)) {
    return NextResponse.json({ error: "Tipo de pago inválido." }, { status: 400 });
  }

  const clienteIdRaw = b.clienteId;
  const clienteId =
    clienteIdRaw === null || clienteIdRaw === undefined || clienteIdRaw === ""
      ? null
      : Number(clienteIdRaw);

  const lineasRaw = b.lineas;
  if (!Array.isArray(lineasRaw) || lineasRaw.length === 0) {
    return NextResponse.json({ error: "Agregá al menos un producto." }, { status: 400 });
  }

  const lineas: LineaVentaInput[] = [];
  for (const row of lineasRaw) {
    const parsed = parseLinea(row);
    if (!parsed) {
      return NextResponse.json({ error: "Ítem con datos inválidos." }, { status: 400 });
    }
    lineas.push(parsed);
  }

  const ultimo = await getUltimoTipoCambio();
  if (!ultimo) {
    return NextResponse.json(
      { error: "No hay tipo de cambio registrado. Pedile al administrador que cargue uno." },
      { status: 400 }
    );
  }

  const tcBodyId = b.tipoCambioId !== undefined ? Number(b.tipoCambioId) : NaN;
  const tcBodyVal = b.tipoCambioSnapshot !== undefined ? Number(b.tipoCambioSnapshot) : NaN;
  const tipoCambioId = Number.isFinite(tcBodyId) && tcBodyId === ultimo.id ? tcBodyId : ultimo.id;
  const tipoCambioSnapshot =
    Number.isFinite(tcBodyVal) && tcBodyVal > 0 ? tcBodyVal : ultimo.valor_bs_por_usd;

  const creditoFechaLimite =
    typeof b.creditoFechaLimite === "string" ? b.creditoFechaLimite.trim() || null : null;

  const result = await registrarVentaVendedor({
    usuarioId: ctx.userId,
    sucursalId: ctx.sucursalId,
    clienteId: clienteId !== null && Number.isFinite(clienteId) && clienteId > 0 ? Math.trunc(clienteId) : null,
    tipoPago: tipoPagoRaw,
    tipoCambioId,
    tipoCambioSnapshot,
    numeroDocumento:
      typeof b.numeroDocumento === "string" && b.numeroDocumento.trim() ? b.numeroDocumento.trim() : null,
    lineas,
    creditoFechaLimite,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  revalidatePath("/vendedor/ventas");
  revalidatePath("/vendedor/ventas/nueva");
  revalidatePath("/vendedor");
  revalidatePath("/admin/reportes");

  return NextResponse.json({ ventaId: result.ventaId });
}

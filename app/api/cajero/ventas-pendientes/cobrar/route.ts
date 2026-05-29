import { getCajeroStaffContextOrNull } from "@/lib/auth/staff-panel-context";
import { isTipoPagoCaja, registrarCobroVentaCajero } from "@/lib/data/ventas-cobro-cajero";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const ctx = await getCajeroStaffContextOrNull();
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
  const ventaId = Number(b.ventaId);
  const tipoPagoRaw = typeof b.tipoPago === "string" ? b.tipoPago.trim() : "";

  if (!Number.isFinite(ventaId) || ventaId < 1) {
    return NextResponse.json({ error: "Venta inválida." }, { status: 400 });
  }
  if (!isTipoPagoCaja(tipoPagoRaw)) {
    return NextResponse.json({ error: "Forma de pago inválida." }, { status: 400 });
  }

  const result = await registrarCobroVentaCajero({
    ventaId: Math.trunc(ventaId),
    sucursalId: ctx.sucursalId,
    cajeroUsuarioId: ctx.userId,
    tipoPago: tipoPagoRaw,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  revalidatePath("/cajero/cobros");
  revalidatePath("/cajero/reportes/ingresos-egresos");
  revalidatePath("/cajero/reportes/arqueo-vendedores");
  revalidatePath("/vendedor/ventas");

  return NextResponse.json({ ok: true, ventaId: result.ventaId });
}

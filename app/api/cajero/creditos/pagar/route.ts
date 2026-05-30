import { getCajeroStaffContextOrNull } from "@/lib/auth/staff-panel-context";
import { isTipoPagoCobroCredito, registrarPagoCreditoCajero } from "@/lib/data/creditos";
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
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const creditoId = Number(o.creditoId);
  const tipoPago = String(o.tipoPago ?? o.tipo_pago ?? "").trim().toLowerCase();

  if (!Number.isFinite(creditoId) || creditoId < 1) {
    return NextResponse.json({ error: "Crédito no válido." }, { status: 400 });
  }
  if (!isTipoPagoCobroCredito(tipoPago)) {
    return NextResponse.json({ error: "Elegí efectivo, QR o tarjeta." }, { status: 400 });
  }

  const result = await registrarPagoCreditoCajero({
    creditoId: Math.trunc(creditoId),
    sucursalId: ctx.sucursalId,
    cajeroUsuarioId: ctx.userId,
    tipoPago,
    nota: typeof o.nota === "string" ? o.nota : null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  revalidatePath("/cajero/reportes/creditos");
  revalidatePath("/vendedor/creditos");
  revalidatePath("/cajero/reportes/ingresos-egresos");
  revalidatePath("/admin/clientes");

  return NextResponse.json({
    ok: true,
    montoBs: result.montoBs,
  });
}

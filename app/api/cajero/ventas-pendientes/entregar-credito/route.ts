import { getCajeroStaffContextOrNull } from "@/lib/auth/staff-panel-context";
import { registrarEntregaCreditoCajero } from "@/lib/data/creditos";
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
  const ventaId = Number(o.ventaId);
  if (!Number.isFinite(ventaId) || ventaId < 1) {
    return NextResponse.json({ error: "Venta no válida." }, { status: 400 });
  }

  const observacion = typeof o.observacion === "string" ? o.observacion : null;

  const result = await registrarEntregaCreditoCajero({
    ventaId: Math.trunc(ventaId),
    sucursalId: ctx.sucursalId,
    cajeroUsuarioId: ctx.userId,
    observacion,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  revalidatePath("/cajero/cobros");
  revalidatePath("/cajero/reportes/creditos");
  revalidatePath("/vendedor/creditos");
  revalidatePath("/admin/clientes");

  return NextResponse.json({
    ok: true,
    ventaId: result.ventaId,
    creditoId: result.creditoId,
    nota: result.nota,
  });
}

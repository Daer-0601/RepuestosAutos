import { getCajeroStaffContextOrNull } from "@/lib/auth/staff-panel-context";
import { registrarCajaSolicitudEnCaja } from "@/lib/data/caja-solicitudes";
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
    return NextResponse.json({ error: "Cuerpo JSON inválido." }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const id = Number(o.id);
  if (!Number.isFinite(id) || id < 1) {
    return NextResponse.json({ error: "Id de solicitud no válido." }, { status: 400 });
  }

  const result = await registrarCajaSolicitudEnCaja(id, ctx.sucursalId, ctx.userId);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    movimientoEgresoId: result.movimientoEgresoId,
    movimientoIngresoId: result.movimientoIngresoId,
  });
}


import { getCajeroStaffContextOrNull } from "@/lib/auth/staff-panel-context";
import { registrarImpresionCotizacionCajero } from "@/lib/data/cotizaciones-cajero";
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
  const cotizacionId = Number(b.cotizacionId);
  if (!Number.isFinite(cotizacionId) || cotizacionId < 1) {
    return NextResponse.json({ error: "Cotización inválida." }, { status: 400 });
  }

  const result = await registrarImpresionCotizacionCajero({
    cotizacionId: Math.trunc(cotizacionId),
    sucursalId: ctx.sucursalId,
    cajeroUsuarioId: ctx.userId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  revalidatePath("/cajero/cotizaciones");
  revalidatePath("/vendedor/cotizaciones");

  return NextResponse.json({ ok: true, cotizacionId: Math.trunc(cotizacionId) });
}

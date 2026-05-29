import { getVendedorStaffContextOrNull } from "@/lib/auth/staff-panel-context";
import { getUltimoTipoCambio } from "@/lib/data/tipo-cambio";
import { listCajerosActivosPorSucursal } from "@/lib/data/usuarios";
import { NextResponse } from "next/server";

export async function GET() {
  const ctx = await getVendedorStaffContextOrNull();
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const [tc, cajeros] = await Promise.all([
    getUltimoTipoCambio(),
    listCajerosActivosPorSucursal(ctx.sucursalId),
  ]);

  return NextResponse.json({
    sucursalId: ctx.sucursalId,
    sucursalNombre: ctx.sucursalNombre,
    username: ctx.username,
    cajeros,
    tipoCambio: tc
      ? { id: tc.id, valor_bs_por_usd: tc.valor_bs_por_usd }
      : null,
  });
}

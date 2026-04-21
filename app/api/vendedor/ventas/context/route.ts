import { getVendedorStaffContextOrNull } from "@/lib/auth/staff-panel-context";
import { listClientesActivosParaVenta } from "@/lib/data/ventas-vendedor";
import { getUltimoTipoCambio } from "@/lib/data/tipo-cambio";
import { NextResponse } from "next/server";

export async function GET() {
  const ctx = await getVendedorStaffContextOrNull();
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const tc = await getUltimoTipoCambio();
  const clientes = await listClientesActivosParaVenta();

  return NextResponse.json({
    sucursalId: ctx.sucursalId,
    sucursalNombre: ctx.sucursalNombre,
    tipoCambio: tc
      ? { id: tc.id, valor_bs_por_usd: tc.valor_bs_por_usd }
      : null,
    clientes,
  });
}

import { getCajeroStaffContextOrNull } from "@/lib/auth/staff-panel-context";
import { getNotaEntregaData } from "@/lib/data/creditos";
import { pool } from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import { NextResponse } from "next/server";

/** Reimpresión de nota de entrega (crédito ya entregado o recién entregado). */
export async function GET(request: Request) {
  const ctx = await getCajeroStaffContextOrNull();
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const ventaId = Number(new URL(request.url).searchParams.get("ventaId"));
  if (!Number.isFinite(ventaId) || ventaId < 1) {
    return NextResponse.json({ error: "Venta inválida." }, { status: 400 });
  }

  const [check] = await pool.execute<RowDataPacket[]>(
    `SELECT v.id
     FROM ventas v
     INNER JOIN creditos cr ON cr.venta_id = v.id
     WHERE v.id = ? AND v.sucursal_id = ? AND v.estado = 'confirmada'
     LIMIT 1`,
    [Math.trunc(ventaId), ctx.sucursalId]
  );
  if (!check[0]) {
    return NextResponse.json(
      { error: "No hay nota de entrega para esa venta en tu sucursal (¿fue entregada a crédito?)." },
      { status: 404 }
    );
  }

  const nota = await getNotaEntregaData(Math.trunc(ventaId), ctx.sucursalId);
  if (!nota) {
    return NextResponse.json({ error: "No se pudo armar la nota de entrega." }, { status: 404 });
  }

  return NextResponse.json({ nota });
}

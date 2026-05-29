import { getCajeroStaffContextOrNull } from "@/lib/auth/staff-panel-context";
import { getProductoVentaCompletoPorCodigo } from "@/lib/data/ventas-vendedor";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const ctx = await getCajeroStaffContextOrNull();
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const codigo = searchParams.get("codigo")?.trim() ?? "";
  if (!codigo) {
    return NextResponse.json({ error: "Indicá un código." }, { status: 400 });
  }

  const p = await getProductoVentaCompletoPorCodigo(ctx.sucursalId, codigo);
  if (!p) {
    return NextResponse.json({ producto: null });
  }

  const codigoQr = (
    p.qr_payload?.trim() ||
    p.codigo_pieza?.trim() ||
    p.codigo?.trim() ||
    codigo
  ).toUpperCase();

  return NextResponse.json({
    producto: {
      id: p.id,
      codigo: codigoQr,
      nombre: p.nombre?.trim() ?? "",
      medida: p.medida?.trim() ?? null,
      precioListaBs: p.precio_venta_lista_bs,
    },
  });
}

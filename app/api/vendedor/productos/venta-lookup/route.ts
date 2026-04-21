import { getVendedorStaffContextOrNull } from "@/lib/auth/staff-panel-context";
import { getProductoVentaCompletoPorCodigo } from "@/lib/data/ventas-vendedor";
import { NextResponse } from "next/server";

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

  const codigo = typeof (body as { codigo?: unknown }).codigo === "string" ? (body as { codigo: string }).codigo : "";
  if (!codigo.trim()) {
    return NextResponse.json({ error: "Ingresá código o lectura de QR." }, { status: 400 });
  }

  const producto = await getProductoVentaCompletoPorCodigo(ctx.sucursalId, codigo);
  if (!producto) {
    return NextResponse.json({ error: "Producto no encontrado o código ambiguo." }, { status: 404 });
  }

  return NextResponse.json({ producto });
}

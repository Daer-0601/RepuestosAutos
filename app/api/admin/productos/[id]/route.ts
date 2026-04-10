import { getAdminSession } from "@/lib/auth/admin-session";
import { getProducto, listProductoImagenes } from "@/lib/data/productos";
import { NextResponse } from "next/server";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: raw } = await ctx.params;
  const id = Number(raw);
  if (!Number.isFinite(id) || id < 1) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const producto = await getProducto(id);
  if (!producto) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const imagenes = await listProductoImagenes(id);
  return NextResponse.json({ producto, imagenes });
}

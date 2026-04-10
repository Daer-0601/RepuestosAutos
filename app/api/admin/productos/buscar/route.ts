import { getAdminSession } from "@/lib/auth/admin-session";
import {
  searchProductosParaIngreso,
  type ModoBusquedaProductoIngreso,
} from "@/lib/data/productos";
import { NextResponse } from "next/server";

function parseModo(raw: string | null): ModoBusquedaProductoIngreso {
  return raw === "pieza" ? "pieza" : "barra";
}

export async function GET(request: Request) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const modo = parseModo(searchParams.get("modo"));
  const rows = await searchProductosParaIngreso(q, modo, 40);
  return NextResponse.json({ productos: rows });
}

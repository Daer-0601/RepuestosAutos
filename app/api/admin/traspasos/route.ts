import { getAdminSession } from "@/lib/auth/admin-session";
import {
  registrarTraspaso,
  searchProductosConStockEnSucursal,
  type TraspasoLineaInput,
} from "@/lib/data/traspasos";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

function parseLinea(raw: unknown): TraspasoLineaInput | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const productoId = Number(o.productoId);
  const cantidad = Number(o.cantidad);
  if (!Number.isFinite(productoId) || productoId < 1) return null;
  if (!Number.isFinite(cantidad) || cantidad < 1) return null;
  return {
    productoId: Math.trunc(productoId),
    cantidad: Math.trunc(cantidad),
  };
}

export async function GET(request: Request) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const sucursal = Number(searchParams.get("sucursal"));
  const q = String(searchParams.get("q") ?? "");
  const limitRaw = Number(searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.trunc(limitRaw))) : 20;
  if (!Number.isFinite(sucursal) || sucursal < 1) {
    return NextResponse.json({ productos: [] });
  }
  const productos = await searchProductosConStockEnSucursal(sucursal, q, limit);
  return NextResponse.json({ productos });
}

export async function POST(request: Request) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const sucursalOrigenId = Number(b.sucursalOrigenId);
  const sucursalDestinoId = Number(b.sucursalDestinoId);
  const nota = typeof b.nota === "string" && b.nota.trim() ? b.nota.trim() : null;

  const lineasRaw = b.lineas;
  if (!Array.isArray(lineasRaw) || lineasRaw.length === 0) {
    return NextResponse.json({ error: "Agregá al menos una línea." }, { status: 400 });
  }
  const lineas: TraspasoLineaInput[] = [];
  for (const row of lineasRaw) {
    const parsed = parseLinea(row);
    if (!parsed) return NextResponse.json({ error: "Línea inválida." }, { status: 400 });
    lineas.push(parsed);
  }

  const res = await registrarTraspaso({
    usuarioId: admin.userId,
    sucursalOrigenId,
    sucursalDestinoId,
    nota,
    lineas,
  });
  if (!res.ok) {
    return NextResponse.json({ error: res.message }, { status: 400 });
  }

  revalidatePath("/admin/traspasos");
  revalidatePath("/admin/productos");
  revalidatePath("/admin/reportes");
  return NextResponse.json({ ok: true, referenciaId: res.referenciaId });
}

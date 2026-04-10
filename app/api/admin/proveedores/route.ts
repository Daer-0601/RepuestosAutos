import { getAdminSession } from "@/lib/auth/admin-session";
import { insertProveedor, listProveedoresActivos } from "@/lib/data/proveedores";
import { NextResponse } from "next/server";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const proveedores = await listProveedoresActivos();
  return NextResponse.json({ proveedores });
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

  const b = body as { nombre?: string; telefono?: string; direccion?: string };
  const nombre = typeof b.nombre === "string" ? b.nombre.trim() : "";
  if (nombre.length < 2) {
    return NextResponse.json({ error: "Nombre de proveedor obligatorio (mín. 2 caracteres)." }, { status: 400 });
  }

  const id = await insertProveedor({
    nombre,
    telefono: typeof b.telefono === "string" ? b.telefono.trim() || null : null,
    direccion: typeof b.direccion === "string" ? b.direccion.trim() || null : null,
  });

  return NextResponse.json({ id, nombre });
}

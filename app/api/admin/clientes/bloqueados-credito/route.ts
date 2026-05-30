import { getAdminSession } from "@/lib/auth/admin-session";
import {
  listClientesBloqueadosPorCredito,
  reactivarClienteCredito,
} from "@/lib/data/creditos";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const clientes = await listClientesBloqueadosPorCredito();
  return NextResponse.json({ clientes });
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
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const clienteId = Number((body as Record<string, unknown>).clienteId);
  if (!Number.isFinite(clienteId) || clienteId < 1) {
    return NextResponse.json({ error: "Cliente no válido." }, { status: 400 });
  }

  const result = await reactivarClienteCredito(Math.trunc(clienteId));
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  revalidatePath("/admin/clientes");
  revalidatePath("/vendedor/clientes");
  return NextResponse.json({ ok: true });
}

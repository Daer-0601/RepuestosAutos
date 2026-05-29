import { getAdminSession } from "@/lib/auth/admin-session";
import { resolverCajaSolicitud } from "@/lib/data/caja-solicitudes";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido." }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const id = Number(o.id);
  const decision = String(o.decision ?? "").trim().toLowerCase();
  const aprobar = decision === "aprobar" || decision === "aprobada" || decision === "ok";
  const rechazar = decision === "rechazar" || decision === "rechazada" || decision === "no";
  if (!Number.isFinite(id) || id < 1 || (!aprobar && !rechazar)) {
    return NextResponse.json({ error: "Parámetros inválidos." }, { status: 400 });
  }

  const notaAdmin = o.nota != null ? String(o.nota) : null;
  const result = await resolverCajaSolicitud(id, admin.userId, aprobar, notaAdmin);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}


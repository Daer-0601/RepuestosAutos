import { getAdminSession } from "@/lib/auth/admin-session";
import { listCajaSolicitudesAdmin } from "@/lib/data/caja-solicitudes";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const estado = String(searchParams.get("estado") ?? "pendiente").trim().toLowerCase();
  const estadoNorm =
    estado === "todas" || estado === "pendiente" || estado === "aprobada" || estado === "rechazada" || estado === "registrada"
      ? (estado as "todas" | "pendiente" | "aprobada" | "rechazada" | "registrada")
      : "pendiente";

  const solicitudes = await listCajaSolicitudesAdmin({ estado: estadoNorm, limit: 300 });
  return NextResponse.json({ solicitudes });
}


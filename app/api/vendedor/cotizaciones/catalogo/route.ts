import { getVendedorStaffContextOrNull } from "@/lib/auth/staff-panel-context";
import {
  catalogoCotizacionBuscarCodigoBarraComoIngreso,
  catalogoCotizacionBuscarPorTerm,
  catalogoCotizacionBuscarSoloQ,
  catalogoCotizacionListarActivosPagina,
} from "@/lib/data/catalogo-cotizacion";
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

  const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;

  if (b.listarActivos === true) {
    const page = Math.max(1, Math.trunc(Number(b.page) || 1));
    const data = await catalogoCotizacionListarActivosPagina(page, b.perPage);
    return NextResponse.json(data);
  }

  const codigoBarraRaw = b.codigoBarra;
  const codigoBarra =
    typeof codigoBarraRaw === "string"
      ? codigoBarraRaw.trim()
      : typeof codigoBarraRaw === "number" && Number.isFinite(codigoBarraRaw)
        ? String(Math.trunc(codigoBarraRaw))
        : "";
  if (codigoBarra.length > 0) {
    const data = await catalogoCotizacionBuscarCodigoBarraComoIngreso(codigoBarra, b.perPage);
    return NextResponse.json(data);
  }

  const q = typeof b.q === "string" ? b.q.trim() : "";
  if (q.length > 0) {
    const data = await catalogoCotizacionBuscarSoloQ(q, b.perPage);
    return NextResponse.json(data);
  }

  const term = typeof b.term === "string" ? b.term : "";
  const data = await catalogoCotizacionBuscarPorTerm(term, b.perPage);
  return NextResponse.json(data);
}

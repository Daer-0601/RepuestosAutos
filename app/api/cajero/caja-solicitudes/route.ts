import { getCajeroStaffContextOrNull } from "@/lib/auth/staff-panel-context";
import {
  crearCajaSolicitud,
  listCajaSolicitudesSucursalDia,
} from "@/lib/data/caja-solicitudes";
import { formatDateTimeMysqlBolivia, parseIsoDateOnly } from "@/lib/fecha-bolivia";
import { NextResponse } from "next/server";

function defaultHoyIso(): string {
  return formatDateTimeMysqlBolivia(new Date()).slice(0, 10);
}

export async function GET(request: Request) {
  const ctx = await getCajeroStaffContextOrNull();
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const fecha = parseIsoDateOnly(searchParams.get("fecha")) ?? defaultHoyIso();

  const solicitudes = await listCajaSolicitudesSucursalDia(ctx.sucursalId, fecha);
  return NextResponse.json({ fecha, solicitudes });
}

export async function POST(request: Request) {
  const ctx = await getCajeroStaffContextOrNull();
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido." }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const tipo = String(o.tipo ?? "").trim().toLowerCase();
  if (tipo !== "devolucion" && tipo !== "cambio") {
    return NextResponse.json({ error: "Tipo de solicitud no válido." }, { status: 400 });
  }

  const dev = (o.devuelto ?? o.productoDevuelto) as Record<string, unknown> | undefined;
  const ent = (o.entregado ?? o.productoEntregado) as Record<string, unknown> | undefined;

  const result = await crearCajaSolicitud({
    sucursalId: ctx.sucursalId,
    cajeroUsuarioId: ctx.userId,
    tipo,
    devuelto: {
      codigo: String(dev?.codigo ?? o.codigoDevuelto ?? ""),
      nombre: dev?.nombre != null ? String(dev.nombre) : null,
      cantidad: Number(dev?.cantidad ?? o.cantidadDevuelta ?? 1),
      montoBs: Number(dev?.montoBs ?? dev?.monto_bs ?? o.montoDevuelto ?? o.monto_bs_devuelto),
    },
    entregado:
      tipo === "cambio"
        ? {
            codigo: String(ent?.codigo ?? o.codigoEntregado ?? ""),
            nombre: ent?.nombre != null ? String(ent.nombre) : null,
            cantidad: Number(ent?.cantidad ?? o.cantidadEntregada ?? 1),
            montoBs: Number(ent?.montoBs ?? ent?.monto_bs ?? o.montoEntregado ?? o.monto_bs_entregado),
          }
        : null,
    notaCajero: o.nota != null ? String(o.nota) : null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: result.id });
}


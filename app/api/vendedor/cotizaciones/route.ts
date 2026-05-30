import { getVendedorStaffContextOrNull } from "@/lib/auth/staff-panel-context";
import { crearCotizacionAdmin, listCotizacionesPorSucursal } from "@/lib/data/cotizaciones";
import { assertCajeroDestinoValido } from "@/lib/data/ventas-cobro-cajero";
import { listCajerosActivosPorSucursal } from "@/lib/data/usuarios";
import { getUltimoTipoCambio } from "@/lib/data/tipo-cambio";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export async function GET() {
  const ctx = await getVendedorStaffContextOrNull();
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const ultimo = await getUltimoTipoCambio();
  let cotizaciones: Awaited<ReturnType<typeof listCotizacionesPorSucursal>> = [];
  try {
    cotizaciones = await listCotizacionesPorSucursal(ctx.sucursalId, 50);
  } catch {
    cotizaciones = [];
  }
  const cajeros = await listCajerosActivosPorSucursal(ctx.sucursalId);
  return NextResponse.json({
    sucursalId: ctx.sucursalId,
    tipoCambio: ultimo ? { id: ultimo.id, valor_bs_por_usd: ultimo.valor_bs_por_usd } : null,
    cotizaciones,
    sucursalNombre: ctx.sucursalNombre,
    cajeros,
  });
}

function parseLinea(raw: unknown): { productoId: number; cantidad: number; precioUnitarioBs: number } | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const productoId = Number(o.productoId);
  const cantidad = Number(o.cantidad);
  const precio = Number(o.precioUnitarioBs);
  if (!Number.isFinite(productoId) || productoId < 1) return null;
  if (!Number.isFinite(cantidad) || cantidad < 1) return null;
  if (!Number.isFinite(precio) || precio <= 0) return null;
  return {
    productoId: Math.trunc(productoId),
    cantidad: Math.trunc(cantidad),
    precioUnitarioBs: precio,
  };
}

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

  const b = body as Record<string, unknown>;
  const lineasRaw = b.lineas;
  if (!Array.isArray(lineasRaw) || lineasRaw.length === 0) {
    return NextResponse.json({ error: "Agregá al menos una línea." }, { status: 400 });
  }

  const lineas = [];
  for (const row of lineasRaw) {
    const parsed = parseLinea(row);
    if (!parsed) {
      return NextResponse.json({ error: "Línea con datos inválidos." }, { status: 400 });
    }
    lineas.push(parsed);
  }

  const ultimo = await getUltimoTipoCambio();
  if (!ultimo) {
    return NextResponse.json(
      { error: "No hay tipo de cambio registrado. Pedile al administrador que cargue uno." },
      { status: 400 }
    );
  }

  const tcBodyId = b.tipoCambioId !== undefined ? Number(b.tipoCambioId) : NaN;
  const tcBodyVal = b.tipoCambioSnapshot !== undefined ? Number(b.tipoCambioSnapshot) : NaN;
  const tipoCambioId = Number.isFinite(tcBodyId) && tcBodyId === ultimo.id ? tcBodyId : ultimo.id;
  const tipoCambioSnapshot =
    Number.isFinite(tcBodyVal) && tcBodyVal > 0 ? tcBodyVal : ultimo.valor_bs_por_usd;

  const cajeroDestinoRaw = b.cajeroDestinoUsuarioId;
  const cajeroDestinoUsuarioId =
    cajeroDestinoRaw === null || cajeroDestinoRaw === undefined || cajeroDestinoRaw === ""
      ? NaN
      : Number(cajeroDestinoRaw);
  if (!Number.isFinite(cajeroDestinoUsuarioId) || cajeroDestinoUsuarioId < 1) {
    return NextResponse.json({ error: "Elegí el cajero que imprimirá la cotización." }, { status: 400 });
  }
  const cajeroOk = await assertCajeroDestinoValido(ctx.sucursalId, Math.trunc(cajeroDestinoUsuarioId));
  if (!cajeroOk.ok) {
    return NextResponse.json({ error: cajeroOk.message }, { status: 400 });
  }

  const clienteNombre =
    typeof b.clienteNombre === "string" && b.clienteNombre.trim() ? b.clienteNombre.trim().slice(0, 255) : null;
  const clienteNit = typeof b.clienteNit === "string" && b.clienteNit.trim() ? b.clienteNit.trim().slice(0, 64) : null;
  const notas = typeof b.notas === "string" && b.notas.trim() ? b.notas.trim().slice(0, 4000) : null;

  const result = await crearCotizacionAdmin({
    usuarioId: ctx.userId,
    cajeroDestinoUsuarioId: Math.trunc(cajeroDestinoUsuarioId),
    clienteNombre,
    clienteNit,
    notas,
    tipoCambioId,
    tipoCambioSnapshot,
    lineas,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  revalidatePath("/vendedor/cotizaciones");
  revalidatePath("/vendedor");
  revalidatePath("/cajero/cotizaciones");

  return NextResponse.json({ cotizacionId: result.cotizacionId });
}

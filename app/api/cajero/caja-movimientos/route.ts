import { getCajeroStaffContextOrNull } from "@/lib/auth/staff-panel-context";
import {
  deleteCajaMovimiento,
  listCajaMovimientosDia,
  countVentasCobradasDiaSucursal,
  listVentasProductosDiaSucursal,
  registrarCajaMovimiento,
  totalVentasCobradasDiaBsReconciliado,
  type CajaMovimientoTipo,
} from "@/lib/data/caja-movimientos";
import { getUltimoTipoCambio } from "@/lib/data/tipo-cambio";
import { getUsuario } from "@/lib/data/usuarios";
import { codigoTienda } from "@/lib/caja/tienda-codigo";
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

  const [movimientos, ventasProductos, ventaTotalBs, cantidadVentasCobradas, ultimoTc, u] =
    await Promise.all([
      listCajaMovimientosDia(ctx.sucursalId, fecha),
      listVentasProductosDiaSucursal(ctx.sucursalId, fecha),
      totalVentasCobradasDiaBsReconciliado(ctx.sucursalId, fecha),
      countVentasCobradasDiaSucursal(ctx.sucursalId, fecha),
      getUltimoTipoCambio(),
      getUsuario(ctx.userId),
    ]);

  const cajeroUsername = (ctx.username || u?.username || "").trim() || "—";
  const cajeroNombre =
    String(u?.nombre_completo ?? "").trim() || cajeroUsername;

  return NextResponse.json(
    {
      fecha,
      sucursalNombre: ctx.sucursalNombre,
      tiendaCodigo: codigoTienda(ctx.sucursalId, ctx.sucursalNombre),
      cajeroUsername,
      cajeroNombre,
      movimientos,
      ventasProductos,
      ventaTotalBs,
      cantidadVentasCobradas,
      tipoCambioReferencia: ultimoTc
        ? { id: ultimoTc.id, valorBsPorUsd: ultimoTc.valor_bs_por_usd }
        : null,
    },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache" } }
  );
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
  const operacion = String(o.operacion ?? "manual").trim().toLowerCase();

  if (operacion === "devolucion") {
    return NextResponse.json(
      { error: "Las devoluciones requieren aprobación. Enviá la solicitud para que el administrador la apruebe/rechace." },
      { status: 400 }
    );
  }

  if (operacion === "cambio") {
    return NextResponse.json(
      { error: "Los cambios requieren aprobación. Enviá la solicitud para que el administrador la apruebe/rechace." },
      { status: 400 }
    );
  }

  const compraDolar = Boolean(o.compraDolar ?? o.compra_dolar);

  let tipo: CajaMovimientoTipo = "egreso";
  if (!compraDolar) {
    const tipoRaw = String(o.tipo ?? "").trim().toLowerCase();
    if (tipoRaw !== "ingreso" && tipoRaw !== "egreso") {
      return NextResponse.json({ error: "Elegí si es ingreso o egreso." }, { status: 400 });
    }
    tipo = tipoRaw;
  }

  const detalle = String(o.detalle ?? "");
  const montoBs = Number(o.montoBs ?? o.monto_bs);

  const result = await registrarCajaMovimiento({
    sucursalId: ctx.sucursalId,
    usuarioId: ctx.userId,
    tipo,
    detalle,
    montoBs,
    compraDolar: compraDolar
      ? {
          montoUsd: Number(o.montoUsd ?? o.monto_usd),
          tipoCambioCompra: Number(o.tipoCambioCompra ?? o.tipo_cambio_compra),
        }
      : undefined,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: result.id });
}

export async function DELETE(request: Request) {
  const ctx = await getCajeroStaffContextOrNull();
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));
  if (!Number.isFinite(id) || id < 1) {
    return NextResponse.json({ error: "Id de movimiento no válido." }, { status: 400 });
  }

  const result = await deleteCajaMovimiento(id, ctx.sucursalId);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

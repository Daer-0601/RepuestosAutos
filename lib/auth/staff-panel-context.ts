import "server-only";

import { redirect } from "next/navigation";
import { requireCashier, requireSeller } from "@/lib/auth/require-role";
import { getSession, type SessionUser } from "@/lib/auth/session-cookie";
import { getSucursal } from "@/lib/data/sucursales";
import { getUsuario } from "@/lib/data/usuarios";

export type PanelStaffContext = {
  userId: number;
  username: string;
  rolId: number;
  sucursalId: number;
  sucursalNombre: string;
};

async function requireStaffSucursal(session: SessionUser, basePath: "/cajero" | "/vendedor"): Promise<PanelStaffContext> {
  const u = await getUsuario(session.userId);
  if (!u || u.activo !== 1) {
    redirect(`${basePath}?error=${encodeURIComponent("Usuario inhabilitado o inexistente.")}`);
  }
  if (u.sucursal_id == null || u.sucursal_id <= 0) {
    redirect(
      `${basePath}?error=${encodeURIComponent(
        "Tu usuario no tiene sucursal asignada. Pedile al administrador que te asigne una."
      )}`
    );
  }
  const suc = await getSucursal(u.sucursal_id);
  if (!suc || suc.estado !== "activo") {
    redirect(
      `${basePath}?error=${encodeURIComponent("La sucursal asignada no existe o está inactiva.")}`
    );
  }
  return {
    userId: session.userId,
    username: session.username,
    rolId: session.rolId,
    sucursalId: u.sucursal_id,
    sucursalNombre: suc.nombre,
  };
}

export async function requireCajeroContext(): Promise<PanelStaffContext> {
  const session = await requireCashier();
  return requireStaffSucursal(session, "/cajero");
}

export async function requireVendedorContext(): Promise<PanelStaffContext> {
  const session = await requireSeller();
  return requireStaffSucursal(session, "/vendedor");
}

/** Para rutas API: mismo contexto que el layout, sin `redirect`. */
export async function getVendedorStaffContextOrNull(): Promise<PanelStaffContext | null> {
  const session = await getSession();
  if (!session || session.rolId !== 3) return null;
  const u = await getUsuario(session.userId);
  if (!u || u.activo !== 1) return null;
  if (u.sucursal_id == null || u.sucursal_id <= 0) return null;
  const suc = await getSucursal(u.sucursal_id);
  if (!suc || suc.estado !== "activo") return null;
  return {
    userId: session.userId,
    username: session.username,
    rolId: session.rolId,
    sucursalId: u.sucursal_id,
    sucursalNombre: suc.nombre,
  };
}

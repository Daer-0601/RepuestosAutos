"use server";

import { getAdminSession } from "@/lib/auth/admin-session";
import * as repo from "@/lib/data/sucursales";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function q(msg: string, path: string) {
  redirect(`${path}?error=${encodeURIComponent(msg)}`);
}

export async function createSucursalAction(formData: FormData) {
  const admin = await getAdminSession();
  if (!admin) {
    redirect("/login");
  }

  const nombre = String(formData.get("nombre") ?? "").trim();
  const direccion = String(formData.get("direccion") ?? "").trim() || null;
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const estado = String(formData.get("estado") ?? "activo");

  if (!nombre) {
    q("El nombre es obligatorio.", "/admin/sucursales/nueva");
  }
  if (estado !== "activo" && estado !== "inactivo") {
    q("Estado inválido.", "/admin/sucursales/nueva");
  }

  await repo.insertSucursal({
    nombre,
    direccion,
    telefono,
    estado: estado as "activo" | "inactivo",
  });
  revalidatePath("/admin/sucursales");
  redirect("/admin/sucursales");
}

export async function updateSucursalAction(formData: FormData) {
  const admin = await getAdminSession();
  if (!admin) {
    redirect("/login");
  }

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id) || id <= 0) {
    q("ID inválido.", "/admin/sucursales");
  }

  const nombre = String(formData.get("nombre") ?? "").trim();
  const direccion = String(formData.get("direccion") ?? "").trim() || null;
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const estado = String(formData.get("estado") ?? "activo");

  if (!nombre) {
    q("El nombre es obligatorio.", `/admin/sucursales/${id}`);
  }
  if (estado !== "activo" && estado !== "inactivo") {
    q("Estado inválido.", `/admin/sucursales/${id}`);
  }

  const existing = await repo.getSucursal(id);
  if (!existing) {
    q("Sucursal no encontrada.", "/admin/sucursales");
  }

  await repo.updateSucursal(id, {
    nombre,
    direccion,
    telefono,
    estado: estado as "activo" | "inactivo",
  });
  revalidatePath("/admin/sucursales");
  revalidatePath(`/admin/sucursales/${id}`);
  redirect("/admin/sucursales");
}

"use server";

import { getAdminSession } from "@/lib/auth/admin-session";
import * as repo from "@/lib/data/usuarios";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function q(msg: string, path: string) {
  redirect(`${path}?error=${encodeURIComponent(msg)}`);
}

export async function createUsuarioAction(formData: FormData) {
  const admin = await getAdminSession();
  if (!admin) {
    redirect("/login");
  }

  const nombre_completo = String(formData.get("nombre_completo") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const rol_id = Number(formData.get("rol_id"));
  const sucursalRaw = String(formData.get("sucursal_id") ?? "").trim();
  const sucursal_id = sucursalRaw === "" ? null : Number(sucursalRaw);
  const activo = String(formData.get("activo") ?? "1") === "1";

  if (!nombre_completo || !username || !password) {
    q("Completá nombre, usuario y contraseña.", "/admin/usuarios/nueva");
  }
  if (password.length < 6) {
    q("La contraseña debe tener al menos 6 caracteres.", "/admin/usuarios/nueva");
  }
  if (![1, 2, 3].includes(rol_id)) {
    q("Rol inválido.", "/admin/usuarios/nueva");
  }
  if (rol_id === 1 && sucursal_id !== null) {
    q("El administrador no debe tener sucursal asignada.", "/admin/usuarios/nueva");
  }
  if (rol_id !== 1 && (!Number.isFinite(sucursal_id) || sucursal_id === null || sucursal_id <= 0)) {
    q("Cajero y vendedor requieren sucursal.", "/admin/usuarios/nueva");
  }

  const dup = await repo.countUsername(username);
  if (dup > 0) {
    q("Ese nombre de usuario ya existe.", "/admin/usuarios/nueva");
  }

  const password_hash = bcrypt.hashSync(password, 12);
  await repo.insertUsuario({
    nombre_completo,
    username,
    password_hash,
    rol_id,
    sucursal_id: rol_id === 1 ? null : sucursal_id,
    activo,
  });
  revalidatePath("/admin/usuarios");
  redirect("/admin/usuarios");
}

export async function updateUsuarioAction(formData: FormData) {
  const admin = await getAdminSession();
  if (!admin) {
    redirect("/login");
  }

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id) || id <= 0) {
    q("ID inválido.", "/admin/usuarios");
  }

  const nombre_completo = String(formData.get("nombre_completo") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const rol_id = Number(formData.get("rol_id"));
  const sucursalRaw = String(formData.get("sucursal_id") ?? "").trim();
  const sucursal_id = sucursalRaw === "" ? null : Number(sucursalRaw);
  const activo = String(formData.get("activo") ?? "1") === "1";

  if (!nombre_completo || !username) {
    q("Nombre y usuario son obligatorios.", `/admin/usuarios/${id}`);
  }
  if (![1, 2, 3].includes(rol_id)) {
    q("Rol inválido.", `/admin/usuarios/${id}`);
  }
  if (rol_id === 1 && sucursal_id !== null) {
    q("El administrador no debe tener sucursal asignada.", `/admin/usuarios/${id}`);
  }
  if (rol_id !== 1 && (!Number.isFinite(sucursal_id) || sucursal_id === null || sucursal_id <= 0)) {
    q("Cajero y vendedor requieren sucursal.", `/admin/usuarios/${id}`);
  }

  const dup = await repo.countUsername(username, id);
  if (dup > 0) {
    q("Ese nombre de usuario ya está en uso.", `/admin/usuarios/${id}`);
  }

  const existing = await repo.getUsuario(id);
  if (!existing) {
    q("Usuario no encontrado.", "/admin/usuarios");
  }

  if (password && password.length < 6) {
    q("La contraseña debe tener al menos 6 caracteres.", `/admin/usuarios/${id}`);
  }

  await repo.updateUsuario(id, {
    nombre_completo,
    username,
    password_hash: password ? bcrypt.hashSync(password, 12) : undefined,
    rol_id,
    sucursal_id: rol_id === 1 ? null : sucursal_id,
    activo,
  });
  revalidatePath("/admin/usuarios");
  revalidatePath(`/admin/usuarios/${id}`);
  redirect("/admin/usuarios");
}

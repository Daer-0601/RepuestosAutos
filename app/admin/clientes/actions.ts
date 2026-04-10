"use server";

import { getAdminSession } from "@/lib/auth/admin-session";
import * as repo from "@/lib/data/clientes";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function q(msg: string, path: string) {
  redirect(`${path}?error=${encodeURIComponent(msg)}`);
}

export async function createClienteAction(formData: FormData) {
  const admin = await getAdminSession();
  if (!admin) {
    redirect("/login");
  }

  const nombre = String(formData.get("nombre") ?? "").trim();
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const direccion = String(formData.get("direccion") ?? "").trim() || null;
  const activo = String(formData.get("activo") ?? "1") === "1";

  if (!nombre) {
    q("El nombre es obligatorio.", "/admin/clientes/nueva");
  }

  await repo.insertCliente({ nombre, telefono, direccion, activo });
  revalidatePath("/admin/clientes");
  redirect("/admin/clientes");
}

export async function updateClienteAction(formData: FormData) {
  const admin = await getAdminSession();
  if (!admin) {
    redirect("/login");
  }

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id) || id <= 0) {
    q("ID inválido.", "/admin/clientes");
  }

  const nombre = String(formData.get("nombre") ?? "").trim();
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const direccion = String(formData.get("direccion") ?? "").trim() || null;
  const activo = String(formData.get("activo") ?? "1") === "1";

  if (!nombre) {
    q("El nombre es obligatorio.", `/admin/clientes/${id}`);
  }

  const existing = await repo.getCliente(id);
  if (!existing) {
    q("Cliente no encontrado.", "/admin/clientes");
  }

  await repo.updateCliente(id, { nombre, telefono, direccion, activo });
  revalidatePath("/admin/clientes");
  revalidatePath(`/admin/clientes/${id}`);
  redirect("/admin/clientes");
}

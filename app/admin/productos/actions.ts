"use server";

import { getAdminSession } from "@/lib/auth/admin-session";
import * as repo from "@/lib/data/productos";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function q(msg: string, path: string) {
  redirect(`${path}?error=${encodeURIComponent(msg)}`);
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function strNull(formData: FormData, key: string): string | null {
  const v = str(formData, key);
  return v === "" ? null : v;
}

function numNull(formData: FormData, key: string): number | null {
  const v = str(formData, key).replace(",", ".");
  if (v === "") {
    return null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseImagenes(formData: FormData): string[] {
  const raw = String(formData.get("imagenes") ?? "");
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export async function createProductoAction(formData: FormData) {
  const admin = await getAdminSession();
  if (!admin) {
    redirect("/login");
  }

  const codigo = str(formData, "codigo");
  const qr_payload = str(formData, "qr_payload") || codigo;
  const nombre = str(formData, "nombre");
  const estado = str(formData, "estado") || "activo";

  if (!codigo || !nombre) {
    q("Código y nombre son obligatorios.", "/admin/productos/nueva");
  }
  if (estado !== "activo" && estado !== "inactivo") {
    q("Estado inválido.", "/admin/productos/nueva");
  }
  if ((await repo.countProductoCodigo(codigo)) > 0) {
    q("Ya existe un producto con ese código.", "/admin/productos/nueva");
  }
  if ((await repo.countProductoQrPayload(qr_payload)) > 0) {
    q("Ya existe un producto con ese QR payload.", "/admin/productos/nueva");
  }

  const id = await repo.insertProducto({
    codigo,
    qr_payload,
    codigo_pieza: strNull(formData, "codigo_pieza"),
    nombre,
    especificacion: strNull(formData, "especificacion"),
    repuesto: strNull(formData, "repuesto"),
    procedencia: strNull(formData, "procedencia"),
    medida: strNull(formData, "medida"),
    descripcion: strNull(formData, "descripcion"),
    unidad: strNull(formData, "unidad"),
    marca_auto: strNull(formData, "marca_auto"),
    precio_venta_lista_bs: numNull(formData, "precio_venta_lista_bs"),
    precio_venta_lista_usd: numNull(formData, "precio_venta_lista_usd"),
    porcentaje_utilidad: numNull(formData, "porcentaje_utilidad"),
    punto_tope: numNull(formData, "punto_tope"),
    estado: estado as "activo" | "inactivo",
  });

  await repo.replaceProductoImagenes(id, parseImagenes(formData));
  revalidatePath("/admin/productos");
  redirect("/admin/productos");
}

export async function updateProductoAction(formData: FormData) {
  const admin = await getAdminSession();
  if (!admin) {
    redirect("/login");
  }

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id) || id <= 0) {
    q("ID inválido.", "/admin/productos");
  }

  const codigo = str(formData, "codigo");
  const qr_payload = str(formData, "qr_payload") || codigo;
  const nombre = str(formData, "nombre");
  const estado = str(formData, "estado") || "activo";

  if (!codigo || !nombre) {
    q("Código y nombre son obligatorios.", `/admin/productos/${id}`);
  }
  if (estado !== "activo" && estado !== "inactivo") {
    q("Estado inválido.", `/admin/productos/${id}`);
  }
  if ((await repo.countProductoCodigo(codigo, id)) > 0) {
    q("Ya existe otro producto con ese código.", `/admin/productos/${id}`);
  }
  if ((await repo.countProductoQrPayload(qr_payload, id)) > 0) {
    q("Ya existe otro producto con ese QR payload.", `/admin/productos/${id}`);
  }

  const existing = await repo.getProducto(id);
  if (!existing) {
    q("Producto no encontrado.", "/admin/productos");
  }

  await repo.updateProducto(id, {
    codigo,
    qr_payload,
    codigo_pieza: strNull(formData, "codigo_pieza"),
    nombre,
    especificacion: strNull(formData, "especificacion"),
    repuesto: strNull(formData, "repuesto"),
    procedencia: strNull(formData, "procedencia"),
    medida: strNull(formData, "medida"),
    descripcion: strNull(formData, "descripcion"),
    unidad: strNull(formData, "unidad"),
    marca_auto: strNull(formData, "marca_auto"),
    precio_venta_lista_bs: numNull(formData, "precio_venta_lista_bs"),
    precio_venta_lista_usd: numNull(formData, "precio_venta_lista_usd"),
    porcentaje_utilidad: numNull(formData, "porcentaje_utilidad"),
    punto_tope: numNull(formData, "punto_tope"),
    estado: estado as "activo" | "inactivo",
  });

  await repo.replaceProductoImagenes(id, parseImagenes(formData));
  revalidatePath("/admin/productos");
  revalidatePath(`/admin/productos/${id}`);
  redirect("/admin/productos");
}

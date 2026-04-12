import "server-only";

import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Map<string, string>([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
]);

/**
 * Guarda archivos de imagen en `public/uploads/productos/` y devuelve URLs públicas (`/uploads/...`).
 */
export async function saveProductoImagenUploads(files: File[]): Promise<string[]> {
  const out: string[] = [];
  if (files.length === 0) return out;

  const dir = path.join(process.cwd(), "public", "uploads", "productos");
  await mkdir(dir, { recursive: true });

  for (const file of files) {
    if (!(file instanceof File) || file.size <= 0) continue;
    if (file.size > MAX_BYTES) continue;
    const ext = ALLOWED.get(file.type);
    if (!ext) continue;
    const buf = Buffer.from(await file.arrayBuffer());
    const name = `${randomUUID()}${ext}`;
    await writeFile(path.join(dir, name), buf);
    out.push(`/uploads/productos/${name}`);
  }
  return out;
}

export function collectImageFilesFromFormData(formData: FormData, fieldName: string): File[] {
  const raw = formData.getAll(fieldName);
  return raw.filter((x): x is File => x instanceof File && x.size > 0);
}

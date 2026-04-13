import "server-only";

import { put } from "@vercel/blob";
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

function blobToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || undefined;
}

/**
 * Sube imágenes y devuelve URLs públicas.
 * - Si existe `BLOB_READ_WRITE_TOKEN`: **Vercel Blob** (producción / Vercel).
 * - Si no: disco `public/uploads/productos/` (desarrollo local).
 */
export async function saveProductoImagenUploads(files: File[]): Promise<string[]> {
  const out: string[] = [];
  if (files.length === 0) return out;

  const token = blobToken();

  if (token) {
    for (const file of files) {
      if (!(file instanceof File) || file.size <= 0) continue;
      if (file.size > MAX_BYTES) continue;
      const ext = ALLOWED.get(file.type);
      if (!ext) continue;
      const pathname = `productos/${randomUUID()}${ext}`;
      const result = await put(pathname, file, {
        access: "public",
        token,
        contentType: file.type || undefined,
      });
      out.push(result.url);
    }
    return out;
  }

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

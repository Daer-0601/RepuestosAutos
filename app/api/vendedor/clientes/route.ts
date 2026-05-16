import { getVendedorStaffContextOrNull } from "@/lib/auth/staff-panel-context";
import { insertCliente } from "@/lib/data/clientes";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

const MAX_NOMBRE = 255;
const MAX_TEL = 64;
const MAX_CI = 64;
const MAX_DIR = 500;

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

  const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;

  const nombreRaw = typeof b.nombre === "string" ? b.nombre.trim() : "";
  const telefonoRaw = typeof b.telefono === "string" ? b.telefono.trim() : "";
  const carnetRaw = typeof b.carnet_identidad === "string" ? b.carnet_identidad.trim() : "";
  const carnetSoloDigitos = carnetRaw.replace(/\D/g, "");
  const direccionRaw = typeof b.direccion === "string" ? b.direccion.trim() : "";

  if (!nombreRaw) {
    return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });
  }
  if (nombreRaw.length > MAX_NOMBRE) {
    return NextResponse.json({ error: "El nombre es demasiado largo." }, { status: 400 });
  }
  if (!telefonoRaw) {
    return NextResponse.json({ error: "El teléfono es obligatorio." }, { status: 400 });
  }
  if (telefonoRaw.length > MAX_TEL) {
    return NextResponse.json({ error: "El teléfono es demasiado largo." }, { status: 400 });
  }
  if (!carnetSoloDigitos) {
    return NextResponse.json(
      { error: "El carnet de identidad es obligatorio y solo puede llevar números." },
      { status: 400 }
    );
  }
  if (carnetSoloDigitos.length > MAX_CI) {
    return NextResponse.json({ error: "El carnet es demasiado largo." }, { status: 400 });
  }
  const direccion = direccionRaw ? direccionRaw.slice(0, MAX_DIR) : null;

  try {
    const clienteId = await insertCliente({
      nombre: nombreRaw.slice(0, MAX_NOMBRE),
      telefono: telefonoRaw,
      carnet_identidad: carnetSoloDigitos,
      direccion,
      activo: true,
    });
    revalidatePath("/admin/clientes");
    revalidatePath("/vendedor/clientes");
    return NextResponse.json({ clienteId });
  } catch {
    return NextResponse.json({ error: "No se pudo guardar el cliente." }, { status: 500 });
  }
}

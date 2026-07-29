import type { VentaCarritoLinea } from "@/app/vendedor/ventas/nueva/_components/venta-carrito-tabla";
import type { ClienteCreditoSeleccionado } from "@/app/vendedor/ventas/nueva/_components/cliente-credito-buscador";

const STORAGE_KEY = "vendedor:venta-nueva:borrador";

export type VentaNuevaBorrador = {
  v: 1;
  sucursalId: number;
  lineas: VentaCarritoLinea[];
  cajeroDestinoId: string;
  esCredito: boolean;
  clienteCredito: ClienteCreditoSeleccionado | null;
  clienteNombreLibre: string;
  clienteNit: string;
  savedAt: number;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isClienteCredito(v: unknown): v is ClienteCreditoSeleccionado {
  if (!isRecord(v)) return false;
  return (
    typeof v.id === "number" &&
    Number.isFinite(v.id) &&
    v.id > 0 &&
    typeof v.nombre === "string" &&
    (v.telefono === null || typeof v.telefono === "string") &&
    (v.carnet_identidad === null || typeof v.carnet_identidad === "string")
  );
}

function isCarritoProducto(v: unknown): boolean {
  if (!isRecord(v)) return false;
  return (
    typeof v.id === "number" &&
    typeof v.codigo === "string" &&
    typeof v.nombre === "string" &&
    typeof v.descripcionMostrar === "string" &&
    typeof v.stock === "number" &&
    typeof v.qrPayload === "string" &&
    Array.isArray(v.imagenesUrls)
  );
}

function isCarritoLinea(v: unknown): v is VentaCarritoLinea {
  if (!isRecord(v)) return false;
  return (
    typeof v.key === "string" &&
    isCarritoProducto(v.producto) &&
    typeof v.cantidad === "string" &&
    typeof v.precioUnitBs === "string"
  );
}

function parseBorrador(raw: string): VentaNuevaBorrador | null {
  try {
    const data = JSON.parse(raw) as unknown;
    if (!isRecord(data) || data.v !== 1) return null;
    const sucursalId = Number(data.sucursalId);
    if (!Number.isFinite(sucursalId) || sucursalId < 1) return null;
    if (!Array.isArray(data.lineas) || !data.lineas.every(isCarritoLinea)) return null;
    const cajeroDestinoId = typeof data.cajeroDestinoId === "string" ? data.cajeroDestinoId : "";
    const esCredito = Boolean(data.esCredito);
    const clienteCredito =
      data.clienteCredito === null
        ? null
        : isClienteCredito(data.clienteCredito)
          ? data.clienteCredito
          : null;
    const clienteNombreLibre =
      typeof data.clienteNombreLibre === "string" ? data.clienteNombreLibre : "";
    const clienteNit = typeof data.clienteNit === "string" ? data.clienteNit : "";
    return {
      v: 1,
      sucursalId,
      lineas: data.lineas,
      cajeroDestinoId,
      esCredito,
      clienteCredito,
      clienteNombreLibre,
      clienteNit,
      savedAt: typeof data.savedAt === "number" ? data.savedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function loadVentaNuevaBorrador(sucursalId: number): VentaNuevaBorrador | null {
  if (typeof window === "undefined" || !Number.isFinite(sucursalId) || sucursalId < 1) return null;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const draft = parseBorrador(raw);
  if (!draft || draft.sucursalId !== sucursalId) return null;
  return draft;
}

export function saveVentaNuevaBorrador(
  draft: Omit<VentaNuevaBorrador, "v" | "savedAt">
): void {
  if (typeof window === "undefined" || draft.sucursalId < 1) return;
  const payload: VentaNuevaBorrador = {
    v: 1,
    ...draft,
    savedAt: Date.now(),
  };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* cuota llena u otro error del navegador */
  }
}

export function clearVentaNuevaBorrador(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignorar */
  }
}

import type { VentaCarritoLinea, VentaCarritoProducto } from "@/app/vendedor/ventas/nueva/_components/venta-carrito-tabla";
import type { ProductoVentaCompletoRow, VentaCatalogoApiRow } from "@/lib/types/venta-vendedor-catalogo";
import { precioVentaBsPiso } from "@/lib/venta-precio-lista-tope-range";

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function round4(n: number) {
  return Math.round(n * 1e4) / 1e4;
}

export function strNum(s: string | null | undefined): number | null {
  if (s == null || s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function parseQty(s: string): number {
  const n = Math.trunc(Number(s.replace(",", ".")));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function snapCantidadToStock(raw: string, stock: number): string {
  const max = Math.max(0, Math.trunc(stock));
  const q = parseQty(raw);
  if (max < 1) return q > 0 ? String(q) : "1";
  if (q < 1) return "1";
  if (q > max) return String(max);
  return String(q);
}

export function snapCantidadMinima(raw: string): string {
  const q = parseQty(raw);
  return q < 1 ? "1" : String(q);
}

function parsePrecio(s: string, lista: number | null): number | null {
  const t = s.trim();
  if (!t) {
    return lista !== null && lista > 0 ? round2(lista) : null;
  }
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? round2(n) : null;
}

function sanitizePrecioUnitBsDigitos(raw: string): string {
  const s = raw.replace(/,/g, ".");
  let out = "";
  let dot = false;
  for (const ch of s) {
    if (ch >= "0" && ch <= "9") {
      out += ch;
      continue;
    }
    if (ch === "." && !dot) {
      out += ".";
      dot = true;
    }
  }
  return out;
}

export function precioUnitLineaEfectivo(ln: VentaCarritoLinea): number | null {
  return parsePrecio(ln.precioUnitBs, ln.producto.precio_venta_lista_bs);
}

export function defaultPrecioUnitBsStr(p: { precio_venta_lista_bs: number | null }): string {
  const lista = p.precio_venta_lista_bs;
  if (lista != null && Number.isFinite(lista) && lista > 0) {
    return String(round2(lista));
  }
  return "";
}

export function clampPrecioUnitBsInput(raw: string): string {
  const cleaned = sanitizePrecioUnitBsDigitos(raw);
  const t = cleaned.trim();
  if (t === "" || t === ".") return t;

  if (/^\d+\.$/.test(t)) {
    return t;
  }

  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return "";

  const v = round2(n);
  if (v <= 0) return "";

  return String(v);
}

export function snapPrecioUnitBsToRange(raw: string, lista: number | null, tope: number | null): string {
  const cleaned = sanitizePrecioUnitBsDigitos(raw);
  const t = cleaned.trim();
  if (t === "" || t === ".") {
    return defaultPrecioUnitBsStr({ precio_venta_lista_bs: lista });
  }
  const parseT = t.endsWith(".") ? t.slice(0, -1) : t;
  const n = Number(parseT);
  if (!Number.isFinite(n) || n <= 0) {
    return defaultPrecioUnitBsStr({ precio_venta_lista_bs: lista });
  }
  let v = round2(n);
  const piso = precioVentaBsPiso(tope);
  if (piso != null) v = Math.max(v, piso);
  return String(v);
}

export function parsePrecioUnitBsExplicito(raw: string): number | null {
  const t = sanitizePrecioUnitBsDigitos(raw).trim();
  if (!t || t === ".") return null;
  const parseT = t.endsWith(".") ? t.slice(0, -1) : t;
  const n = Number(parseT);
  return Number.isFinite(n) && n > 0 ? round2(n) : null;
}

export function subtotalLineaBs(ln: VentaCarritoLinea): number | null {
  const q = parseQty(ln.cantidad);
  if (q < 1) return null;
  const p = precioUnitLineaEfectivo(ln);
  if (p === null) return null;
  return round2(q * p);
}

function descripcionMostrarEnLineaVenta(input: {
  codigo: string;
  nombre: string;
  descripcion: string | null | undefined;
  codigo_pieza: string | null | undefined;
  medida?: string | null;
  qr_payload?: string | null;
}): string {
  const nombre = input.nombre.trim();
  const descRaw = (input.descripcion ?? "").trim();
  if (!descRaw) return nombre;
  const norm = (s: string) => s.trim().toLowerCase().replace(/\./g, "");
  const d = norm(descRaw);
  if (d === norm(nombre)) return nombre;
  const pieza = (input.codigo_pieza ?? "").trim();
  if (pieza && d === norm(pieza)) return nombre;
  const cod = input.codigo.trim();
  if (cod && d === norm(cod)) return nombre;
  const qr = (input.qr_payload ?? "").trim();
  if (qr && d === norm(qr)) return nombre;
  const med = (input.medida ?? "").trim();
  if (med && d === norm(med)) return nombre;
  return descRaw;
}

export function mapCompletoToLookup(p: ProductoVentaCompletoRow): VentaCarritoProducto {
  const descripcionMostrar = descripcionMostrarEnLineaVenta({
    codigo: p.codigo,
    nombre: p.nombre,
    descripcion: p.descripcion,
    codigo_pieza: p.codigo_pieza,
    medida: p.medida,
    qr_payload: p.qr_payload,
  });
  return {
    id: p.id,
    codigo: p.codigo,
    nombre: p.nombre,
    descripcionMostrar,
    codigoPieza: p.codigo_pieza,
    medida: p.medida,
    unidad: p.unidad,
    marcaAuto: p.marca_auto,
    procedencia: p.procedencia,
    stock: p.stockMiSucursal,
    precio_venta_lista_bs: p.precio_venta_lista_bs,
    precio_venta_lista_usd: p.precio_venta_lista_usd,
    punto_tope: p.punto_tope,
    qrPayload: p.qr_payload?.trim() ? p.qr_payload.trim() : p.codigo,
    imagenesUrls: Array.isArray(p.imagenes_urls) ? p.imagenes_urls : [],
  };
}

export function mapCatalogRowToLookup(r: VentaCatalogoApiRow, miSucursalId: number): VentaCarritoProducto {
  const stock = r.stocksPorSucursal.find((x) => x.sucursalId === miSucursalId)?.stock ?? 0;
  const descripcionMostrar = descripcionMostrarEnLineaVenta({
    codigo: r.codigo,
    nombre: r.nombre,
    descripcion: r.descripcion,
    codigo_pieza: r.codigo_pieza,
    medida: r.medida,
    qr_payload: r.qr_payload,
  });
  return {
    id: r.id,
    codigo: r.codigo,
    nombre: r.nombre,
    descripcionMostrar,
    codigoPieza: r.codigo_pieza,
    medida: r.medida,
    unidad: r.unidad,
    marcaAuto: r.marca_auto,
    procedencia: r.procedencia,
    stock,
    precio_venta_lista_bs: strNum(r.precio_venta_lista_bs),
    precio_venta_lista_usd: strNum(r.precio_venta_lista_usd),
    punto_tope: strNum(r.punto_tope),
    qrPayload: (r.qr_payload ?? "").trim() || r.codigo,
    imagenesUrls: Array.isArray(r.imagenes_urls) ? r.imagenes_urls : [],
  };
}

export function carritoProductoSinMetadatos(p: VentaCarritoProducto): boolean {
  if (!("marcaAuto" in p) || !("unidad" in p) || !("procedencia" in p)) return true;
  const marca = (p.marcaAuto ?? "").trim();
  const unidad = (p.unidad ?? "").trim();
  const procedencia = (p.procedencia ?? "").trim();
  return marca === "" && unidad === "" && procedencia === "";
}

export function fusionarProductoCarrito(prev: VentaCarritoProducto, fresh: VentaCarritoProducto): VentaCarritoProducto {
  return {
    ...prev,
    ...fresh,
    stock: fresh.stock,
  };
}

export function nuevaLineaCarrito(p: VentaCarritoProducto): VentaCarritoLinea {
  return {
    key: typeof crypto !== "undefined" ? crypto.randomUUID() : String(Math.random()),
    producto: p,
    cantidad: "1",
    precioUnitBs: defaultPrecioUnitBsStr(p),
  };
}

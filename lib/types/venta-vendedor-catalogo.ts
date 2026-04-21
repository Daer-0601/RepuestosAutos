/** Tipos compartidos API catálogo / lookup venta (cliente + servidor). */

export type StockSucursalInfo = {
  sucursalId: number;
  sucursalNombre: string;
  stock: number;
};

export type ProductoVentaCompletoRow = {
  id: number;
  codigo: string;
  nombre: string;
  precio_venta_lista_bs: number | null;
  precio_venta_lista_usd: number | null;
  punto_tope: number | null;
  stockMiSucursal: number;
  porSucursal: StockSucursalInfo[];
  puedeVenderEnMiSucursal: boolean;
};

export type VentaCatalogoApiRow = {
  id: number;
  codigo: string;
  nombre: string;
  codigo_pieza: string | null;
  medida: string | null;
  descripcion: string | null;
  precio_venta_lista_bs: string | null;
  precio_venta_lista_usd: string | null;
  punto_tope: string | null;
  stock_total: number;
  stocksPorSucursal: { sucursalId: number; stock: number }[];
};

export type ModoCatalogoVenta = "mi_sucursal" | "referencia" | "todos";

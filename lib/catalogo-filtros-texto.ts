export type CatalogoTextFilterName =
  | "q"
  | "codigo"
  | "codigo_pieza"
  | "especificacion"
  | "medida"
  | "descripcion"
  | "repuesto";

export type CatalogoTextFilterValues = Record<CatalogoTextFilterName, string>;

export function emptyCatalogoTextFilters(): CatalogoTextFilterValues {
  return {
    q: "",
    codigo: "",
    codigo_pieza: "",
    especificacion: "",
    medida: "",
    descripcion: "",
    repuesto: "",
  };
}

/** Al escribir en un buscador, vacía los demás campos de texto del catálogo. */
export function applyCatalogoTextFilterChange(
  name: CatalogoTextFilterName,
  value: string,
  prev: CatalogoTextFilterValues
): CatalogoTextFilterValues {
  if (value.length > 0) {
    return { ...emptyCatalogoTextFilters(), [name]: value };
  }
  return { ...prev, [name]: value };
}

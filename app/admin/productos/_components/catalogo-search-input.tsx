"use client";

export type CatalogoTextFilterName =
  | "q"
  | "codigo"
  | "codigo_pieza"
  | "especificacion"
  | "medida"
  | "descripcion"
  | "repuesto";

/**
 * Input de filtro del catálogo (GET). Sin limpiar otros campos al enfocar: eso borraba «Código»
 * si el usuario pasaba el foco a otro campo antes de «Buscar». La deduplicación `q` vs `codigo`
 * se resuelve en el servidor (`parseCatalogoFiltrosCore`).
 */
export function CatalogoSearchInput({
  name,
  defaultValue,
  placeholder,
  className,
}: {
  name: CatalogoTextFilterName;
  defaultValue: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      name={name}
      defaultValue={defaultValue}
      placeholder={placeholder}
      autoComplete="off"
      className={className}
    />
  );
}

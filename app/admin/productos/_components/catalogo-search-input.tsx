"use client";

const TEXT_FILTER_NAMES = [
  "q",
  "codigo",
  "codigo_pieza",
  "especificacion",
  "medida",
  "descripcion",
  "repuesto",
] as const;

export type CatalogoTextFilterName = (typeof TEXT_FILTER_NAMES)[number];

function clearOtherTextFilters(form: HTMLFormElement, keepName: string) {
  for (const name of TEXT_FILTER_NAMES) {
    if (name === keepName) continue;
    const el = form.elements.namedItem(name);
    if (el instanceof HTMLInputElement) {
      el.value = "";
    }
  }
}

/**
 * Input de filtro del catálogo: al enfocar, vacía los demás buscadores de texto
 * (un criterio a la vez antes de pulsar «Buscar»).
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
      onFocus={(e) => {
        const form = e.currentTarget.form;
        if (form) {
          clearOtherTextFilters(form, name);
        }
      }}
    />
  );
}

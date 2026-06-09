"use client";

import {
  applyCatalogoTextFilterChange,
  emptyCatalogoTextFilters,
  type CatalogoTextFilterName,
  type CatalogoTextFilterValues,
} from "@/lib/catalogo-filtros-texto";
import { createContext, useContext, useMemo, useState } from "react";

const CatalogoSearchContext = createContext<{
  values: CatalogoTextFilterValues;
  setField: (name: CatalogoTextFilterName, value: string) => void;
} | null>(null);

export function CatalogoSearchProvider({
  initial,
  children,
}: {
  initial: CatalogoTextFilterValues;
  children: React.ReactNode;
}) {
  const [values, setValues] = useState(initial);

  const setField = (name: CatalogoTextFilterName, value: string) => {
    setValues((prev) => applyCatalogoTextFilterChange(name, value, prev));
  };

  const ctx = useMemo(() => ({ values, setField }), [values]);

  return <CatalogoSearchContext.Provider value={ctx}>{children}</CatalogoSearchContext.Provider>;
}

export function CatalogoSearchInput({
  name,
  placeholder,
  className,
}: {
  name: CatalogoTextFilterName;
  placeholder?: string;
  className?: string;
}) {
  const ctx = useContext(CatalogoSearchContext);
  if (!ctx) {
    throw new Error("CatalogoSearchInput debe usarse dentro de CatalogoSearchProvider");
  }

  return (
    <input
      name={name}
      value={ctx.values[name]}
      onChange={(e) => ctx.setField(name, e.target.value)}
      placeholder={placeholder}
      autoComplete="off"
      className={className}
    />
  );
}

export { emptyCatalogoTextFilters, type CatalogoTextFilterName, type CatalogoTextFilterValues };

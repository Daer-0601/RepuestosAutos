const accents = {
  cajero: "border-emerald-500/20 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.06)]",
  vendedor: "border-amber-500/25 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.08)]",
} as const;

export function PanelSection({
  title,
  description,
  children,
  variant,
  wide = false,
}: {
  title?: string;
  description?: string;
  children?: React.ReactNode;
  variant: keyof typeof accents;
  /** Pantallas densas (p. ej. POS / salidas): más ancho que el panel estándar. */
  wide?: boolean;
}) {
  const hasTitle = Boolean(title?.trim());
  const hasDescription = Boolean(description?.trim());
  const showHeader = hasTitle || hasDescription;
  return (
    <div
      className={
        wide
          ? "mx-auto w-full max-w-[min(96rem,calc(100vw-1.25rem))]"
          : "mx-auto max-w-4xl"
      }
    >
      {hasTitle ? (
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {title}
        </h1>
      ) : null}
      {hasDescription ? (
        <p className={`text-sm text-slate-400 ${hasTitle ? "mt-2" : ""}`}>{description}</p>
      ) : null}
      <div
        className={`${showHeader ? "mt-8" : ""} rounded-2xl border bg-slate-900/50 p-6 text-sm leading-relaxed text-slate-400 sm:p-8 ${accents[variant]}`}
      >
        {children ?? (
          <p>
            Próximamente: datos filtrados por tu sucursal desde MySQL.
          </p>
        )}
      </div>
    </div>
  );
}

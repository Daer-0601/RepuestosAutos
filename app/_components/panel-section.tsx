const accents = {
  cajero: "border-emerald-500/20 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.06)]",
  vendedor: "border-amber-500/25 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.08)]",
} as const;

export function PanelSection({
  title,
  description,
  children,
  variant,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  variant: keyof typeof accents;
}) {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        {title}
      </h1>
      {description ? (
        <p className="mt-2 text-sm text-slate-400">{description}</p>
      ) : null}
      <div
        className={`mt-8 rounded-2xl border bg-slate-900/50 p-6 text-sm leading-relaxed text-slate-400 sm:p-8 ${accents[variant]}`}
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

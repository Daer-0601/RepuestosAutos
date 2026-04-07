export function AdminSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        {title}
      </h1>
      {description ? (
        <p className="mt-2 text-sm text-slate-400">{description}</p>
      ) : null}
      <div className="mt-8 rounded-2xl border border-white/10 bg-slate-900/50 p-6 text-sm leading-relaxed text-slate-400 shadow-inner shadow-black/20 sm:p-8">
        {children ?? (
          <p>
            Próximamente: pantallas con datos reales desde MySQL (listados, altas y
            ediciones).
          </p>
        )}
      </div>
    </div>
  );
}

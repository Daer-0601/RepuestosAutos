import Link from "next/link";

export function AdminPageShell({
  title,
  description,
  actions,
  error,
  backHref,
  backLabel = "Volver",
  children,
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  error?: string | null;
  /** Enlace “atrás” (p. ej. listado) encima del título y del contenido. */
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
}) {
  const showHeading = Boolean(title?.trim()) || Boolean(description?.trim());

  return (
    <div className="mx-auto max-w-6xl">
      {backHref ? (
        <nav className="mb-5" aria-label="Volver atrás">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-400/90 hover:text-emerald-300 hover:underline"
          >
            <span className="text-base leading-none" aria-hidden>
              ←
            </span>
            {backLabel}
          </Link>
        </nav>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {showHeading ? (
          <div>
            {title?.trim() ? (
              <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title.trim()}</h1>
            ) : null}
            {description?.trim() ? (
              <p className={`max-w-2xl text-sm text-slate-400 ${title?.trim() ? "mt-2" : ""}`}>{description.trim()}</p>
            ) : null}
          </div>
        ) : null}
        {actions ? (
          <div className={`flex shrink-0 flex-wrap gap-2 ${showHeading ? "" : "sm:ml-auto"}`}>{actions}</div>
        ) : null}
      </div>
      {error ? (
        <p
          className="mt-6 rounded-xl border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm text-rose-100"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <div className="mt-8">{children}</div>
      <p className="mt-10">
        <Link
          href="/admin"
          className="text-sm text-emerald-400/90 hover:text-emerald-300 hover:underline"
        >
          ← Volver al inicio admin
        </Link>
      </p>
    </div>
  );
}

import Link from "next/link";

export function AdminPageShell({
  title,
  description,
  actions,
  error,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm text-slate-400">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
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

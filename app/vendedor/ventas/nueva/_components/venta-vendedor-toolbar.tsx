"use client";

import { Store } from "lucide-react";

export function VentaVendedorToolbar({
  sucursalNombre,
  username,
  tipoCambioBsPorUsd,
  fechaStr,
  horaStr,
}: {
  sucursalNombre: string;
  username: string;
  tipoCambioBsPorUsd: number | null;
  fechaStr: string;
  horaStr: string;
}) {
  const tc =
    tipoCambioBsPorUsd != null && tipoCambioBsPorUsd > 0
      ? `${tipoCambioBsPorUsd.toFixed(2)} Bs/USD`
      : "Sin tipo de cambio";

  return (
    <header className="flex flex-col gap-4 rounded-2xl border border-amber-500/20 bg-slate-950/70 px-4 py-4 shadow-lg shadow-black/20 sm:flex-row sm:items-stretch sm:justify-between sm:gap-6">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/35"
          aria-hidden
        >
          <Store className="h-5 w-5" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Tu sucursal</p>
          <p className="truncate text-base font-semibold text-white">{sucursalNombre || "—"}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 border-y border-white/5 py-3 sm:border-y-0 sm:py-0 sm:pl-6 md:border-l md:border-white/10">
        <div className="text-left sm:text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Hora local</p>
          <p className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-amber-50">{horaStr}</p>
          <p className="font-mono text-xs text-slate-500">{fechaStr}</p>
        </div>
      </div>

      <dl className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-2 text-right sm:min-w-[220px] sm:content-center">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Usuario</dt>
          <dd className="truncate font-mono text-sm text-slate-200">{username || "—"}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Tipo de cambio</dt>
          <dd className={`font-mono text-sm ${tipoCambioBsPorUsd ? "text-emerald-300/95" : "text-amber-200/70"}`}>
            {tc}
          </dd>
        </div>
      </dl>
    </header>
  );
}

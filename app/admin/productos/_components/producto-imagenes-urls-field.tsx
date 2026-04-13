"use client";

import { useState } from "react";

/**
 * Lista URLs existentes con opción de quitar; mantiene `name="imagenes"` (una por línea) para el server action.
 */
export function ProductoImagenesUrlsField({ initialUrls }: { initialUrls: string[] }) {
  const [urls, setUrls] = useState(() => [...initialUrls]);

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Imágenes actuales</span>
      {urls.length === 0 ? (
        <p className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-xs text-slate-500">
          Sin imágenes. Podés subir nuevas abajo.
        </p>
      ) : (
        <ul className="space-y-2">
          {urls.map((url, i) => (
            <li
              key={`${url}-${i}`}
              className="flex items-center gap-3 rounded-lg border border-white/10 bg-slate-950/40 px-2 py-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-14 w-14 shrink-0 rounded-md border border-white/10 object-cover" />
              <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-400" title={url}>
                {url}
              </span>
              <button
                type="button"
                className="shrink-0 rounded-lg border border-rose-500/30 bg-rose-950/40 px-2.5 py-1 text-xs font-medium text-rose-200 hover:border-rose-400/50 hover:bg-rose-900/50"
                onClick={() => setUrls((prev) => prev.filter((_, j) => j !== i))}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
      <textarea
        name="imagenes"
        value={urls.join("\n")}
        readOnly
        tabIndex={-1}
        aria-hidden
        className="sr-only"
        rows={1}
        cols={1}
      />
    </div>
  );
}

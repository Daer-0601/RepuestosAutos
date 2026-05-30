"use client";

import { Loader2, Search, User, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";

export type ClienteCreditoSeleccionado = {
  id: number;
  nombre: string;
  telefono: string | null;
  carnet_identidad: string | null;
};

type ClienteRow = ClienteCreditoSeleccionado;

const inp =
  "w-full min-w-0 rounded border border-white/10 bg-slate-950/80 px-2 py-1.5 text-xs text-white outline-none placeholder:text-slate-600 focus:border-amber-500/40";

export function ClienteCreditoBuscador({
  value,
  onChange,
  disabled,
}: {
  value: ClienteCreditoSeleccionado | null;
  onChange: (cliente: ClienteCreditoSeleccionado | null) => void;
  disabled?: boolean;
}) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [q, setQ] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resultados, setResultados] = useState<ClienteRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const buscar = useCallback(async (term: string) => {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams({ q: term, limit: "25" });
      const res = await fetch(`/api/vendedor/clientes/activos?${params}`, { cache: "no-store" });
      const data = (await res.json()) as { clientes?: ClienteRow[]; error?: string };
      if (!res.ok) {
        setResultados([]);
        setErr(data.error ?? "No se pudieron buscar clientes.");
        return;
      }
      setResultados(Array.isArray(data.clientes) ? data.clientes : []);
    } catch {
      setResultados([]);
      setErr("Error de red al buscar clientes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!abierto || value) return;
    const t = window.setTimeout(() => {
      void buscar(q.trim());
    }, 220);
    return () => window.clearTimeout(t);
  }, [abierto, q, value, buscar]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function seleccionar(c: ClienteRow) {
    onChange(c);
    setQ("");
    setAbierto(false);
    setResultados([]);
  }

  function limpiar() {
    onChange(null);
    setQ("");
    setAbierto(false);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  if (value) {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5">
        <User className="h-3.5 w-3.5 shrink-0 text-amber-300/80" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-amber-50">{value.nombre}</p>
          <p className="truncate font-mono text-[10px] text-slate-400">
            {[value.telefono, value.carnet_identidad].filter(Boolean).join(" · ") || "Sin teléfono / carnet"}
          </p>
        </div>
        <button
          type="button"
          onClick={limpiar}
          disabled={disabled}
          className="shrink-0 rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-40"
          aria-label="Quitar cliente"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative min-w-0 flex-1">
      <label htmlFor={listId} className="sr-only">
        Buscar cliente registrado
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500"
          aria-hidden
        />
        <input
          ref={inputRef}
          id={listId}
          type="search"
          value={q}
          disabled={disabled}
          onChange={(e) => {
            setQ(e.target.value);
            setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
          placeholder="Nombre, teléfono o carnet…"
          autoComplete="off"
          className={`${inp} min-w-[14rem] pl-8 pr-8`}
        />
        {loading ? (
          <Loader2
            className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-slate-500"
            aria-hidden
          />
        ) : null}
      </div>

      {abierto ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-auto rounded-xl border border-white/15 bg-slate-900 shadow-xl shadow-black/40">
          {err ? (
            <p className="px-3 py-2.5 text-xs text-rose-300">{err}</p>
          ) : loading && resultados.length === 0 ? (
            <p className="flex items-center gap-2 px-3 py-2.5 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando…
            </p>
          ) : resultados.length === 0 ? (
            <div className="space-y-2 px-3 py-2.5 text-xs text-slate-500">
              <p>{q.trim() ? "Sin coincidencias en tus clientes registrados." : "No hay clientes activos todavía."}</p>
              <Link
                href="/vendedor/clientes/nueva"
                className="inline-flex font-medium text-amber-400 hover:text-amber-300"
              >
                Registrar nuevo cliente →
              </Link>
            </div>
          ) : (
            <ul role="listbox" aria-label="Clientes">
              {resultados.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    role="option"
                    onClick={() => seleccionar(c)}
                    className="flex w-full flex-col gap-0.5 border-b border-white/5 px-3 py-2.5 text-left transition last:border-0 hover:bg-white/5"
                  >
                    <span className="text-sm font-medium text-white">{c.nombre}</span>
                    <span className="font-mono text-[10px] text-slate-500">
                      {c.telefono ?? "—"} · {c.carnet_identidad ?? "—"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

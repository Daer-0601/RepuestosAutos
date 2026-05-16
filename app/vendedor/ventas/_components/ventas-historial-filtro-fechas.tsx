"use client";

import { formatDateTimeMysqlBolivia } from "@/lib/fecha-bolivia";
import { Calendar } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const DOW = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"] as const;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toIso(y: number, m: number, d: number) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function parseIso(s: string): { y: number; m: number; d: number } | null {
  const t = s.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const [y, m, d] = t.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return { y, m, d };
}

function todayIsoBolivia(): string {
  return formatDateTimeMysqlBolivia(new Date()).slice(0, 10);
}

function monthGrid(year: number, month: number): (number | null)[] {
  const first = new Date(year, month - 1, 1);
  const lead = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

const monthNamesEs = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export type FiltroHistorialAccent = "vendedor" | "cajero";

function MiniDatePickerField({
  name,
  label,
  defaultValue,
  id,
  accent,
}: {
  name: string;
  label: string;
  defaultValue: string | null;
  id: string;
  accent: FiltroHistorialAccent;
}) {
  const [value, setValue] = useState(defaultValue?.trim() || "");
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  const initial = parseIso(value) ?? parseIso(todayIsoBolivia())!;
  const [viewY, setViewY] = useState(initial.y);
  const [viewM, setViewM] = useState(initial.m);

  useEffect(() => {
    const v = defaultValue?.trim() || "";
    setValue(v);
    const p = parseIso(v);
    if (p) {
      setViewY(p.y);
      setViewM(p.m);
    }
  }, [defaultValue]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const grid = monthGrid(viewY, viewM);
  const displayText = value
    ? new Date(value + "T12:00:00").toLocaleDateString("es-BO", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Elegir fecha…";

  return (
    <div className="relative" ref={anchorRef}>
      <label htmlFor={id + "-btn"} className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      <input type="hidden" name={name} value={value} />
      <button
        id={id + "-btn"}
        type="button"
        onClick={() => {
          setOpen((o) => {
            const next = !o;
            if (next && !value.trim()) {
              const t = parseIso(todayIsoBolivia())!;
              setViewY(t.y);
              setViewM(t.m);
            }
            return next;
          });
        }}
        className={`mt-1 flex w-full min-w-[11rem] items-center gap-2 rounded-lg border border-white/15 bg-slate-950/80 px-2.5 py-1.5 text-left text-sm text-white outline-none sm:min-w-[12.5rem] ${
          accent === "cajero" ? "focus:border-emerald-500/40" : "focus:border-amber-500/40"
        }`}
      >
        <Calendar
          className={`h-4 w-4 shrink-0 ${accent === "cajero" ? "text-emerald-400/80" : "text-amber-400/80"}`}
          aria-hidden
        />
        <span className={`min-w-0 flex-1 truncate font-mono text-xs ${value ? "text-slate-100" : "text-slate-500"}`}>
          {displayText}
        </span>
      </button>

      {open ? (
        <div
          className={`absolute left-0 top-full z-[100] mt-1 w-[min(calc(100vw-2rem),17rem)] rounded-xl border bg-slate-900 p-2 shadow-xl shadow-black/40 ring-1 ring-white/10 ${
            accent === "cajero" ? "border-emerald-500/25" : "border-amber-500/25"
          }`}
          role="dialog"
          aria-label={`Calendario ${label}`}
        >
          <div className="mb-2 flex items-center justify-between gap-1 border-b border-white/10 pb-2">
            <button
              type="button"
              className="rounded-md px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
              onClick={() => {
                let y = viewY;
                let m = viewM - 1;
                if (m < 1) {
                  m = 12;
                  y -= 1;
                }
                setViewY(y);
                setViewM(m);
              }}
            >
              ‹
            </button>
            <span
              className={`text-center text-xs font-semibold ${
                accent === "cajero" ? "text-emerald-100/95" : "text-amber-100/95"
              }`}
            >
              {monthNamesEs[viewM - 1]} {viewY}
            </span>
            <button
              type="button"
              className="rounded-md px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
              onClick={() => {
                let y = viewY;
                let m = viewM + 1;
                if (m > 12) {
                  m = 1;
                  y += 1;
                }
                setViewY(y);
                setViewM(m);
              }}
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold text-slate-500">
            {DOW.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="mt-0.5 grid grid-cols-7 gap-0.5">
            {grid.map((d, i) =>
              d == null ? (
                <div key={`e-${i}`} className="aspect-square" />
              ) : (
                <button
                  key={d}
                  type="button"
                  className={`aspect-square rounded-md text-xs font-mono transition ${
                    accent === "cajero" ? "hover:bg-emerald-500/25" : "hover:bg-amber-500/25"
                  } ${
                    value === toIso(viewY, viewM, d)
                      ? accent === "cajero"
                        ? "bg-emerald-500/30 font-semibold text-emerald-50 ring-1 ring-emerald-500/40"
                        : "bg-amber-500/30 font-semibold text-amber-50 ring-1 ring-amber-500/40"
                      : "text-slate-200"
                  }`}
                  onClick={() => {
                    setValue(toIso(viewY, viewM, d));
                    setOpen(false);
                  }}
                >
                  {d}
                </button>
              )
            )}
          </div>
          <div className="mt-2 flex justify-between gap-2 border-t border-white/10 pt-2">
            <button
              type="button"
              className="text-[11px] text-slate-400 underline decoration-slate-600 underline-offset-2 hover:text-slate-200"
              onClick={() => {
                const t = todayIsoBolivia();
                const p = parseIso(t)!;
                setViewY(p.y);
                setViewM(p.m);
                setValue(t);
                setOpen(false);
              }}
            >
              Hoy
            </button>
            <button
              type="button"
              className="text-[11px] text-slate-400 underline decoration-slate-600 underline-offset-2 hover:text-slate-200"
              onClick={() => {
                setValue("");
                setOpen(false);
              }}
            >
              Borrar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function VentasHistorialFiltroFechas({
  defaultDesde,
  defaultHasta,
  hayParamsFiltro,
  formAction = "/vendedor/ventas",
  clearHref = "/vendedor/ventas",
  accent = "vendedor",
  fieldIdPrefix = "hist",
}: {
  defaultDesde: string | null;
  defaultHasta: string | null;
  hayParamsFiltro: boolean;
  /** Destino GET del formulario (misma ruta con query `desde` / `hasta`). */
  formAction?: string;
  /** Destino del enlace «Limpiar fechas». */
  clearHref?: string;
  accent?: FiltroHistorialAccent;
  /** Prefijo de `id` en botones/calendarios (accesibilidad). */
  fieldIdPrefix?: string;
}) {
  return (
    <form
      method="get"
      className="flex flex-col gap-3 rounded-xl border border-white/10 bg-slate-950/40 p-4 sm:flex-row sm:flex-wrap sm:items-end"
      action={formAction}
    >
      <MiniDatePickerField
        name="desde"
        label="Desde"
        defaultValue={defaultDesde}
        id={`${fieldIdPrefix}-desde`}
        accent={accent}
      />
      <MiniDatePickerField
        name="hasta"
        label="Hasta"
        defaultValue={defaultHasta}
        id={`${fieldIdPrefix}-hasta`}
        accent={accent}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          className={
            accent === "cajero"
              ? "rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
              : "rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400"
          }
        >
          Filtrar
        </button>
        {hayParamsFiltro ? (
          <Link
            href={clearHref}
            className="inline-flex items-center rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
          >
            Limpiar fechas
          </Link>
        ) : null}
      </div>
    </form>
  );
}

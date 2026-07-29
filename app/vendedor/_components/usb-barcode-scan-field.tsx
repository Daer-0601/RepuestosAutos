"use client";

import { ScanLine } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

/** Limpia lo que envían lectores USB-HID (CR/LF, espacios, prefijos raros). */
export function normalizarLecturaScanner(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/^\u001d/, "")
    .trim();
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** Se dispara con Enter del lector (o del teclado). */
  onSubmitCodigo: (codigo: string) => void | Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  /** Si true, captura lecturas rápidas aunque el foco no esté en el campo (siempre que no estés escribiendo en otro input). */
  capturaGlobal?: boolean;
  className?: string;
  inputClassName?: string;
};

/**
 * Entrada para lectores USB tipo teclado (ZKTECO ZKB209, etc.):
 * escriben el código y terminan con Enter.
 */
export function UsbBarcodeScanField({
  value,
  onChange,
  onSubmitCodigo,
  disabled = false,
  placeholder = "Apuntá el lector al QR o código de barras…",
  capturaGlobal = true,
  className = "",
  inputClassName = "",
}: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const bufferRef = useRef("");
  const lastKeyAtRef = useRef(0);
  const [focused, setFocused] = useState(false);
  const submittingRef = useRef(false);

  const focusInput = useCallback(() => {
    const el = inputRef.current;
    if (!el || disabled) return;
    el.focus({ preventScroll: true });
    el.select();
  }, [disabled]);

  const disparar = useCallback(
    async (raw: string) => {
      const codigo = normalizarLecturaScanner(raw);
      if (!codigo || submittingRef.current || disabled) return;
      submittingRef.current = true;
      try {
        await onSubmitCodigo(codigo);
      } finally {
        submittingRef.current = false;
        onChange("");
        // El ZKB209 dispara Enter; dejamos el campo listo para el siguiente scan.
        requestAnimationFrame(() => focusInput());
      }
    },
    [disabled, focusInput, onChange, onSubmitCodigo]
  );

  useEffect(() => {
    if (!disabled) {
      const t = window.setTimeout(() => focusInput(), 80);
      return () => window.clearTimeout(t);
    }
  }, [disabled, focusInput]);

  useEffect(() => {
    if (!capturaGlobal || disabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target;
      if (target instanceof HTMLElement) {
        // El propio campo maneja Enter / escritura; no duplicar.
        if (target === inputRef.current) {
          bufferRef.current = "";
          return;
        }
        const tag = target.tagName;
        const isEditable =
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable;
        if (isEditable) return;
      }

      const now = Date.now();
      const gap = now - lastKeyAtRef.current;
      lastKeyAtRef.current = now;

      if (e.key === "Enter") {
        const buf = bufferRef.current;
        bufferRef.current = "";
        if (buf.length >= 3 && gap < 120) {
          e.preventDefault();
          onChange(buf);
          void disparar(buf);
        }
        return;
      }

      if (e.key.length === 1) {
        if (gap > 80) bufferRef.current = "";
        bufferRef.current += e.key;
        if (bufferRef.current.length >= 2) {
          focusInput();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [capturaGlobal, disabled, disparar, focusInput, onChange]);

  return (
    <div className={className}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
            focused && !disabled
              ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-100"
              : "border-white/10 bg-slate-950/60 text-slate-500"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              focused && !disabled ? "bg-emerald-400" : "bg-slate-600"
            }`}
            aria-hidden
          />
          {focused && !disabled ? "Lector listo (ZKB209 / USB)" : "Hacé clic en el campo para escanear"}
        </p>
        <button
          type="button"
          onClick={focusInput}
          disabled={disabled}
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-100 hover:bg-amber-500/20 disabled:opacity-40"
        >
          Enfocar lector
        </button>
      </div>
      <div className="relative min-w-0 flex-1">
        <ScanLine
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-amber-400/60"
          aria-hidden
        />
        <input
          id={inputId}
          ref={inputRef}
          className={inputClassName}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void disparar(value);
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          inputMode="none"
          disabled={disabled}
          aria-label="Código o QR del lector"
        />
      </div>
    </div>
  );
}

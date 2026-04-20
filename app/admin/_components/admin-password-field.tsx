"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 pr-10 text-sm text-white outline-none focus:border-emerald-500/40";

export function AdminPasswordField({
  id,
  name,
  label,
  required,
  autoComplete = "new-password",
  placeholder,
  defaultValue,
}: {
  id: string;
  name: string;
  label: string;
  required?: boolean;
  autoComplete?: string;
  placeholder?: string;
  defaultValue?: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="text-xs font-medium uppercase tracking-wider text-slate-500">
        {label}
      </label>
      <div className="relative mt-1">
        <input
          id={id}
          name={name}
          type={show ? "text" : "password"}
          required={required}
          autoComplete={autoComplete}
          placeholder={placeholder}
          defaultValue={defaultValue}
          className={inputClass}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-1 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md border border-white/10 text-slate-300 transition hover:bg-white/10 hover:text-white"
          aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
          title={show ? "Ocultar contraseña" : "Mostrar contraseña"}
        >
          {show ? <EyeOff className="h-4 w-4" strokeWidth={1.75} /> : <Eye className="h-4 w-4" strokeWidth={1.75} />}
        </button>
      </div>
    </div>
  );
}

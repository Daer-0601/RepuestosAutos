"use client";

import {
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  User,
} from "lucide-react";
import { useActionState, useState } from "react";
import { login, type LoginState } from "./actions";

const initial: LoginState = null;

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initial);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="space-y-1.5">
        <label htmlFor="username" className="sr-only">
          Usuario
        </label>
        <div className="group relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-emerald-300/90">
            <User className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
          </span>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            required
            className="w-full rounded-xl border border-white/10 bg-slate-950/40 py-3 pl-11 pr-3.5 text-[15px] text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-rose-400/35 focus:bg-slate-950/55 focus:shadow-[0_0_0_3px_rgba(244,63,94,0.12)]"
            placeholder="Usuario"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="sr-only">
          Contraseña
        </label>
        <div className="group relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-emerald-300/90">
            <Lock className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
          </span>
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            className="w-full rounded-xl border border-white/10 bg-slate-950/40 py-3 pl-11 pr-12 text-[15px] text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-emerald-400/35 focus:bg-slate-950/55 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.12)]"
            placeholder="Contraseña"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg border border-white/10 text-slate-300 transition hover:bg-white/10 hover:text-white"
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {showPassword ? (
              <EyeOff className="h-[18px] w-[18px]" strokeWidth={1.75} />
            ) : (
              <Eye className="h-[18px] w-[18px]" strokeWidth={1.75} />
            )}
          </button>
        </div>
      </div>

      {state?.error ? (
        <div
          className="flex gap-2.5 rounded-xl border border-rose-400/20 bg-rose-950/40 px-3.5 py-2.5 text-sm text-rose-100/95"
          role="alert"
        >
          <AlertCircle
            className="mt-0.5 h-4 w-4 shrink-0 text-rose-300/90"
            strokeWidth={2}
            aria-hidden
          />
          <p className="leading-snug">{state.error}</p>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 via-rose-600 to-emerald-700 text-sm font-semibold text-white shadow-[0_12px_32px_-8px_rgba(190,18,60,0.45),0_0_0_1px_rgba(16,185,129,0.12)] transition hover:brightness-[1.05] hover:shadow-[0_14px_36px_-8px_rgba(190,18,60,0.5),0_0_0_1px_rgba(52,211,153,0.22)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-55"
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            <span>Entrando…</span>
          </>
        ) : (
          <span>Entrar</span>
        )}
      </button>
    </form>
  );
}

import type { Metadata } from "next";
import { BarChart3, Building2, Package } from "lucide-react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Iniciar sesión — Repuestos",
  description: "Acceso al sistema de repuestos por sucursal.",
};

export default function LoginPage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden text-slate-100">
      {/* Fondo: altura completa, sin “corte” a negro abajo */}
      <div
        className="absolute inset-0 min-h-dvh bg-gradient-to-br from-[#1e293b] via-[#1c2540] to-[#1a2f32]"
        aria-hidden
      />
      <div
        className="absolute inset-0 min-h-dvh bg-[radial-gradient(ellipse_100%_70%_at_0%_-10%,rgba(244,63,94,0.16),transparent_55%)]"
        aria-hidden
      />
      <div
        className="absolute inset-0 min-h-dvh bg-[radial-gradient(ellipse_85%_65%_at_100%_110%,rgba(16,185,129,0.2),transparent_50%)]"
        aria-hidden
      />
      <div
        className="absolute inset-0 min-h-dvh bg-[radial-gradient(ellipse_50%_40%_at_50%_50%,rgba(52,211,153,0.06),transparent_60%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 min-h-dvh opacity-[0.4] bg-[linear-gradient(to_right,rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:linear-gradient(to_bottom,black_0%,black_75%,transparent_100%)]"
        aria-hidden
      />

      <div className="relative z-10 flex min-h-dvh flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6">
        <div className="flex w-full max-w-[860px] flex-col items-center gap-10 lg:flex-row lg:items-center lg:justify-center lg:gap-12 xl:max-w-[900px] xl:gap-14">
          {/* Marca: ancho fijo para no separar demasiado del formulario */}
          <aside className="relative hidden w-full max-w-[340px] shrink-0 lg:block">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] p-9 shadow-[0_0_0_1px_rgba(16,185,129,0.06),0_28px_80px_-24px_rgba(15,23,42,0.9),0_0_80px_-20px_rgba(16,185,129,0.12)] backdrop-blur-md">
              <div
                className="pointer-events-none absolute inset-0 opacity-90"
                style={{
                  background:
                    "conic-gradient(from 200deg at 50% 50%, rgba(244,63,94,0.14), rgba(16,185,129,0.14), rgba(52,211,153,0.08), rgba(244,63,94,0.14))",
                }}
                aria-hidden
              />
              <div className="relative flex flex-col items-center text-center">
                <div className="mb-5 flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-rose-700 shadow-lg shadow-rose-950/45 ring-2 ring-white/15">
                  <span className="text-2xl font-bold tracking-tight text-white">
                    R
                  </span>
                </div>
                <p className="text-lg font-semibold tracking-tight text-white">
                  Repuestos
                </p>
                <div
                  className="mt-5 flex gap-2.5"
                  role="list"
                  aria-label="Módulos"
                >
                  <div
                    role="listitem"
                    title="Stock"
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-400/20 bg-gradient-to-br from-rose-500/35 to-rose-800/20 text-rose-100 shadow-inner"
                  >
                    <Package className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
                  </div>
                  <div
                    role="listitem"
                    title="Reportes"
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/25 bg-gradient-to-br from-emerald-400/30 to-emerald-900/25 text-emerald-100 shadow-inner ring-1 ring-emerald-400/15"
                  >
                    <BarChart3 className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
                  </div>
                  <div
                    role="listitem"
                    title="Sucursales"
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-slate-400/25 to-slate-700/20 text-slate-100 shadow-inner"
                  >
                    <Building2 className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Separador desktop: rojo → verde */}
          <div
            className="relative hidden h-48 w-px shrink-0 bg-gradient-to-b from-transparent via-rose-500/25 to-emerald-500/35 lg:block"
            aria-hidden
          />

          {/* Formulario: misma anchura para título y caja */}
          <div className="relative w-full max-w-[400px] shrink-0">
            <div
              className="pointer-events-none absolute -inset-x-20 -inset-y-16 rounded-full bg-emerald-500/[0.04] blur-3xl lg:-inset-x-12"
              aria-hidden
            />

            <header className="mb-6 flex items-center gap-2.5 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 shadow-md ring-1 ring-white/20">
                <span className="text-sm font-bold text-white">R</span>
              </div>
              <span className="font-semibold text-white">Repuestos</span>
            </header>

            <div className="relative w-full">
              <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-[1.65rem]">
                Iniciar sesión
              </h1>
              <div
                className="mt-2.5 flex items-center gap-1.5"
                aria-hidden
              >
                <span className="h-1 w-7 rounded-full bg-rose-400" />
                <span className="h-1 w-5 rounded-full bg-emerald-400" />
                <span className="h-1 flex-1 max-w-[5rem] rounded-full bg-gradient-to-r from-white/25 to-emerald-400/30" />
              </div>

              <div className="relative mt-6 overflow-hidden rounded-2xl border border-white/12 bg-slate-900/40 p-6 shadow-[0_24px_70px_-18px_rgba(15,23,42,0.85),inset_0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-xl sm:p-7">
                {/* Barra lateral rojo → verde */}
                <div
                  className="pointer-events-none absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full bg-gradient-to-b from-rose-500 via-rose-600/80 to-emerald-500 opacity-90"
                  aria-hidden
                />
                <div
                  className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-rose-500/[0.07] via-transparent to-emerald-400/[0.08]"
                  aria-hidden
                />
                <div className="relative pl-1 sm:pl-2">
                  <LoginForm />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

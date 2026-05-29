import type { Metadata } from "next";
import { ArrowDownUp, Calculator, Receipt, Wallet } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Inicio",
};

const cards = [
  {
    href: "/cajero/cobros",
    title: "Cobros vendedores",
    desc: "Ventas enviadas por vendedores: revisá el detalle y registrá el cobro.",
    icon: Receipt,
    ring: "from-emerald-500/20 to-teal-900/10 ring-emerald-500/30",
  },
  {
    href: "/cajero/reportes/ingresos-egresos",
    title: "Ingresos / egresos",
    desc: "Registrá gastos e ingresos del día e imprimí el reporte de caja con venta total.",
    icon: ArrowDownUp,
    ring: "from-violet-500/15 to-emerald-900/10 ring-violet-500/25",
  },
  {
    href: "/cajero/reportes/arqueo-vendedores",
    title: "Arqueo vendedores",
    desc: "Totales por vendedor e impresión de salidas diarias (detalle de ítems) para cierre de caja.",
    icon: Calculator,
    ring: "from-teal-500/20 to-emerald-900/10 ring-teal-500/25",
  },
  {
    href: "/cajero/reportes/creditos",
    title: "Créditos",
    desc: "Saldos pendientes y cobros.",
    icon: Wallet,
    ring: "from-amber-500/15 to-emerald-900/10 ring-amber-500/20",
  },
] as const;

export default async function CajeroHomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const errorMsg = sp.error?.trim() || null;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        Panel cajero
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-400">
        Reportes de la sucursal asignada a tu usuario. Usá el menú o las tarjetas.
      </p>

      {errorMsg ? (
        <p
          className="mt-6 rounded-xl border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm text-rose-100"
          role="alert"
        >
          {errorMsg}
        </p>
      ) : null}

      <ul className={`grid gap-4 sm:grid-cols-2 ${errorMsg ? "mt-6" : "mt-10"}`}>
        {cards.map(({ href, title, desc, icon: Icon, ring }) => (
          <li key={href}>
            <Link
              href={href}
              className={`flex h-full flex-col rounded-2xl border border-white/10 bg-gradient-to-br p-5 shadow-lg shadow-black/20 ring-1 transition hover:border-white/15 hover:brightness-[1.03] ${ring}`}
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-black/25 ring-1 ring-white/10">
                <Icon className="h-5 w-5 text-emerald-200/90" strokeWidth={1.5} />
              </div>
              <span className="text-base font-semibold text-white">{title}</span>
              <span className="mt-1 text-sm leading-relaxed text-slate-400">{desc}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

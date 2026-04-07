import type { Metadata } from "next";
import { BarChart3, Package, ShoppingCart, Wallet } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Inicio",
};

const cards = [
  {
    href: "/cajero/reportes/ventas",
    title: "Ventas",
    desc: "Totales y detalle por período en tu sucursal.",
    icon: ShoppingCart,
    ring: "from-emerald-500/20 to-emerald-800/10 ring-emerald-500/20",
  },
  {
    href: "/cajero/reportes/compras",
    title: "Compras",
    desc: "Compras a proveedores registradas en la sucursal.",
    icon: BarChart3,
    ring: "from-slate-500/15 to-slate-800/10 ring-white/10",
  },
  {
    href: "/cajero/reportes/inventario",
    title: "Inventario",
    desc: "Stock actual y movimientos.",
    icon: Package,
    ring: "from-emerald-600/15 to-slate-800/10 ring-emerald-500/15",
  },
  {
    href: "/cajero/reportes/creditos",
    title: "Créditos",
    desc: "Saldos pendientes y cobros.",
    icon: Wallet,
    ring: "from-amber-500/15 to-emerald-900/10 ring-amber-500/20",
  },
] as const;

export default function CajeroHomePage() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        Panel cajero
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-400">
        Reportes de la sucursal asignada a tu usuario. Usá el menú o las tarjetas.
      </p>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
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

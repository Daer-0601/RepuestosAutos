import type { Metadata } from "next";
import { CreditCard, PlusCircle, ScanLine, ScrollText } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Inicio",
};

const cards = [
  {
    href: "/vendedor/ventas/nueva",
    title: "Nueva venta",
    desc: "Registrar venta con QR o código de producto.",
    icon: PlusCircle,
    ring: "from-amber-500/20 to-rose-900/10 ring-amber-500/25",
  },
  {
    href: "/vendedor/ventas",
    title: "Historial",
    desc: "Ventas recientes de tu sucursal.",
    icon: ScrollText,
    ring: "from-rose-500/15 to-slate-800/10 ring-rose-500/20",
  },
  {
    href: "/vendedor/creditos",
    title: "Créditos",
    desc: "Seguimiento de ventas a crédito y abonos.",
    icon: CreditCard,
    ring: "from-amber-600/15 to-emerald-900/10 ring-amber-500/20",
  },
  {
    href: "/vendedor/productos",
    title: "Consulta producto",
    desc: "Buscar por código o QR antes de vender.",
    icon: ScanLine,
    ring: "from-slate-500/15 to-amber-900/10 ring-white/10",
  },
] as const;

export default function VendedorHomePage() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        Panel vendedor
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-400">
        Operaciones de venta y créditos en tu sucursal. Elegí un módulo abajo o en el
        menú.
      </p>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {cards.map(({ href, title, desc, icon: Icon, ring }) => (
          <li key={href}>
            <Link
              href={href}
              className={`flex h-full flex-col rounded-2xl border border-white/10 bg-gradient-to-br p-5 shadow-lg shadow-black/20 ring-1 transition hover:border-white/15 hover:brightness-[1.03] ${ring}`}
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-black/25 ring-1 ring-white/10">
                <Icon className="h-5 w-5 text-amber-200/90" strokeWidth={1.5} />
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

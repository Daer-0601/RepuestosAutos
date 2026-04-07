import type { Metadata } from "next";
import {
  BarChart3,
  Building2,
  DollarSign,
  Package,
  Upload,
  UserCircle,
  Users,
} from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Inicio",
};

const modules = [
  {
    href: "/admin/importacion",
    title: "Importación",
    desc: "Carga masiva de productos y plantillas.",
    icon: Upload,
    accent: "from-rose-500/20 to-rose-600/5 ring-rose-500/20 text-rose-200",
  },
  {
    href: "/admin/reportes",
    title: "Reportes",
    desc: "Ventas, compras, stock y créditos.",
    icon: BarChart3,
    accent: "from-emerald-500/20 to-emerald-700/5 ring-emerald-500/20 text-emerald-200",
  },
  {
    href: "/admin/usuarios",
    title: "Usuarios",
    desc: "Alta, roles y sucursal asignada.",
    icon: Users,
    accent: "from-slate-400/15 to-slate-700/10 ring-white/10 text-slate-200",
  },
  {
    href: "/admin/productos",
    title: "Productos",
    desc: "Catálogo, QR, imágenes y precios.",
    icon: Package,
    accent: "from-rose-500/15 to-emerald-600/10 ring-white/10 text-rose-100",
  },
  {
    href: "/admin/sucursales",
    title: "Sucursales",
    desc: "Datos de contacto y estado.",
    icon: Building2,
    accent: "from-emerald-500/15 to-slate-700/10 ring-emerald-500/15 text-emerald-100",
  },
  {
    href: "/admin/clientes",
    title: "Clientes",
    desc: "Directorio y estado de cuenta.",
    icon: UserCircle,
    accent: "from-slate-500/20 to-slate-800/10 ring-white/10 text-slate-100",
  },
  {
    href: "/admin/tipo-cambio",
    title: "Tipo de cambio",
    desc: "Historial y valor vigente USD.",
    icon: DollarSign,
    accent: "from-amber-500/15 to-emerald-800/10 ring-amber-500/20 text-amber-100",
  },
] as const;

export default function AdminHomePage() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        Panel administrador
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-400">
        Elegí un módulo en el menú lateral o abrí uno desde las tarjetas.
      </p>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {modules.map(({ href, title, desc, icon: Icon, accent }) => (
          <li key={href}>
            <Link
              href={href}
              className={`flex h-full flex-col rounded-2xl border border-white/10 bg-gradient-to-br p-5 shadow-lg shadow-black/20 ring-1 transition hover:border-white/15 hover:brightness-[1.03] ${accent}`}
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-black/25 ring-1 ring-white/10">
                <Icon className="h-5 w-5" strokeWidth={1.5} />
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

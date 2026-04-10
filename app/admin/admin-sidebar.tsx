"use client";

import { logout } from "@/lib/auth/logout";
import {
  BarChart3,
  Building2,
  DollarSign,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Upload,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const nav = [
  { href: "/admin", label: "Inicio", icon: LayoutDashboard, exact: true },
  { href: "/admin/importacion", label: "Ingreso / compra", icon: Upload },
  { href: "/admin/reportes", label: "Reportes", icon: BarChart3 },
  { href: "/admin/usuarios", label: "Usuarios", icon: Users },
  { href: "/admin/productos", label: "Productos", icon: Package },
  { href: "/admin/sucursales", label: "Sucursales", icon: Building2 },
  { href: "/admin/clientes", label: "Clientes", icon: UserCircle },
  { href: "/admin/tipo-cambio", label: "Tipo de cambio", icon: DollarSign },
] as const;

function NavLink({
  href,
  label,
  Icon,
  exact,
  onNavigate,
}: {
  href: string;
  label: string;
  Icon: (typeof nav)[number]["icon"];
  exact?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
        active
          ? "bg-rose-500/15 text-rose-100 ring-1 ring-rose-500/30"
          : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
      }`}
    >
      <Icon className="h-[18px] w-[18px] shrink-0 opacity-90" strokeWidth={1.75} />
      {label}
    </Link>
  );
}

export function AdminSidebar({ username }: { username: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/15 bg-slate-900/75 px-4 backdrop-blur-xl lg:hidden">
        <span className="text-sm font-semibold text-rose-400">Admin</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg p-2 text-slate-300 hover:bg-white/10"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!open}
        onClick={() => setOpen(false)}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(280px,88vw)] flex-col border-r border-white/15 bg-slate-900/55 shadow-[0_0_40px_-10px_rgba(0,0,0,0.5)] backdrop-blur-2xl transition-transform duration-200 ease-out lg:static lg:z-10 lg:w-60 lg:translate-x-0 lg:shrink-0 ${
          open ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex h-14 items-center justify-between border-b border-white/10 px-4 lg:h-16">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-rose-700 text-sm font-bold text-white shadow-md ring-1 ring-white/15">
              R
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">Repuestos</p>
              <p className="truncate text-xs text-emerald-400/90">Administración</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 lg:hidden"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {nav.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              Icon={item.icon}
              exact={"exact" in item ? item.exact : false}
              onNavigate={() => setOpen(false)}
            />
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <p className="truncate px-3 pb-2 text-xs text-slate-500">
            Sesión: <span className="text-slate-300">{username}</span>
          </p>
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-white"
            >
              <LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} />
              Salir
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}

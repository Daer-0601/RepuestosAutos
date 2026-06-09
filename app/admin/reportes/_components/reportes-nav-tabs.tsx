"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  {
    href: "/admin/reportes",
    label: "Ventas y compras",
    match: (p: string) => p === "/admin/reportes",
  },
  {
    href: "/admin/reportes/ingresos-egresos",
    label: "Ingresos / egresos",
    match: (p: string) => p.startsWith("/admin/reportes/ingresos-egresos"),
  },
] as const;

export function ReportesNavTabs() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex flex-wrap gap-2 border-b border-white/10 pb-4" aria-label="Reportes admin">
      {tabs.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              active
                ? "bg-sky-500/20 text-sky-100 ring-1 ring-sky-500/35"
                : "border border-white/10 text-slate-400 hover:bg-white/5 hover:text-slate-100"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/admin/importacion", label: "Realizar compra", match: (p: string) => p === "/admin/importacion" },
  {
    href: "/admin/compras",
    label: "Listado compras",
    match: (p: string) => p === "/admin/compras" || p.startsWith("/admin/compras/"),
  },
] as const;

export function ComprasNavTabs() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex flex-wrap gap-2 border-b border-white/10 pb-4" aria-label="Compras">
      {tabs.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              active
                ? "bg-rose-500/20 text-rose-100 ring-1 ring-rose-500/35"
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

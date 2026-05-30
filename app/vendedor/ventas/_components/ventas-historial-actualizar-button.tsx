"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function VentasHistorialActualizarButton({
  accent = "vendedor",
}: {
  accent?: "vendedor" | "cajero";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
      className={
        accent === "cajero"
          ? "inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-300 hover:bg-white/5 disabled:opacity-60"
          : "inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-100 hover:bg-amber-500/20 disabled:opacity-60"
      }
    >
      <RefreshCw className={`h-4 w-4 shrink-0 ${pending ? "animate-spin" : ""}`} aria-hidden />
      {pending ? "Actualizando…" : "Actualizar"}
    </button>
  );
}

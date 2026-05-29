"use client";

import { Download, Loader2 } from "lucide-react";
import { useState } from "react";

export function ProductosExportOskCsvButton() {
  const [loading, setLoading] = useState(false);

  async function descargarCsv() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/productos/export-osk-csv", { credentials: "same-origin" });
      if (!res.ok) {
        window.alert("No se pudo generar el CSV. Verificá que tengas sesión de administrador.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "repuestos osk.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.alert("Error de red al descargar el CSV.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={() => void descargarCsv()}
      className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/35 bg-emerald-950/40 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-900/50 disabled:pointer-events-none disabled:opacity-50"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
      Descargar CSV (OSK)
    </button>
  );
}

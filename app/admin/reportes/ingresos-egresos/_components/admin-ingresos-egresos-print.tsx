"use client";

import {
  buildIngresosEgresosReporteHtml,
  type IngresosEgresosReporteData,
} from "@/lib/caja/ingresos-egresos-reporte-html";
import { Loader2, Printer } from "lucide-react";
import { useState } from "react";

export function AdminIngresosEgresosPrintButton({
  data,
  cajeroEtiqueta,
}: {
  data: IngresosEgresosReporteData;
  cajeroEtiqueta: string;
}) {
  const [printing, setPrinting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const imprimir = () => {
    setPrinting(true);
    setErr(null);
    try {
      const html = buildIngresosEgresosReporteHtml({ ...data, cajeroNombre: cajeroEtiqueta, cajeroUsername: cajeroEtiqueta });
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const objectUrl = URL.createObjectURL(blob);
      const w = globalThis.window?.open(objectUrl, "_blank");
      if (!w) {
        URL.revokeObjectURL(objectUrl);
        setErr("No se pudo abrir la ventana de impresión (¿bloqueador de ventanas?).");
        return;
      }
      const teardown = () => {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {
          /* ignore */
        }
        try {
          w.close();
        } catch {
          /* ignore */
        }
      };
      w.addEventListener("afterprint", () => globalThis.setTimeout(teardown, 200), { once: true });
      const doPrint = () => {
        try {
          w.focus();
          w.print();
        } catch {
          setErr("No se pudo abrir el cuadro de impresión.");
          teardown();
        }
      };
      if (w.document.readyState === "complete") {
        globalThis.setTimeout(doPrint, 120);
      } else {
        w.addEventListener("load", () => globalThis.setTimeout(doPrint, 120), { once: true });
      }
    } catch {
      setErr("No se pudo generar el reporte.");
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      {err ? (
        <p className="max-w-xs text-right text-xs text-amber-200" role="alert">
          {err}
        </p>
      ) : null}
      <button
        type="button"
        onClick={imprimir}
        disabled={printing}
        className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50"
      >
        {printing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
        Imprimir reporte del día
      </button>
    </div>
  );
}

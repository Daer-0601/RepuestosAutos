"use client";

import { FileSpreadsheet, Plus, Search, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import * as XLSX from "xlsx";

const inp =
  "w-full min-w-0 rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50";
const inpNum = `${inp} font-mono`;

type ProductoBusqueda = {
  id: number;
  codigo: string;
  codigo_pieza: string | null;
  nombre: string;
  medida: string | null;
  marca_auto: string | null;
  especificacion: string | null;
  repuesto: string | null;
};

type LineaPedido = {
  key: string;
  productoId: number;
  codigo_pieza: string | null;
  nombre: string;
  medida: string | null;
  especificacion: string | null;
  repuesto: string | null;
  cantidad: string;
};

function nuevaLinea(p: ProductoBusqueda): LineaPedido {
  return {
    key: typeof crypto !== "undefined" ? crypto.randomUUID() : String(Math.random()),
    productoId: p.id,
    codigo_pieza: p.codigo_pieza,
    nombre: p.nombre,
    medida: p.medida,
    especificacion: p.especificacion,
    repuesto: p.repuesto,
    cantidad: "1",
  };
}

export function PedidosExcelPanel() {
  const [busqueda, setBusqueda] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<ProductoBusqueda[]>([]);
  const [lineas, setLineas] = useState<LineaPedido[]>([]);

  const buscar = useCallback(async () => {
    const t = busqueda.trim();
    if (!t) {
      setResultados([]);
      return;
    }
    setBuscando(true);
    try {
      const res = await fetch("/api/admin/productos/catalogo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ term: t, perPage: 80 }),
      });
      const data = (await res.json()) as { productos?: ProductoBusqueda[]; error?: string };
      if (!res.ok) {
        setResultados([]);
        return;
      }
      setResultados(data.productos ?? []);
    } catch {
      setResultados([]);
    } finally {
      setBuscando(false);
    }
  }, [busqueda]);

  function agregarProducto(p: ProductoBusqueda) {
    setLineas((prev) => [...prev, nuevaLinea(p)]);
    setBusqueda("");
    setResultados([]);
  }

  function descargarExcel() {
    if (lineas.length === 0) return;
    const filas = lineas.map((l) => ({
      "Código pieza": l.codigo_pieza?.trim() ?? "",
      Especificación: l.especificacion?.trim() ?? "",
      Medida: l.medida?.trim() ?? "",
      Nombre: l.nombre,
      Repuesto: l.repuesto?.trim() ?? "",
    }));
    const hoja = XLSX.utils.json_to_sheet(filas);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Pedido");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    XLSX.writeFile(libro, `pedido-${stamp}.xlsx`);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
        <h2 className="text-sm font-semibold text-white">Buscar producto</h2>
        <p className="mt-1 text-xs text-slate-500">
          Primero: coincidencia exacta con <span className="text-slate-300">código interno</span> o{" "}
          <span className="text-slate-300">QR</span>. Luego: texto en{" "}
          <span className="text-slate-300">código pieza</span>. Después: búsqueda amplia en QR, código pieza,
          especificación, medida, nombre, repuesto, descripción, código y marca de auto (varias palabras: todas deben
          aparecer en algún campo).
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void buscar();
              }
            }}
            className={`${inp} sm:min-w-0 sm:flex-1`}
            placeholder="QR, código pieza, espec., medida, nombre, repuesto…"
          />
          <div className="flex shrink-0 gap-2 sm:items-stretch">
            <button
              type="button"
              onClick={() => void buscar()}
              disabled={buscando || !busqueda.trim()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-initial"
            >
              <Search className="h-4 w-4" aria-hidden />
              {buscando ? "Buscando…" : "Buscar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setBusqueda("");
                setResultados([]);
              }}
              className="rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-300 hover:bg-white/5 sm:self-stretch"
            >
              Limpiar
            </button>
          </div>
        </div>
        {resultados.length > 0 ? (
          <ul className="mt-3 max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-slate-950/60 py-1 text-sm">
            {resultados.map((p) => (
              <li key={p.id} className="border-b border-white/5 last:border-0">
                <button
                  type="button"
                  onClick={() => agregarProducto(p)}
                  className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-sky-500/15"
                >
                  <Plus className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="font-mono text-sky-300">{p.codigo}</span>
                    {p.codigo_pieza ? (
                      <span className="ml-2 font-mono text-xs text-slate-500">{p.codigo_pieza}</span>
                    ) : null}
                    <span className="mt-0.5 block text-slate-200">{p.nombre}</span>
                    {p.marca_auto ? (
                      <span className="mt-0.5 block text-[11px] text-slate-500">Marca: {p.marca_auto}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Pedido actual</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {lineas.length === 0
                ? "Todavía no agregaste ítems."
                : `${lineas.length} ítem(s) · descargá el Excel cuando quieras.`}
            </p>
          </div>
          <button
            type="button"
            onClick={descargarExcel}
            disabled={lineas.length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-600/90 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FileSpreadsheet className="h-4 w-4" aria-hidden />
            Descargar Excel
          </button>
        </div>

        {lineas.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="border-b border-white/10 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2 pr-2">Código pieza</th>
                  <th className="py-2 pr-2">Especificación</th>
                  <th className="py-2 pr-2">Medida</th>
                  <th className="py-2 pr-2">Nombre</th>
                  <th className="py-2 pr-2">Repuesto</th>
                  <th className="w-24 py-2 pr-2">Cant.</th>
                  <th className="w-10 py-2 text-right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {lineas.map((l) => (
                  <tr key={l.key} className="text-slate-200">
                    <td className="max-w-[140px] py-2 pr-2 font-mono text-slate-300">{l.codigo_pieza?.trim() || "—"}</td>
                    <td className="max-w-[160px] truncate py-2 pr-2 text-slate-300" title={l.especificacion?.trim() ?? ""}>
                      {l.especificacion?.trim() || "—"}
                    </td>
                    <td className="py-2 pr-2 font-mono text-slate-400">{l.medida?.trim() || "—"}</td>
                    <td className="max-w-[220px] truncate py-2 pr-2" title={l.nombre}>
                      {l.nombre}
                    </td>
                    <td className="max-w-[160px] truncate py-2 pr-2 text-slate-400" title={l.repuesto?.trim() ?? ""}>
                      {l.repuesto?.trim() || "—"}
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        value={l.cantidad}
                        onChange={(e) =>
                          setLineas((prev) =>
                            prev.map((x) => (x.key === l.key ? { ...x, cantidad: e.target.value } : x))
                          )
                        }
                        className={inpNum}
                        inputMode="decimal"
                      />
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setLineas((prev) => prev.filter((x) => x.key !== l.key))}
                        className="rounded p-1.5 text-rose-400 hover:bg-rose-500/10"
                        title="Quitar"
                        aria-label="Quitar del pedido"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {lineas.length > 0 ? (
          <button
            type="button"
            onClick={() => setLineas([])}
            className="mt-3 text-xs text-slate-500 underline hover:text-slate-300"
          >
            Vaciar pedido
          </button>
        ) : null}
      </div>
    </div>
  );
}

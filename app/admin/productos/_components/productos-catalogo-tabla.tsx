"use client";

import type { SucursalRow } from "@/lib/data/sucursales";
import type { ProductoCatalogoRowConStock } from "@/lib/data/productos-catalogo";
import { Download, Images, Printer, QrCode, X } from "lucide-react";
import QRCode from "qrcode";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const COL_MIN = 40;
const cellPad = "px-2 py-1.5";

const btnIcon =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/15 bg-slate-900/80 text-slate-200 hover:border-sky-500/40 hover:bg-sky-950/50 hover:text-sky-100";

const btnQrAction =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-slate-800/90 px-3 py-2 text-xs font-medium text-slate-100 hover:border-sky-500/40 hover:bg-slate-800";

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function downloadQrPng(dataUrl: string, codigo: string) {
  const safe = codigo.replace(/[^\w.-]+/g, "_").slice(0, 80) || "producto";
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `qr-${safe}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function printQrWindow(dataUrl: string, modal: { codigo: string; payload: string }) {
  const w = window.open("", "_blank");
  if (!w) {
    window.alert("No se pudo abrir la ventana de impresión. Permití ventanas emergentes para este sitio.");
    return;
  }
  const c = escHtml(modal.codigo);
  const p = escHtml(modal.payload);
  w.document.open();
  w.document.write(
    `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>QR ${c}</title>
<style>
  @page { margin: 14mm; }
  body { font-family: system-ui, sans-serif; text-align: center; padding: 16px; margin: 0; }
  h1 { font-size: 14px; font-weight: 600; margin: 0 0 12px; }
  img { width: 280px; height: 280px; max-width: 100%; }
  .payload { font-size: 11px; word-break: break-all; margin-top: 12px; font-family: ui-monospace, monospace; color: #333; }
</style></head><body>
<h1>QR · ${c}</h1>
<img src="${dataUrl}" width="280" height="280" alt="Código QR" />
<p class="payload">${p}</p>
</body></html>`
  );
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
    w.addEventListener("afterprint", () => {
      try {
        w.close();
      } catch {
        /* ignore */
      }
    });
  }, 200);
}

function defaultColWidths(sucCount: number): number[] {
  const base = [88, 72, 112, 88, 220, 72, 72, 72, 88, 56, 120, 72, 88, 88, 56];
  /* Columnas sucursal: ancho para nombre completo (se puede estirar después). */
  const suc = Array.from({ length: sucCount }, () => 128);
  return [...base, ...suc, 80, 72];
}

function filaPorStock(stockTotal: number): { tr: string; mono: string } {
  const hay = stockTotal > 0;
  return {
    tr: hay ? "text-emerald-400" : "text-rose-400",
    mono: hay ? "font-mono text-emerald-400" : "font-mono text-rose-400",
  };
}

export function ProductosCatalogoTabla({
  rows,
  sucursales,
}: {
  rows: ProductoCatalogoRowConStock[];
  sucursales: SucursalRow[];
}) {
  const [colWidths, setColWidths] = useState<number[]>(() => defaultColWidths(sucursales.length));
  const resizeDragRef = useRef<{ index: number; startX: number; startWidth: number } | null>(null);
  /** Fila marcada al hacer clic (mismo clic desmarca). */
  const [marcadoId, setMarcadoId] = useState<number | null>(null);
  const [qrModal, setQrModal] = useState<{ codigo: string; payload: string } | null>(null);
  const [imgModal, setImgModal] = useState<{ codigo: string; urls: string[] } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrGenError, setQrGenError] = useState(false);

  useEffect(() => {
    if (!qrModal) {
      setQrDataUrl(null);
      setQrGenError(false);
      return;
    }
    let cancelled = false;
    setQrDataUrl(null);
    setQrGenError(false);
    QRCode.toDataURL(qrModal.payload, {
      width: 280,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then((dataUrl) => {
        if (!cancelled) {
          setQrDataUrl(dataUrl);
          setQrGenError(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrDataUrl(null);
          setQrGenError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [qrModal]);

  useEffect(() => {
    const need = 17 + sucursales.length;
    setColWidths((prev) => (prev.length === need ? prev : defaultColWidths(sucursales.length)));
  }, [sucursales.length]);

  useEffect(() => {
    if (!qrModal && !imgModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setQrModal(null);
        setImgModal(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [qrModal, imgModal]);

  useEffect(() => {
    setMarcadoId((id) => {
      if (id == null) return null;
      return rows.some((r) => r.id === id) ? id : null;
    });
  }, [rows]);

  const tablaAnchoPx = useMemo(() => colWidths.reduce((a, w) => a + w, 0), [colWidths]);

  const labels = useMemo(() => {
    const base = [
      "",
      "Código",
      "Cód. pieza",
      "Especificación",
      "Descripción",
      "Repuesto",
      "Proced.",
      "Proveedor",
      "Marca",
      "Unidad",
      "Medida",
      "P. compra",
      "P. venta Bs",
      "P. venta USD",
      "Stock",
    ];
    const suc = sucursales.map((s) => s.nombre);
    return [...base, ...suc, "P. tope", "Acción"];
  }, [sucursales]);

  const onColumnResizeMove = useCallback((e: MouseEvent) => {
    const d = resizeDragRef.current;
    if (!d) return;
    const delta = e.clientX - d.startX;
    const nw = Math.max(COL_MIN, Math.round(d.startWidth + delta));
    setColWidths((prev) => {
      if (prev[d.index] === nw) return prev;
      const next = [...prev];
      next[d.index] = nw;
      return next;
    });
  }, []);

  const onColumnResizeEnd = useCallback(() => {
    resizeDragRef.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    document.removeEventListener("mousemove", onColumnResizeMove);
    document.removeEventListener("mouseup", onColumnResizeEnd);
  }, [onColumnResizeMove]);

  const beginColumnResize = useCallback(
    (e: React.MouseEvent, colIndex: number) => {
      e.preventDefault();
      e.stopPropagation();
      resizeDragRef.current = {
        index: colIndex,
        startX: e.clientX,
        startWidth: colWidths[colIndex],
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onColumnResizeMove);
      document.addEventListener("mouseup", onColumnResizeEnd);
    },
    [colWidths, onColumnResizeMove, onColumnResizeEnd]
  );

  const nSuc = sucursales.length;
  const colSpan = 17 + nSuc;
  const idxSucStart = 15;
  const idxAccion = labels.length - 1;

  return (
    <div className="max-h-[min(75dvh,720px)] overflow-y-auto overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/40 overscroll-contain">
      <table
        className="table-fixed border-collapse text-left text-xs"
        style={{ width: tablaAnchoPx, minWidth: tablaAnchoPx }}
      >
        <colgroup>
          {colWidths.map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
        <thead className="sticky top-0 z-[1] border-b border-white/10 bg-slate-950/95 text-[10px] font-semibold uppercase tracking-wide text-slate-500 shadow-sm shadow-black/20">
          <tr>
            {labels.map((label, i) => {
              const isSuc = i >= idxSucStart && i < idxSucStart + nSuc;
              const isAccion = i === idxAccion;
              const sucursalCol = isSuc ? sucursales[i - idxSucStart] : null;
              const thTitle = isSuc
                ? `${sucursalCol?.nombre ?? label} · arrastrá el borde derecho para ancho`
                : "Arrastrá el borde derecho para cambiar el ancho";
              return (
                <th
                  key={isSuc && sucursalCol ? `suc-${sucursalCol.id}` : `col-${i}`}
                  className={`${cellPad} relative select-none ${isSuc || i === 14 ? "text-center" : ""} ${isAccion ? "text-right" : ""} ${isSuc ? "align-bottom font-medium normal-case text-slate-300" : ""}`}
                  title={thTitle}
                >
                  <span
                    className={
                      isSuc
                        ? "inline-block max-w-full whitespace-normal break-words text-center leading-snug"
                        : i === 0
                          ? "sr-only"
                          : ""
                    }
                  >
                    {i === 0 ? "Ver QR e imágenes" : label}
                  </span>
                  <span
                    className="absolute right-0 top-0 z-10 h-full w-3 max-w-[12px] cursor-col-resize hover:bg-sky-500/25"
                    style={{ transform: "translateX(50%)" }}
                    onMouseDown={(e) => beginColumnResize(e, i)}
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={`Redimensionar columna ${label}`}
                  />
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={colSpan} className="px-4 py-10 text-center text-slate-500">
                No hay productos con estos filtros.
              </td>
            </tr>
          ) : (
            rows.map((r, idx) => {
              const tone = filaPorStock(r.stock_total);
              const bg =
                r.stock_total > 0
                  ? idx % 2 === 0
                    ? "bg-emerald-950/20"
                    : "bg-emerald-950/10"
                  : idx % 2 === 0
                    ? "bg-rose-950/20"
                    : "bg-rose-950/10";
              const seleccionado = marcadoId === r.id;
              return (
                <tr
                  key={r.id}
                  tabIndex={0}
                  aria-selected={seleccionado}
                  onClick={() => setMarcadoId((prev) => (prev === r.id ? null : r.id))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setMarcadoId((prev) => (prev === r.id ? null : r.id));
                    }
                  }}
                  className={`cursor-pointer transition-colors ${bg} ${tone.tr} hover:brightness-110 ${
                    seleccionado
                      ? "relative z-[1] ring-2 ring-inset ring-sky-400 bg-sky-950/55 shadow-[inset_0_0_0_9999px_rgba(56,189,248,0.12)]"
                      : ""
                  }`}
                >
                  <td className={`${cellPad} whitespace-nowrap`}>
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        title="Ver código QR"
                        className={btnIcon}
                        onClick={(e) => {
                          e.stopPropagation();
                          const payload = (r.qr_payload || r.codigo).trim() || r.codigo;
                          setQrModal({ codigo: r.codigo, payload });
                        }}
                      >
                        <QrCode className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        title="Ver imágenes"
                        className={btnIcon}
                        onClick={(e) => {
                          e.stopPropagation();
                          setImgModal({ codigo: r.codigo, urls: r.imagenes_urls });
                        }}
                      >
                        <Images className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  </td>
                  <td className={`${cellPad} truncate font-mono ${tone.mono}`}>{r.codigo}</td>
                  <td className={`${cellPad} truncate font-mono ${tone.mono}`}>{r.codigo_pieza ?? "—"}</td>
                  <td className={`${cellPad} truncate`}>{r.especificacion ?? "—"}</td>
                  <td className={`${cellPad} truncate font-medium`} title={r.descripcion ?? ""}>
                    {r.descripcion ?? r.nombre}
                  </td>
                  <td className={`${cellPad} truncate`}>{r.repuesto ?? "—"}</td>
                  <td className={`${cellPad} truncate`}>{r.procedencia ?? "—"}</td>
                  <td className={`${cellPad} truncate opacity-80`}>—</td>
                  <td className={`${cellPad} truncate`}>{r.marca_auto ?? "—"}</td>
                  <td className={`${cellPad} truncate`}>{r.unidad ?? "—"}</td>
                  <td className={`${cellPad} truncate text-[11px] font-mono ${tone.mono}`} title={r.medida ?? ""}>
                    {r.medida ?? "—"}
                  </td>
                  <td className={`${cellPad} truncate opacity-80`}>—</td>
                  <td className={`${cellPad} truncate font-mono ${tone.mono}`}>{r.precio_venta_lista_bs ?? "—"}</td>
                  <td className={`${cellPad} truncate font-mono ${tone.mono}`}>{r.precio_venta_lista_usd ?? "—"}</td>
                  <td className={`${cellPad} truncate text-center font-semibold font-mono ${tone.mono}`}>
                    {r.stock_total}
                  </td>
                  {sucursales.map((s) => {
                    const q = r.stocksPorSucursal.get(s.id) ?? 0;
                    return (
                      <td key={s.id} className={`${cellPad} text-center font-mono ${tone.mono}`}>
                        {q}
                      </td>
                    );
                  })}
                  <td className={`${cellPad} truncate font-mono ${tone.mono}`}>{r.punto_tope ?? "—"}</td>
                  <td className={`${cellPad} text-right`}>
                    <Link
                      href={`/admin/productos/${r.id}`}
                      className="font-medium text-sky-300 hover:text-sky-200 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {qrModal ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => setQrModal(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-modal-title"
            className="relative max-w-sm rounded-2xl border border-white/15 bg-slate-900 p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute right-3 top-3 rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
              onClick={() => setQrModal(null)}
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
            <h2 id="qr-modal-title" className="pr-8 text-sm font-semibold text-white">
              QR · {qrModal.codigo}
            </h2>
            <div className="mt-4 flex min-h-[280px] flex-col items-center justify-center gap-3">
              {qrGenError ? (
                <p className="text-center text-sm text-rose-400">No se pudo generar el código QR.</p>
              ) : qrDataUrl ? (
                // data URL generada en cliente con `qrcode`
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrDataUrl}
                  alt=""
                  width={280}
                  height={280}
                  className="rounded-lg border border-white/10 bg-white p-2"
                />
              ) : (
                <p className="text-sm text-slate-500">Generando QR…</p>
              )}
              <p className="max-w-full break-all text-center font-mono text-[11px] text-slate-400">
                {qrModal.payload}
              </p>
              {qrDataUrl && !qrGenError ? (
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    className={btnQrAction}
                    onClick={() => downloadQrPng(qrDataUrl, qrModal.codigo)}
                  >
                    <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Descargar PNG
                  </button>
                  <button
                    type="button"
                    className={btnQrAction}
                    onClick={() => printQrWindow(qrDataUrl, qrModal)}
                  >
                    <Printer className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Imprimir
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {imgModal ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => setImgModal(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="img-modal-title"
            className="relative max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/15 bg-slate-900 p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute right-3 top-3 z-10 rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
              onClick={() => setImgModal(null)}
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
            <h2 id="img-modal-title" className="pr-8 text-sm font-semibold text-white">
              Imágenes · {imgModal.codigo}
            </h2>
            {imgModal.urls.length === 0 ? (
              <p className="mt-6 text-center text-sm text-slate-500">Este producto no tiene imágenes cargadas.</p>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {imgModal.urls.map((url, i) => (
                  <a
                    key={`${url}-${i}`}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block overflow-hidden rounded-xl border border-white/10 bg-slate-950/60 hover:border-sky-500/30"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="mx-auto max-h-64 w-full object-contain" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { Download, Images, Printer, QrCode, X } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

const btnQrAction =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-slate-800/90 px-3 py-2 text-xs font-medium text-slate-100 hover:border-sky-500/40 hover:bg-slate-800";

/** Textos fijos del formato etiqueta (imprimir / PNG). Ajustá acá marca y pie. */
const ETIQUETA_MARCA = "REPUESTOS";
const ETIQUETA_SUB_DERECHA = "AUTOPARTES";
const ETIQUETA_FOOTER = "COCHABAMBA";

function etiquetaFechaImpresion(): string {
  return new Date().toLocaleDateString("es-BO", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function wrapLinesCanvas(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const t = text.trim();
  if (!t) return ["—"];
  const words = t.split(/\s+/);
  const lines: string[] = [];
  let line = words[0] ?? "";
  for (let i = 1; i < words.length; i++) {
    const w = words[i];
    const test = `${line} ${w}`;
    if (ctx.measureText(test).width > maxWidth && line.length > 0) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  lines.push(line);
  return lines;
}

function strokeRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
  ctx.stroke();
}

async function downloadQrSheetPng(
  qrDataUrl: string,
  meta: { codigo: string; descripcion: string | null }
): Promise<void> {
  const safe = meta.codigo.replace(/[^\w.-]+/g, "_").slice(0, 80) || "producto";
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("qr-img"));
    img.src = qrDataUrl;
  });

  /** Pegatina compacta (~5,5 cm de ancho al imprimir a 96 dpi). */
  const LABEL_W = 390;
  const PAD = 12;
  const COL_GAP = 8;
  const LEFT_FR = 0.62;
  const innerW = LABEL_W - PAD * 2;
  const leftW = Math.floor((innerW - COL_GAP) * LEFT_FR);
  const rightW = innerW - COL_GAP - leftW;
  const boxPad = 9;
  const descFont = "700 8px Arial, Helvetica, sans-serif";
  const codeFont = "800 10px ui-monospace, monospace";
  const lineH = 10;
  const maxDescLines = 10;

  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) return;
  measure.font = descFont;
  const descUpper = (meta.descripcion?.trim() || "—").toLocaleUpperCase("es");
  let descLines = wrapLinesCanvas(measure, descUpper, leftW - boxPad * 2);
  if (descLines.length > maxDescLines) {
    descLines = descLines.slice(0, maxDescLines);
    const last = descLines[maxDescLines - 1];
    descLines[maxDescLines - 1] = `${last.slice(0, 40)}…`;
  }
  const descBlockH = descLines.length * lineH;
  measure.font = codeFont;
  const codeH = 16;
  const boxInnerH = boxPad * 2 + descBlockH + 8 + codeH;
  const boxH = Math.max(boxInnerH, 96);
  const footerH = 12;
  const qrSize = Math.min(rightW - 6, 118);
  const rightBlockH = qrSize + 22;
  const mainH = Math.max(boxH + footerH + 6, rightBlockH + 4);
  const topH = 26;
  const decoH = 8;
  const LABEL_H = PAD + topH + decoH + 12 + mainH + PAD;

  const DPR = 3;
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(LABEL_W * DPR);
  canvas.height = Math.floor(LABEL_H * DPR);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(DPR, DPR);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, LABEL_W, LABEL_H);
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  strokeRoundRect(ctx, 0.5, 0.5, LABEL_W - 1, LABEL_H - 1, 6);

  let y = PAD;
  ctx.fillStyle = "#000000";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = "900 15px Arial, Helvetica, sans-serif";
  ctx.fillText(ETIQUETA_MARCA, PAD, y + 14);
  ctx.font = "900 7px Arial, Helvetica, sans-serif";
  ctx.textAlign = "right";
  const sub = ETIQUETA_SUB_DERECHA;
  ctx.fillText(sub, LABEL_W - PAD, y + 11);
  ctx.textAlign = "left";
  y += topH;
  const lineY = y + 1;
  ctx.fillRect(PAD, lineY, LABEL_W - PAD * 2, 2);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(PAD + (LABEL_W - PAD * 2) * 0.34 - 5, lineY - 2, 10, 5);
  ctx.fillStyle = "#000000";
  y += decoH + 10;
  const yMain = y;
  const boxX = PAD;
  const boxY = yMain;
  strokeRoundRect(ctx, boxX, boxY, leftW, boxH, 6);
  ctx.font = descFont;
  ctx.textAlign = "center";
  let ty = boxY + boxPad + lineH - 1;
  for (const ln of descLines) {
    ctx.fillText(ln, boxX + leftW / 2, ty);
    ty += lineH;
  }
  ctx.font = codeFont;
  ctx.fillText(meta.codigo, boxX + leftW / 2, boxY + boxH - boxPad - 2);
  ctx.textAlign = "left";
  ctx.font = "700 6px Arial, Helvetica, sans-serif";
  ctx.fillText(ETIQUETA_FOOTER, PAD, yMain + boxH + 10);

  const colRightX = PAD + leftW + COL_GAP;
  const qrX = colRightX + (rightW - qrSize) / 2;
  const qrY = yMain + Math.max(4, (mainH - rightBlockH) / 2);
  ctx.drawImage(img, qrX, qrY, qrSize, qrSize);
  ctx.fillStyle = "#000000";
  ctx.font = "800 9px Arial, Helvetica, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(etiquetaFechaImpresion(), colRightX + rightW / 2, qrY + qrSize + 13);
  ctx.textAlign = "left";

  const out = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = out;
  a.download = `qr-${safe}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function printQrWindow(dataUrl: string, modal: { codigo: string; payload: string; descripcion: string | null }) {
  const w = window.open("", "_blank");
  if (!w) {
    window.alert("No se pudo abrir la ventana de impresión. Permití ventanas emergentes para este sitio.");
    return;
  }
  const c = escHtml(modal.codigo);
  const dRaw = modal.descripcion?.trim() || "—";
  const d = escHtml(dRaw.toLocaleUpperCase("es"));
  const marca = escHtml(ETIQUETA_MARCA);
  const subDer = escHtml(ETIQUETA_SUB_DERECHA);
  const footer = escHtml(ETIQUETA_FOOTER);
  const fecha = escHtml(etiquetaFechaImpresion());
  w.document.open();
  w.document.write(
    `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>Etiqueta ${c}</title>
<style>
  @page { margin: 5mm; size: auto; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 12px;
    background: #e2e8f0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .etiqueta {
    max-width: 220px;
    margin: 0 auto;
    background: #fff;
    color: #000;
    border: 1px solid #000;
    border-radius: 6px;
    padding: 10px 11px 10px;
    font-family: Arial, Helvetica, sans-serif;
  }
  .fila-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 6px;
  }
  .marca {
    font-size: 15px;
    font-weight: 900;
    letter-spacing: 0.02em;
    line-height: 1;
  }
  .sub-der {
    font-size: 7px;
    font-weight: 900;
    text-align: right;
    line-height: 1.2;
    max-width: 44%;
  }
  .deco-line {
    position: relative;
    height: 2px;
    background: #000;
    margin: 6px 0 8px;
  }
  .deco-line::after {
    content: "";
    position: absolute;
    left: 34%;
    top: -2px;
    width: 10px;
    height: 5px;
    background: #fff;
    transform: skewX(-14deg);
  }
  .cols {
    display: flex;
    align-items: stretch;
    gap: 8px;
  }
  .col-izq {
    flex: 1.62;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .col-der {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .caja-desc {
    border: 1px solid #000;
    border-radius: 6px;
    padding: 9px 8px 8px;
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-height: 96px;
  }
  .desc-txt {
    text-align: center;
    text-transform: uppercase;
    font-weight: 700;
    font-size: 8px;
    line-height: 1.32;
    word-break: break-word;
    white-space: pre-wrap;
  }
  .codigo-interno {
    margin-top: 7px;
    text-align: center;
    font-weight: 800;
    font-size: 10px;
    font-family: ui-monospace, monospace;
    letter-spacing: 0.02em;
  }
  .pie-ciudad {
    margin-top: 7px;
    font-size: 6px;
    font-weight: 700;
    letter-spacing: 0.06em;
  }
  .qr-img {
    display: block;
    width: 118px;
    height: 118px;
    max-width: 100%;
    object-fit: contain;
  }
  .fecha {
    margin-top: 4px;
    font-size: 9px;
    font-weight: 800;
  }
  @media print {
    body { background: #fff; padding: 2mm; }
    .etiqueta {
      border: 1px solid #000;
      margin: 0;
      width: 52mm;
      max-width: 52mm;
      padding: 2.4mm 2.1mm 2.5mm;
      border-radius: 1.1mm;
    }
    .marca { font-size: 3.8mm; }
    .sub-der { font-size: 2.1mm; max-width: 46%; }
    .deco-line { margin: 1.4mm 0 2mm; }
    .cols { gap: 1.8mm; }
    .caja-desc {
      padding: 2mm 1.6mm 1.6mm;
      min-height: 22mm;
      border-radius: 1mm;
    }
    .desc-txt { font-size: 2mm; line-height: 1.3; }
    .codigo-interno { font-size: 2.6mm; margin-top: 1.4mm; }
    .pie-ciudad { font-size: 1.7mm; margin-top: 1.5mm; }
    .qr-img { width: 20mm; height: 20mm; }
    .fecha { font-size: 2.2mm; margin-top: 0.8mm; }
  }
</style></head><body>
<div class="etiqueta">
  <div class="fila-top">
    <div class="marca">${marca}</div>
    <div class="sub-der">${subDer}</div>
  </div>
  <div class="deco-line" aria-hidden="true"></div>
  <div class="cols">
    <div class="col-izq">
      <div class="caja-desc">
        <div class="desc-txt">${d}</div>
        <div class="codigo-interno">${c}</div>
      </div>
      <div class="pie-ciudad">${footer}</div>
    </div>
    <div class="col-der">
      <img class="qr-img" src="${dataUrl}" width="118" height="118" alt="Código QR" />
      <div class="fecha">${fecha}</div>
    </div>
  </div>
</div>
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

export type ProductoQrImagenesControlsProps = {
  codigo: string;
  qrPayload: string;
  /** Texto del producto (se muestra al imprimir / descargar junto al QR). */
  descripcion?: string | null;
  imagenesUrls: string[];
  size?: "sm" | "md";
  /** Ej.: `e.stopPropagation()` en filas clicables del catálogo */
  onOpenInteraction?: (e: React.MouseEvent) => void;
};

export function ProductoQrImagenesControls({
  codigo,
  qrPayload,
  descripcion = null,
  imagenesUrls,
  size = "md",
  onOpenInteraction,
}: ProductoQrImagenesControlsProps) {
  const uid = useId();
  const qrTitleId = `${uid}-qr-title`;
  const imgTitleId = `${uid}-img-title`;

  const btnIcon =
    size === "sm"
      ? "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-white/15 bg-slate-900/80 text-slate-200 hover:border-sky-500/40 hover:bg-sky-950/50 hover:text-sky-100"
      : "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/15 bg-slate-900/80 text-slate-200 hover:border-sky-500/40 hover:bg-sky-950/50 hover:text-sky-100";

  const [qrModal, setQrModal] = useState<{
    codigo: string;
    payload: string;
    descripcion: string | null;
  } | null>(null);
  const [imgModal, setImgModal] = useState<{ codigo: string; urls: string[] } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrGenError, setQrGenError] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const payloadEfectivo = (qrPayload || codigo).trim() || codigo;

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
      width: 320,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#ffffff" },
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

  /** Evita que el contenido “salte” al ocultarse la barra de scroll del body. */
  useEffect(() => {
    if (!qrModal && !imgModal) return;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const gap = typeof window !== "undefined" ? window.innerWidth - document.documentElement.clientWidth : 0;
    document.body.style.overflow = "hidden";
    if (gap > 0) {
      document.body.style.paddingRight = `${gap}px`;
    }
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [qrModal, imgModal]);

  const openQr = (e: React.MouseEvent) => {
    onOpenInteraction?.(e);
    setQrModal({
      codigo,
      payload: payloadEfectivo,
      descripcion: descripcion?.trim() ? descripcion.trim() : null,
    });
  };

  const openImg = (e: React.MouseEvent) => {
    onOpenInteraction?.(e);
    setImgModal({ codigo, urls: imagenesUrls });
  };

  const overlayClass =
    "fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm";

  const qrOverlay =
    mounted &&
    qrModal &&
    createPortal(
      <div className={overlayClass} role="presentation" onClick={() => setQrModal(null)}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={qrTitleId}
          className="relative my-auto w-full max-w-sm rounded-2xl border border-white/15 bg-slate-900 p-5 shadow-xl"
          onClick={(ev) => ev.stopPropagation()}
        >
          <button
            type="button"
            className="absolute right-3 top-3 rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
            onClick={() => setQrModal(null)}
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
          <h2 id={qrTitleId} className="pr-8 text-sm font-semibold text-white">
            QR · {qrModal.codigo}
          </h2>
          <p className="mt-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Código de barra
          </p>
          <p className="text-center font-mono text-sm font-semibold text-sky-200">{qrModal.codigo}</p>
          <p className="mt-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Descripción
          </p>
          <p className="max-h-24 max-w-full overflow-y-auto text-center text-xs leading-snug text-slate-300">
            {qrModal.descripcion ?? "—"}
          </p>
          <div className="mt-4 flex w-full flex-col items-center gap-3">
            {/* Caja fija para que el modal no se mueva al cargar el PNG */}
            <div className="flex h-[296px] w-[296px] shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
              {qrGenError ? (
                <p className="px-2 text-center text-sm text-rose-400">No se pudo generar el código QR.</p>
              ) : qrDataUrl ? (
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
            </div>
            <p className="max-w-full break-all text-center font-mono text-[11px] text-slate-400">
              {qrModal.payload}
            </p>
            {qrDataUrl && !qrGenError ? (
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  className={btnQrAction}
                  onClick={() => {
                    void downloadQrSheetPng(qrDataUrl, {
                      codigo: qrModal.codigo,
                      descripcion: qrModal.descripcion,
                    }).catch(() => {
                      window.alert("No se pudo generar la imagen para descargar.");
                    });
                  }}
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
      </div>,
      document.body
    );

  const imgOverlay =
    mounted &&
    imgModal &&
    createPortal(
      <div className={overlayClass} role="presentation" onClick={() => setImgModal(null)}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={imgTitleId}
          className="relative my-auto max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/15 bg-slate-900 p-5 shadow-xl"
          onClick={(ev) => ev.stopPropagation()}
        >
          <button
            type="button"
            className="absolute right-3 top-3 z-10 rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
            onClick={() => setImgModal(null)}
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
          <h2 id={imgTitleId} className="pr-8 text-sm font-semibold text-white">
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
      </div>,
      document.body
    );

  return (
    <>
      <div className="flex items-center justify-center gap-0.5">
        <button type="button" title="Ver código QR" className={btnIcon} onClick={openQr}>
          <QrCode className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden />
        </button>
        <button type="button" title="Ver imágenes" className={btnIcon} onClick={openImg}>
          <Images className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden />
        </button>
      </div>
      {qrOverlay}
      {imgOverlay}
    </>
  );
}

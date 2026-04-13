"use client";

import { Download, Images, Printer, QrCode, X } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useId, useState } from "react";

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

export type ProductoQrImagenesControlsProps = {
  codigo: string;
  qrPayload: string;
  imagenesUrls: string[];
  size?: "sm" | "md";
  /** Ej.: `e.stopPropagation()` en filas clicables del catálogo */
  onOpenInteraction?: (e: React.MouseEvent) => void;
};

export function ProductoQrImagenesControls({
  codigo,
  qrPayload,
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

  const [qrModal, setQrModal] = useState<{ codigo: string; payload: string } | null>(null);
  const [imgModal, setImgModal] = useState<{ codigo: string; urls: string[] } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrGenError, setQrGenError] = useState(false);

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

  const openQr = (e: React.MouseEvent) => {
    onOpenInteraction?.(e);
    setQrModal({ codigo, payload: payloadEfectivo });
  };

  const openImg = (e: React.MouseEvent) => {
    onOpenInteraction?.(e);
    setImgModal({ codigo, urls: imagenesUrls });
  };

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

      {qrModal ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => setQrModal(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={qrTitleId}
            className="relative max-w-sm rounded-2xl border border-white/15 bg-slate-900 p-5 shadow-xl"
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
            <div className="mt-4 flex min-h-[280px] flex-col items-center justify-center gap-3">
              {qrGenError ? (
                <p className="text-center text-sm text-rose-400">No se pudo generar el código QR.</p>
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
            aria-labelledby={imgTitleId}
            className="relative max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/15 bg-slate-900 p-5 shadow-xl"
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
        </div>
      ) : null}
    </>
  );
}

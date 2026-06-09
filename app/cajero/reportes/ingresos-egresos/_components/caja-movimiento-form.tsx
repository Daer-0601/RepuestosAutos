"use client";

import { Loader2, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type ModoOperacion = "manual" | "devolucion" | "cambio";

type ProductoLookup = {
  id: number;
  codigo: string;
  nombre: string;
  medida: string | null;
  precioListaBs: number | null;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function fmtBs(n: number) {
  return round2(n).toFixed(2);
}

function fmtTc(n: number) {
  return Number(n).toFixed(4);
}

function montoSugerido(precio: number | null, cantidad: number): string {
  if (precio == null || !Number.isFinite(precio) || precio <= 0) return "";
  const c = Math.max(1, Math.trunc(cantidad));
  return String(round2(precio * c));
}

async function buscarProductoCaja(codigo: string): Promise<ProductoLookup | null> {
  const c = codigo.trim();
  if (!c) return null;
  const res = await fetch(
    `/api/cajero/productos-buscar?codigo=${encodeURIComponent(c)}`,
    { cache: "no-store" }
  );
  const data = (await res.json()) as { producto?: ProductoLookup | null; error?: string };
  if (!res.ok) throw new Error(data.error ?? "No se pudo buscar el producto.");
  return data.producto ?? null;
}

export function CajaMovimientoForm({
  fechaLabel,
  tipoCambioRef,
  onRegistered,
  onError,
  onOk,
}: {
  fechaLabel: string;
  tipoCambioRef: number | null;
  onRegistered: () => void | Promise<void>;
  onError: (msg: string | null) => void;
  onOk: (msg: string | null) => void;
}) {
  const [modo, setModo] = useState<ModoOperacion>("manual");
  const [pending, setPending] = useState(false);

  const [detalle, setDetalle] = useState("");
  const [monto, setMonto] = useState("");
  const [tipo, setTipo] = useState<"ingreso" | "egreso">("egreso");
  const [compraDolar, setCompraDolar] = useState(false);
  const [montoUsd, setMontoUsd] = useState("");
  const [tipoCambioCompra, setTipoCambioCompra] = useState("");

  const [codigoDev, setCodigoDev] = useState("");
  const [cantDev, setCantDev] = useState("1");
  const [montoDev, setMontoDev] = useState("");
  const [prodDev, setProdDev] = useState<ProductoLookup | null>(null);
  const [buscandoDev, setBuscandoDev] = useState(false);

  const [codigoEnt, setCodigoEnt] = useState("");
  const [cantEnt, setCantEnt] = useState("1");
  const [montoEnt, setMontoEnt] = useState("");
  const [prodEnt, setProdEnt] = useState<ProductoLookup | null>(null);
  const [buscandoEnt, setBuscandoEnt] = useState(false);

  const [nota, setNota] = useState("");

  useEffect(() => {
    if (tipoCambioRef != null && Number.isFinite(tipoCambioRef) && tipoCambioRef > 0) {
      setTipoCambioCompra((prev) => (prev.trim() === "" ? String(tipoCambioRef) : prev));
    }
  }, [tipoCambioRef]);

  const egresoCompraDolarPreview = useMemo(() => {
    const usd = Number(montoUsd);
    const tc = Number(tipoCambioCompra);
    if (!compraDolar || !Number.isFinite(usd) || usd <= 0 || !Number.isFinite(tc) || tc <= 0) {
      return null;
    }
    return round2(usd * tc);
  }, [compraDolar, montoUsd, tipoCambioCompra]);

  const lookupDev = useCallback(async () => {
    setBuscandoDev(true);
    onError(null);
    try {
      const p = await buscarProductoCaja(codigoDev);
      setProdDev(p);
      if (!p) {
        onError("No se encontró producto con ese código.");
        return;
      }
      setCodigoDev(p.codigo);
      const c = Math.max(1, Math.trunc(Number(cantDev) || 1));
      setMontoDev((prev) => prev.trim() || montoSugerido(p.precioListaBs, c));
    } catch (e) {
      setProdDev(null);
      onError(e instanceof Error ? e.message : "Error al buscar.");
    } finally {
      setBuscandoDev(false);
    }
  }, [codigoDev, cantDev, onError]);

  const lookupEnt = useCallback(async () => {
    setBuscandoEnt(true);
    onError(null);
    try {
      const p = await buscarProductoCaja(codigoEnt);
      setProdEnt(p);
      if (!p) {
        onError("No se encontró producto con ese código.");
        return;
      }
      setCodigoEnt(p.codigo);
      const c = Math.max(1, Math.trunc(Number(cantEnt) || 1));
      setMontoEnt((prev) => prev.trim() || montoSugerido(p.precioListaBs, c));
    } catch (e) {
      setProdEnt(null);
      onError(e instanceof Error ? e.message : "Error al buscar.");
    } finally {
      setBuscandoEnt(false);
    }
  }, [codigoEnt, cantEnt, onError]);

  const resetForm = () => {
    setDetalle("");
    setMonto("");
    setMontoUsd("");
    setCodigoDev("");
    setCantDev("1");
    setMontoDev("");
    setProdDev(null);
    setCodigoEnt("");
    setCantEnt("1");
    setMontoEnt("");
    setProdEnt(null);
    setNota("");
    if (tipoCambioRef != null) setTipoCambioCompra(String(tipoCambioRef));
  };

  const registrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    onError(null);
    onOk(null);
    try {
      let body: Record<string, unknown>;
      if (modo === "devolucion") {
        body = {
          tipo: "devolucion",
          devuelto: {
            codigo: codigoDev.trim() || prodDev?.codigo,
            cantidad: Number(cantDev) || 1,
            montoBs: Number(montoDev),
            nombre: prodDev?.nombre,
          },
          nota: nota.trim() || undefined,
        };
      } else if (modo === "cambio") {
        body = {
          tipo: "cambio",
          devuelto: {
            codigo: codigoDev.trim() || prodDev?.codigo,
            cantidad: Number(cantDev) || 1,
            montoBs: Number(montoDev),
            nombre: prodDev?.nombre,
          },
          entregado: {
            codigo: codigoEnt.trim() || prodEnt?.codigo,
            cantidad: Number(cantEnt) || 1,
            montoBs: Number(montoEnt),
            nombre: prodEnt?.nombre,
          },
          nota: nota.trim() || undefined,
        };
      } else if (compraDolar) {
        body = {
          operacion: "manual",
          compraDolar: true,
          detalle,
          montoUsd: Number(montoUsd),
          tipoCambioCompra: Number(tipoCambioCompra),
        };
      } else {
        body = {
          operacion: "manual",
          tipo,
          detalle,
          montoBs: Number(monto),
        };
      }

      const endpoint =
        modo === "devolucion" || modo === "cambio" ? "/api/cajero/caja-solicitudes" : "/api/cajero/caja-movimientos";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) {
        onError(json.error ?? "No se pudo registrar.");
        return;
      }

      resetForm();
      if (modo === "devolucion") onOk("Solicitud de devolución enviada a administración.");
      else if (modo === "cambio") onOk("Solicitud de cambio enviada a administración.");
      else if (compraDolar) onOk("Compra de dólares registrada.");
      else onOk("Movimiento registrado.");
      await onRegistered();
    } catch {
      onError("Error de red al guardar.");
    } finally {
      setPending(false);
    }
  };

  const inputCls =
    "mt-1 w-full rounded-lg border border-white/15 bg-slate-950/50 px-3 py-2 text-sm text-white placeholder:text-slate-600";

  return (
    <form
      onSubmit={(e) => void registrar(e)}
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 ring-1 ring-white/5"
    >
      <h2 className="text-sm font-semibold text-white">Nuevo movimiento</h2>
      <p className="mt-1 text-xs text-slate-400">
        Movimientos de caja del día — {fechaLabel}.
      </p>

      <fieldset className="mt-4">
        <span className="text-xs font-medium text-slate-400">Tipo de operación</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {(
            [
              ["manual", "Manual"],
              ["devolucion", "Devolución"],
              ["cambio", "Cambio"],
            ] as const
          ).map(([v, label]) => (
            <label
              key={v}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm has-[:checked]:ring-1 ${
                modo === v
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100 ring-emerald-500/30"
                  : "border-white/10 text-slate-300"
              }`}
            >
              <input
                type="radio"
                name="modo-op"
                checked={modo === v}
                onChange={() => {
                  setModo(v);
                  setCompraDolar(false);
                  onError(null);
                }}
                className="accent-emerald-500"
              />
              {label}
            </label>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          {modo === "devolucion"
            ? "Envía una solicitud de devolución para aprobación del administrador."
            : modo === "cambio"
              ? "Envía una solicitud de cambio para aprobación del administrador."
              : "Gasto, ingreso extra o compra de dólares."}
        </p>
      </fieldset>

      {modo === "devolucion" ? (
        <div className="mt-4 space-y-4">
          <ProductoCajaBlock
            titulo="Producto devuelto"
            codigo={codigoDev}
            setCodigo={setCodigoDev}
            cantidad={cantDev}
            setCantidad={setCantDev}
            monto={montoDev}
            setMonto={setMontoDev}
            producto={prodDev}
            buscando={buscandoDev}
            onBuscar={() => void lookupDev()}
            onCantidadChange={(c) => {
              if (prodDev?.precioListaBs) setMontoDev(montoSugerido(prodDev.precioListaBs, c));
            }}
            inputCls={inputCls}
            tipoMonto="egreso"
          />
          <label className="block">
            <span className="text-xs font-medium text-slate-400">Nota (opcional)</span>
            <input
              type="text"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              maxLength={200}
              className={inputCls}
            />
          </label>
        </div>
      ) : null}

      {modo === "cambio" ? (
        <div className="mt-4 space-y-4">
          <ProductoCajaBlock
            titulo="Producto devuelto (egreso)"
            codigo={codigoDev}
            setCodigo={setCodigoDev}
            cantidad={cantDev}
            setCantidad={setCantDev}
            monto={montoDev}
            setMonto={setMontoDev}
            producto={prodDev}
            buscando={buscandoDev}
            onBuscar={() => void lookupDev()}
            onCantidadChange={(c) => {
              if (prodDev?.precioListaBs) setMontoDev(montoSugerido(prodDev.precioListaBs, c));
            }}
            inputCls={inputCls}
            tipoMonto="egreso"
          />
          <ProductoCajaBlock
            titulo="Producto entregado (ingreso)"
            codigo={codigoEnt}
            setCodigo={setCodigoEnt}
            cantidad={cantEnt}
            setCantidad={setCantEnt}
            monto={montoEnt}
            setMonto={setMontoEnt}
            producto={prodEnt}
            buscando={buscandoEnt}
            onBuscar={() => void lookupEnt()}
            onCantidadChange={(c) => {
              if (prodEnt?.precioListaBs) setMontoEnt(montoSugerido(prodEnt.precioListaBs, c));
            }}
            inputCls={inputCls}
            tipoMonto="ingreso"
          />
          <label className="block">
            <span className="text-xs font-medium text-slate-400">Nota (opcional)</span>
            <input
              type="text"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              maxLength={200}
              className={inputCls}
            />
          </label>
        </div>
      ) : null}

      {modo === "manual" ? (
        <>
          <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-950/20 px-3 py-3 text-sm text-amber-100/90">
            <input
              type="checkbox"
              checked={compraDolar}
              onChange={(e) => {
                setCompraDolar(e.target.checked);
                if (e.target.checked) setTipo("egreso");
              }}
              className="mt-0.5 rounded accent-amber-500"
            />
            <span>
              <strong className="text-amber-50">Compra de dólares (C$)</strong>
              <span className="mt-0.5 block text-xs font-normal text-amber-200/70">
                Egreso en Bs = USD × tipo de cambio que pagaste.
              </span>
            </span>
          </label>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-slate-400">Detalle</span>
              <input
                type="text"
                value={detalle}
                onChange={(e) => setDetalle(e.target.value)}
                placeholder={compraDolar ? "Opcional" : "Ej. Compra comida"}
                maxLength={500}
                required={!compraDolar}
                className={inputCls}
              />
            </label>

            {compraDolar ? (
              <>
                <label className="block">
                  <span className="text-xs font-medium text-slate-400">USD comprados</span>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={montoUsd}
                    onChange={(e) => setMontoUsd(e.target.value)}
                    required
                    className={inputCls}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-400">Tipo cambio (Bs/USD)</span>
                  <input
                    type="number"
                    min="0.0001"
                    step="any"
                    value={tipoCambioCompra}
                    onChange={(e) => setTipoCambioCompra(e.target.value)}
                    required
                    className={inputCls}
                  />
                  {tipoCambioRef != null ? (
                    <span className="mt-1 block text-[11px] text-slate-500">
                      Referencia: {fmtTc(tipoCambioRef)} Bs/USD
                    </span>
                  ) : null}
                </label>
                <div className="sm:col-span-2 rounded-lg border border-rose-500/20 bg-rose-950/20 px-3 py-2 text-sm text-rose-100">
                  Egreso:{" "}
                  <span className="font-mono font-semibold">
                    {egresoCompraDolarPreview != null ? `${fmtBs(egresoCompraDolarPreview)} Bs` : "—"}
                  </span>
                </div>
              </>
            ) : (
              <>
                <label className="block">
                  <span className="text-xs font-medium text-slate-400">Monto (Bs)</span>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    required
                    className={inputCls}
                  />
                </label>
                <fieldset className="block">
                  <span className="text-xs font-medium text-slate-400">Tipo</span>
                  <div className="mt-2 flex gap-3">
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm has-[:checked]:border-emerald-500/50 has-[:checked]:bg-emerald-500/10">
                      <input
                        type="radio"
                        name="tipo-mov"
                        checked={tipo === "ingreso"}
                        onChange={() => setTipo("ingreso")}
                        className="accent-emerald-500"
                      />
                      Ingreso
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm has-[:checked]:border-rose-500/50 has-[:checked]:bg-rose-500/10">
                      <input
                        type="radio"
                        name="tipo-mov"
                        checked={tipo === "egreso"}
                        onChange={() => setTipo("egreso")}
                        className="accent-rose-500"
                      />
                      Egreso
                    </label>
                  </div>
                </fieldset>
              </>
            )}
          </div>
        </>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {modo === "cambio"
          ? "Enviar solicitud de cambio"
          : modo === "devolucion"
            ? "Enviar solicitud de devolución"
            : "Guardar movimiento"}
      </button>
    </form>
  );
}

function ProductoCajaBlock({
  titulo,
  codigo,
  setCodigo,
  cantidad,
  setCantidad,
  monto,
  setMonto,
  producto,
  buscando,
  onBuscar,
  onCantidadChange,
  inputCls,
  tipoMonto,
}: {
  titulo: string;
  codigo: string;
  setCodigo: (v: string) => void;
  cantidad: string;
  setCantidad: (v: string) => void;
  monto: string;
  setMonto: (v: string) => void;
  producto: ProductoLookup | null;
  buscando: boolean;
  onBuscar: () => void;
  onCantidadChange: (cantidad: number) => void;
  inputCls: string;
  tipoMonto: "ingreso" | "egreso";
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs font-semibold text-slate-300">{titulo}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-xs text-slate-500">Código / QR</span>
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onBuscar();
                }
              }}
              placeholder="Escanear o escribir código"
              className={inputCls + " mt-0 flex-1"}
            />
            <button
              type="button"
              onClick={onBuscar}
              disabled={buscando || !codigo.trim()}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-200 hover:bg-white/5 disabled:opacity-50"
            >
              {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Buscar
            </button>
          </div>
          {producto ? (
            <span className="mt-1 block text-xs text-emerald-300/90">
              <span className="font-mono text-slate-400">{producto.codigo}</span>
              {producto.nombre ? ` · ${producto.nombre}` : null}
            </span>
          ) : null}
        </label>
        <label className="block">
          <span className="text-xs text-slate-500">Cantidad</span>
          <input
            type="number"
            min="1"
            step="1"
            value={cantidad}
            onChange={(e) => {
              setCantidad(e.target.value);
              onCantidadChange(Math.max(1, Math.trunc(Number(e.target.value) || 1)));
            }}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="text-xs text-slate-500">
            Monto Bs ({tipoMonto === "egreso" ? "egreso" : "ingreso"})
          </span>
          <input
            type="number"
            min="0.01"
            step="any"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            required
            className={inputCls}
          />
        </label>
      </div>
    </div>
  );
}

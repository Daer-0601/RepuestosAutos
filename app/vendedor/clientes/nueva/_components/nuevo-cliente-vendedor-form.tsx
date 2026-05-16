"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";

const field =
  "mt-1 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-amber-500/40";

export function NuevoClienteVendedorForm() {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [carnetIdentidad, setCarnetIdentidad] = useState("");
  const [direccion, setDireccion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/vendedor/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          nombre,
          telefono,
          carnet_identidad: carnetIdentidad,
          direccion: direccion.trim() || null,
        }),
      });
      const data = (await res.json()) as { clienteId?: number; error?: string };
      if (!res.ok) {
        setMsg({ type: "err", text: data.error ?? "No se pudo registrar." });
        return;
      }
      if (data.clienteId == null || !Number.isFinite(data.clienteId)) {
        setMsg({ type: "err", text: "Respuesta inválida del servidor." });
        return;
      }
      setMsg({ type: "ok", text: `Cliente registrado correctamente.` });
      setNombre("");
      setTelefono("");
      setCarnetIdentidad("");
      setDireccion("");
    } catch {
      setMsg({ type: "err", text: "Error de red." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-4 rounded-2xl border border-white/10 bg-slate-900/50 p-5 sm:p-6">
      {msg ? (
        <div
          className={`flex gap-3 rounded-xl border px-4 py-3 text-sm ${
            msg.type === "ok"
              ? "border-emerald-500/35 bg-emerald-950/25 text-emerald-100"
              : "border-rose-500/35 bg-rose-950/30 text-rose-100"
          }`}
          role="status"
        >
          {msg.type === "ok" ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
          ) : null}
          <p>{msg.text}</p>
        </div>
      ) : null}

      <div>
        <label htmlFor="vc-nombre" className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Nombre completo o razón social <span className="text-rose-300/90">*</span>
        </label>
        <input
          id="vc-nombre"
          name="nombre"
          required
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className={field}
          autoComplete="name"
        />
      </div>
      <div>
        <label htmlFor="vc-tel" className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Teléfono <span className="text-rose-300/90">*</span>
        </label>
        <input
          id="vc-tel"
          name="telefono"
          type="tel"
          required
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          className={`${field} font-mono`}
          autoComplete="tel"
        />
      </div>
      <div>
        <label htmlFor="vc-ci" className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Carnet de identidad <span className="text-rose-300/90">*</span>{" "}
          <span className="font-normal normal-case text-slate-600">(solo números)</span>
        </label>
        <input
          id="vc-ci"
          name="carnet_identidad"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          required
          value={carnetIdentidad}
          onChange={(e) => setCarnetIdentidad(e.target.value.replace(/\D/g, ""))}
          className={`${field} font-mono`}
          placeholder="Ej. 1234567"
          autoComplete="off"
        />
      </div>
      <div>
        <label htmlFor="vc-dir" className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Dirección <span className="font-normal normal-case text-slate-600">(opcional)</span>
        </label>
        <textarea
          id="vc-dir"
          name="direccion"
          rows={3}
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          className={field}
          autoComplete="street-address"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex min-w-[160px] items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-900/20 transition hover:bg-amber-400 disabled:pointer-events-none disabled:opacity-50"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        Guardar cliente
      </button>
    </form>
  );
}

import { AdminSection } from "@/app/admin/_components/admin-section";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tipo de cambio",
};

export default function AdminTipoCambioPage() {
  return (
    <AdminSection
      title="Tipo de cambio"
      description="Registro histórico de Bs por USD (valor vigente)."
    >
      <p>
        Altas en{" "}
        <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-slate-200">
          tipo_cambio
        </code>{" "}
        con usuario y nota opcional.
      </p>
    </AdminSection>
  );
}

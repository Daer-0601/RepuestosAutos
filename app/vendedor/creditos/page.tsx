import { PanelSection } from "@/app/_components/panel-section";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Créditos",
};

export default function VendedorCreditosPage() {
  return (
    <PanelSection
      variant="vendedor"
      title="Créditos"
      description="Ventas a crédito pendientes y registro de abonos."
    >
      <p>
        Pantallas sobre{" "}
        <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-slate-200">
          creditos
        </code>
        ,{" "}
        <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-slate-200">
          pagos_credito
        </code>{" "}
        y ventas asociadas a tu sucursal.
      </p>
    </PanelSection>
  );
}

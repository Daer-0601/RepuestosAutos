import { CreditosCajeroPanel } from "@/app/cajero/reportes/creditos/_components/creditos-cajero-panel";
import { PanelSection } from "@/app/_components/panel-section";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cobro de créditos",
};

export default function CajeroReporteCreditosPage() {
  return (
    <PanelSection variant="cajero" wide title="Créditos — cobro en caja">
      <CreditosCajeroPanel />
    </PanelSection>
  );
}

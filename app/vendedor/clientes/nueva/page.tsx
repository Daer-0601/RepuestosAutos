import { PanelSection } from "@/app/_components/panel-section";
import { NuevoClienteVendedorForm } from "@/app/vendedor/clientes/nueva/_components/nuevo-cliente-vendedor-form";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Nuevo cliente",
};

export default function VendedorNuevoClientePage() {
  return (
    <PanelSection
      variant="vendedor"
      title="Nuevo cliente"
      description="Registro en el directorio compartido (mismo listado que usa administración y créditos). Nombre, teléfono y carnet (solo dígitos) son obligatorios; la dirección es opcional."
    >
      <p className="-mt-2 mb-4">
        <Link
          href="/vendedor/clientes"
          className="text-sm font-medium text-amber-200/90 underline decoration-amber-500/50 underline-offset-2 hover:text-amber-100"
        >
          ← Ver lista de clientes
        </Link>
      </p>
      <NuevoClienteVendedorForm />
    </PanelSection>
  );
}

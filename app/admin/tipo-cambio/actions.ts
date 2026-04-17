"use server";

import { getAdminSession } from "@/lib/auth/admin-session";
import { refreshPrecioVentaBsDesdeTipoCambio } from "@/lib/data/productos";
import * as repo from "@/lib/data/tipo-cambio";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createTipoCambioAction(formData: FormData) {
  const admin = await getAdminSession();
  if (!admin) {
    redirect("/login");
  }

  const raw = String(formData.get("valor_bs_por_usd") ?? "").replace(",", ".").trim();
  const valor = Number(raw);
  const nota = String(formData.get("nota") ?? "").trim() || null;

  if (!Number.isFinite(valor) || valor <= 0) {
    redirect(
      `/admin/tipo-cambio?error=${encodeURIComponent("Ingresá un valor numérico mayor a 0 (Bs por 1 USD).")}`
    );
  }

  await repo.insertTipoCambio({
    valor_bs_por_usd: valor,
    usuario_id: admin.userId,
    nota,
  });
  await refreshPrecioVentaBsDesdeTipoCambio(valor);
  revalidatePath("/admin/tipo-cambio");
  revalidatePath("/admin/productos");
  redirect("/admin/tipo-cambio");
}

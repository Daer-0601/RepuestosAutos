"use server";

import { authenticateUsuario, ROLE_HOME_PATHS } from "@/lib/auth/login-user";
import { setSessionCookie } from "@/lib/auth/session-cookie";
import { redirect } from "next/navigation";

export type LoginState = { error: string } | null;

export async function login(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "Ingresá usuario y contraseña." };
  }

  const result = await authenticateUsuario(username, password);

  if (!result.ok) {
    switch (result.reason) {
      case "inactive":
        return { error: "Esta cuenta está desactivada." };
      case "unknown_role":
        return { error: "Tu rol no tiene panel asignado. Contactá al administrador." };
      case "db_error":
        return { error: "No se pudo conectar con la base de datos. Intentá de nuevo." };
      default:
        return { error: "Usuario o contraseña incorrectos." };
    }
  }

  try {
    await setSessionCookie(result.user);
  } catch (e) {
    if (e instanceof Error && e.message.includes("AUTH_SECRET")) {
      return { error: "Falta configurar AUTH_SECRET en el servidor." };
    }
    throw e;
  }

  redirect(ROLE_HOME_PATHS[result.user.rol_id]);
}

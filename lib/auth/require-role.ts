import "server-only";

import { redirect } from "next/navigation";
import { ROLE_HOME_PATHS } from "@/lib/auth/role-routes";
import { getSession, type SessionUser } from "@/lib/auth/session-cookie";

async function requireRole(
  allowed: readonly number[]
): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (!allowed.includes(session.rolId)) {
    redirect(ROLE_HOME_PATHS[session.rolId] ?? "/login");
  }
  return session;
}

export async function requireAdmin(): Promise<SessionUser> {
  return requireRole([1]);
}

export async function requireCashier(): Promise<SessionUser> {
  return requireRole([2]);
}

export async function requireSeller(): Promise<SessionUser> {
  return requireRole([3]);
}

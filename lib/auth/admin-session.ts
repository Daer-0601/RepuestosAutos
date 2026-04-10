import "server-only";

import { getSession, type SessionUser } from "@/lib/auth/session-cookie";

export async function getAdminSession(): Promise<SessionUser | null> {
  const s = await getSession();
  if (!s || s.rolId !== 1) {
    return null;
  }
  return s;
}

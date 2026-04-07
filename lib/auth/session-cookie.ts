import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "repuestos_session";

function getAuthSecretKey(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "AUTH_SECRET debe tener al menos 16 caracteres. Definilo en .env.local."
    );
  }
  return new TextEncoder().encode(s);
}

export async function setSessionCookie(user: {
  id: number;
  username: string;
  rol_id: number;
}): Promise<void> {
  const token = await new SignJWT({
    sub: String(user.id),
    username: user.username,
    rol: user.rol_id,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getAuthSecretKey());

  const jar = await cookies();
  jar.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export type SessionUser = {
  userId: number;
  username: string;
  rolId: number;
};

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) {
    return null;
  }
  try {
    const { payload } = await jwtVerify(raw, getAuthSecretKey());
    const userId = Number(payload.sub);
    const rolId = Number(payload.rol);
    const username = String(payload.username ?? "");
    if (!Number.isFinite(userId) || !Number.isFinite(rolId)) {
      return null;
    }
    return { userId, username, rolId };
  } catch {
    return null;
  }
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

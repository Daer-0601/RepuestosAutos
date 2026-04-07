"use server";

import { clearSessionCookie } from "@/lib/auth/session-cookie";
import { redirect } from "next/navigation";

export async function logout() {
  await clearSessionCookie();
  redirect("/login");
}

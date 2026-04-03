"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PERSONA_COOKIE, type Persona, isPersona } from "@/lib/constants";

export async function choosePersona(persona: Persona) {
  const jar = await cookies();
  jar.set(PERSONA_COOKIE, persona, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
  });
  redirect("/shop");
}

export async function choosePersonaForm(formData: FormData) {
  const raw = String(formData.get("persona") ?? "");
  if (!isPersona(raw)) redirect("/");
  await choosePersona(raw);
}

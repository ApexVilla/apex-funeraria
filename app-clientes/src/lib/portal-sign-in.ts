import { supabase } from "./supabase";
import { portalAuthEmailFromCpf } from "./portal-auth";

function legacyPortalEmail(email?: string | null): string | null {
  const trimmed = email?.trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) return null;
  if (trimmed.endsWith("@portal.cliente.fenix")) return null;
  return trimmed;
}

export async function signInPortalWithPassword(
  cpf: string,
  password: string,
  clienteEmail?: string | null
) {
  if (!supabase) {
    return { data: null, error: new Error("Supabase não configurado") };
  }

  const portalEmail = portalAuthEmailFromCpf(cpf);
  const emails = [portalEmail];
  const legacyEmail = legacyPortalEmail(clienteEmail);
  if (legacyEmail && legacyEmail !== portalEmail) {
    emails.push(legacyEmail);
  }

  let lastError: Error | null = null;

  for (const email of emails) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!error) {
      return { data, error: null };
    }

    lastError = error;
    const message = error.message.toLowerCase();
    const shouldTryNext =
      message.includes("invalid login credentials") ||
      message.includes("invalid credentials");

    if (!shouldTryNext) {
      return { data: null, error };
    }
  }

  return { data: null, error: lastError };
}

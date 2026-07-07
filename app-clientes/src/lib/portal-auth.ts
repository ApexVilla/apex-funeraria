const PORTAL_EMAIL_DOMAIN = "portal.cliente.fenix";

export function cleanDocument(doc: string): string {
  return doc.replace(/\D/g, "");
}

/** E-mail técnico usado pelo Supabase Auth quando o cliente não tem e-mail real. */
export function portalAuthEmailFromCpf(cpf: string): string {
  const digits = cleanDocument(cpf);
  return `${digits}@${PORTAL_EMAIL_DOMAIN}`;
}

export function resolvePortalAuthEmail(
  cpf: string,
  _email?: string | null
): string {
  return portalAuthEmailFromCpf(cpf);
}

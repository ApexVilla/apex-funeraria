const PORTAL_EMAIL_DOMAIN = "portal.cliente.fenix";

export function isPortalAuthEmail(email?: string | null): boolean {
  return Boolean(email?.trim().toLowerCase().endsWith(`@${PORTAL_EMAIL_DOMAIN}`));
}

export function resolveClienteEmail(
  profileEmail?: string | null,
  authEmail?: string | null
): string {
  const profile = profileEmail?.trim();
  if (profile) return profile;

  const auth = authEmail?.trim();
  if (auth && !isPortalAuthEmail(auth)) return auth;

  return "Não informado";
}

export function formatCpfDisplay(cpf?: string | null): string {
  if (!cpf) return "N/A";
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

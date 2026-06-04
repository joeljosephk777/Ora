export type AppRole = "professor" | "ta" | "student";

type AuthUserLike = {
  email?: string | null;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
  identities?: Array<{
    identity_data?: Record<string, unknown> | null;
  }> | null;
};

export function getHomePathForRole(role: string | undefined | null) {
  if (role === "student") return "/student/dashboard";
  if (role === "ta") return "/ta/dashboard";
  if (role === "professor") return "/professor/dashboard";
  return "/role";
}

export function getAllowedUwDomains() {
  return (process.env.UW_AUTH_DOMAINS ?? "uw.edu,u.washington.edu")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedUwEmail(email: string | null | undefined) {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) return false;

  return getAllowedUwDomains().some((domain) => normalizedEmail.endsWith(`@${domain}`));
}

export function getHostedDomainFromUser(user: AuthUserLike | null | undefined) {
  const candidates = [
    user?.app_metadata?.hd,
    user?.app_metadata?.hosted_domain,
    user?.user_metadata?.hd,
    user?.user_metadata?.hosted_domain,
    ...(user?.identities ?? []).flatMap((identity) => [
      identity.identity_data?.hd,
      identity.identity_data?.hosted_domain,
    ]),
  ];

  const hostedDomain = candidates.find((value): value is string => typeof value === "string" && value.length > 0);
  return hostedDomain?.toLowerCase() ?? null;
}

export function isAllowedUwUser(user: AuthUserLike | null | undefined) {
  const hostedDomain = getHostedDomainFromUser(user);
  const allowedDomains = getAllowedUwDomains();

  return Boolean(
    (hostedDomain && allowedDomains.includes(hostedDomain)) ||
      isAllowedUwEmail(user?.email)
  );
}

export function getGoogleHostedDomainHint() {
  return getAllowedUwDomains()[0] ?? "uw.edu";
}

export function isAllowedProfessorEmail(email: string | null | undefined) {
  const allowlist = (process.env.PROFESSOR_EMAIL_ALLOWLIST ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (allowlist.length === 0) return true;

  const normalizedEmail = email?.trim().toLowerCase();
  return Boolean(normalizedEmail && allowlist.includes(normalizedEmail));
}

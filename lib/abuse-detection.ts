export const CELEBRITY_BLOCKLIST = [
  "taylor swift", "beyonce", "barack obama", "donald trump", "elon musk",
  "tom cruise", "dwayne johnson", "kim kardashian", "oprah winfrey",
  "morgan freeman", "joe rogan", "kanye west", "ye", "drake",
  "ariana grande", "justin bieber", "billie eilish", "lebron james",
  "cristiano ronaldo", "lionel messi",
] as const;

type AuthIdentity = {
  id?: string;
  email?: string | null;
  displayName?: string | null;
  user_metadata?: Record<string, unknown> | null;
} | null;

export type AbuseCheckInput = {
  voiceOwnerName?: string | null;
  voiceName?: string | null;
  textScript?: string | null;
  authUser?: AuthIdentity;
  strictOwnerMatch?: boolean;
};

export type AbuseCheckResult = {
  blocked: boolean;
  code: "ALLOWED" | "CELEBRITY" | "IMPERSONATION";
  reason?: string;
  mismatchedOwner: boolean;
};

export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function matchedCelebrity(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const normalized = normalizeName(value);
  return CELEBRITY_BLOCKLIST.find((entry) => {
    const celebrity = normalizeName(entry);
    if (!celebrity.includes(" ")) return normalized === celebrity;
    return normalized === celebrity || normalized.includes(celebrity);
  }) ?? null;
}

export function isCelebrityName(value: string | null | undefined): boolean {
  return matchedCelebrity(value) !== null;
}

export function extractAuthIdentities(user: AuthIdentity): string[] {
  if (!user) return [];
  const metadata = user.user_metadata ?? {};
  const normalizedEmail = user.email
    ? user.email
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9@]+/g, " ")
        .trim()
        .replace(/\s+/g, " ")
    : null;
  const raw = [
    user.email?.split("@")[0].replace(/[._-]+/g, " "),
    user.displayName,
    typeof metadata.full_name === "string" ? metadata.full_name : null,
    typeof metadata.name === "string" ? metadata.name : null,
  ];
  const identities = raw.filter((value): value is string => Boolean(value)).map(normalizeName).filter(Boolean);
  if (normalizedEmail) identities.push(normalizedEmail);
  return [...new Set(identities)];
}

export function isVoiceOwnerMismatched(ownerName: string | null | undefined, user: AuthIdentity): boolean {
  if (!ownerName?.trim()) return false;
  const identities = extractAuthIdentities(user);
  if (identities.length === 0) return false;
  const owner = normalizeName(ownerName);
  return !identities.some((identity) => identity === owner || identity.includes(owner) || owner.includes(identity));
}

export function checkAbuse(input: AbuseCheckInput): AbuseCheckResult {
  const values = [input.voiceOwnerName, input.voiceName, input.textScript];
  for (const value of values) {
    const celebrity = matchedCelebrity(value);
    if (celebrity) {
      return {
        blocked: true,
        code: "CELEBRITY",
        reason: `Requests involving ${celebrity} are not allowed. Use an authorized family voice instead.`,
        mismatchedOwner: isVoiceOwnerMismatched(input.voiceOwnerName, input.authUser ?? null),
      };
    }
  }

  return {
    blocked: false,
    code: "ALLOWED",
    mismatchedOwner: isVoiceOwnerMismatched(input.voiceOwnerName, input.authUser ?? null),
  };
}

export function checkAbuseStrict(input: AbuseCheckInput): AbuseCheckResult {
  const result = checkAbuse(input);
  if (result.blocked || !input.strictOwnerMatch || !result.mismatchedOwner) return result;
  return {
    blocked: true,
    code: "IMPERSONATION",
    reason: "The voice owner does not match the authenticated account identity.",
    mismatchedOwner: true,
  };
}

import bcrypt from "bcryptjs";

/**
 * Password hashing for Credentials auth (Phase 3 of the local-stack
 * migration). bcryptjs chosen over argon2 for zero native deps and
 * adequate strength at cost 12 for a local-first deployment.
 */
const BCRYPT_COST = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

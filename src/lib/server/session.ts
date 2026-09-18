import { SignJWT, jwtVerify } from "jose";

const secretEnv = process.env.PASSKU_SESSION_SECRET;
if (!secretEnv) {
  throw new Error("PASSKU_SESSION_SECRET env var is required");
}
const secret = new TextEncoder().encode(secretEnv);

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ sub: "vault-owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS)
    .sign(secret);
}

export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

export const SESSION_COOKIE = "passku_session";

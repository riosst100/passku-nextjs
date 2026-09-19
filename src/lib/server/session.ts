import { SignJWT, jwtVerify } from "jose";
import db from "@/lib/server/db";

const secretEnv = process.env.PASSKU_SESSION_SECRET;
if (!secretEnv) {
  throw new Error("PASSKU_SESSION_SECRET env var is required");
}
const secret = new TextEncoder().encode(secretEnv);

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export interface SessionRow {
  id: string;
  ip: string | null;
  user_agent: string | null;
  created_at: number;
  last_seen_at: number;
  revoked_at: number | null;
}

export async function createSessionToken(ip: string | null, userAgent: string | null): Promise<string> {
  const sessionId = crypto.randomUUID();
  const now = Date.now();

  db.prepare(
    `INSERT INTO sessions (id, ip, user_agent, created_at, last_seen_at, revoked_at)
     VALUES (?, ?, ?, ?, ?, NULL)`
  ).run(sessionId, ip, userAgent, now, now);

  return new SignJWT({ sub: "vault-owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(sessionId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS)
    .sign(secret);
}

/** Verifies the JWT signature/expiry and that the session hasn't been revoked. Bumps last_seen_at on success. */
export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, secret);
    const sessionId = payload.jti;
    if (!sessionId) return false;

    const row = db.prepare("SELECT revoked_at FROM sessions WHERE id = ?").get(sessionId) as
      | { revoked_at: number | null }
      | undefined;
    if (!row || row.revoked_at !== null) return false;

    db.prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?").run(Date.now(), sessionId);
    return true;
  } catch {
    return false;
  }
}

export async function getSessionIdFromToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return typeof payload.jti === "string" ? payload.jti : null;
  } catch {
    return null;
  }
}

export function listSessions(): SessionRow[] {
  return db
    .prepare("SELECT * FROM sessions ORDER BY last_seen_at DESC")
    .all() as SessionRow[];
}

export function revokeSession(id: string): void {
  db.prepare("UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL").run(Date.now(), id);
}

export const SESSION_COOKIE = "passku_session";

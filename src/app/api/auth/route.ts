import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/server/db";
import { createSessionToken, SESSION_COOKIE } from "@/lib/server/session";
import { sha256Hex, safeEqual } from "@/lib/server/hash";

interface VaultMetaRow {
  id: string;
  auth_secret_hash: string;
}

/**
 * The client derives authSecret from the master password via PBKDF2 (separate
 * from the encryption key, so this value can't be used to decrypt the vault).
 * The server only ever stores/compares its SHA-256 hash.
 */
export async function POST(req: NextRequest) {
  const row = db
    .prepare("SELECT id, auth_secret_hash FROM vault_meta WHERE id = 'vault-meta'")
    .get() as VaultMetaRow | undefined;

  if (!row) {
    return NextResponse.json({ error: "Vault not set up" }, { status: 404 });
  }

  const { authSecret } = (await req.json()) as { authSecret?: string };
  if (!authSecret) {
    return NextResponse.json({ error: "Missing authSecret" }, { status: 400 });
  }

  const candidateHash = sha256Hex(authSecret);
  if (!safeEqual(candidateHash, row.auth_secret_hash)) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await createSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}

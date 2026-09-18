import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/server/db";
import { sha256Hex } from "@/lib/server/hash";

interface VaultMetaRow {
  id: string;
  salt_b64: string;
  verifier: string;
}

export async function GET() {
  const row = db
    .prepare("SELECT id, salt_b64, verifier FROM vault_meta WHERE id = 'vault-meta'")
    .get() as VaultMetaRow | undefined;

  if (!row) {
    return NextResponse.json({ exists: false });
  }
  return NextResponse.json({ exists: true, saltB64: row.salt_b64, verifier: row.verifier });
}

export async function POST(req: NextRequest) {
  const existing = db.prepare("SELECT id FROM vault_meta WHERE id = 'vault-meta'").get();
  if (existing) {
    return NextResponse.json({ error: "Vault already set up" }, { status: 409 });
  }

  const body = await req.json();
  const { saltB64, verifier, authSecret } = body as {
    saltB64?: string;
    verifier?: string;
    authSecret?: string;
  };
  if (!saltB64 || !verifier || !authSecret) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  db.prepare(
    "INSERT INTO vault_meta (id, salt_b64, verifier, auth_secret_hash) VALUES ('vault-meta', ?, ?, ?)"
  ).run(saltB64, verifier, sha256Hex(authSecret));

  return NextResponse.json({ ok: true });
}

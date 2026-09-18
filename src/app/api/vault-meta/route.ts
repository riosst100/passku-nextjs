import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/server/db";

interface VaultMetaRow {
  id: string;
  salt_b64: string;
  verifier: string;
}

export async function GET() {
  const row = db.prepare("SELECT * FROM vault_meta WHERE id = 'vault-meta'").get() as
    | VaultMetaRow
    | undefined;

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
  const { saltB64, verifier } = body as { saltB64?: string; verifier?: string };
  if (!saltB64 || !verifier) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  db.prepare(
    "INSERT INTO vault_meta (id, salt_b64, verifier) VALUES ('vault-meta', ?, ?)"
  ).run(saltB64, verifier);

  return NextResponse.json({ ok: true });
}

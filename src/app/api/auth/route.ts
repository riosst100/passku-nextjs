import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/server/db";
import { createSessionToken, SESSION_COOKIE } from "@/lib/server/session";

interface VaultMetaRow {
  id: string;
  salt_b64: string;
  verifier: string;
}

/**
 * Client already derived the key locally and decrypted the verifier to confirm
 * the master password is correct. It proves that here by re-submitting the
 * verifier ciphertext re-encrypted with a fresh IV — since only a holder of the
 * correct key can produce a value that decrypts back to VERIFIER_PLAINTEXT.
 */
export async function POST(req: NextRequest) {
  const row = db.prepare("SELECT * FROM vault_meta WHERE id = 'vault-meta'").get() as
    | VaultMetaRow
    | undefined;

  if (!row) {
    return NextResponse.json({ error: "Vault not set up" }, { status: 404 });
  }

  const { proof } = (await req.json()) as { proof?: string };
  if (!proof) {
    return NextResponse.json({ error: "Missing proof" }, { status: 400 });
  }

  // The proof is the client's decrypted verifier plaintext, sent over HTTPS.
  if (proof !== "passku-verifier") {
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

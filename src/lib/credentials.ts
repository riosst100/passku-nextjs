import { db } from "@/lib/db";
import { decryptString, encryptString } from "@/lib/crypto";
import type { Credential, CredentialPayload } from "@/types";

export async function listCredentials(
  key: CryptoKey
): Promise<Array<{ id: string; site: string; payload: CredentialPayload; updatedAt: number }>> {
  const rows = await db.credentials.orderBy("site").toArray();
  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      site: row.site,
      updatedAt: row.updatedAt,
      payload: JSON.parse(await decryptString(key, row.data)) as CredentialPayload,
    }))
  );
}

export async function saveCredential(
  key: CryptoKey,
  site: string,
  payload: CredentialPayload,
  id?: string
): Promise<void> {
  const now = Date.now();
  const data = await encryptString(key, JSON.stringify(payload));
  const record: Credential = {
    id: id ?? crypto.randomUUID(),
    site,
    data,
    createdAt: id ? (await db.credentials.get(id))?.createdAt ?? now : now,
    updatedAt: now,
  };
  await db.credentials.put(record);
}

export async function deleteCredential(id: string): Promise<void> {
  await db.credentials.delete(id);
}

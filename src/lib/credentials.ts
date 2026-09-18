import { db } from "@/lib/db";
import { decryptString, encryptString } from "@/lib/crypto";
import type { Credential, CredentialPayload } from "@/types";

interface ServerCredential {
  id: string;
  site: string;
  data: string;
  createdAt: number;
  updatedAt: number;
}

async function pullFromServer(): Promise<void> {
  if (!navigator.onLine) return;
  try {
    const res = await fetch("/api/credentials");
    if (!res.ok) return;
    const rows = (await res.json()) as ServerCredential[];
    await db.credentials.bulkPut(rows);

    const serverIds = new Set(rows.map((r) => r.id));
    const localRows = await db.credentials.toArray();
    const staleIds = localRows.filter((r) => !serverIds.has(r.id)).map((r) => r.id);
    if (staleIds.length) await db.credentials.bulkDelete(staleIds);
  } catch {
    // offline or server unreachable; fall back to local cache
  }
}

function pushToServer(record: Credential): void {
  if (!navigator.onLine) return;
  fetch("/api/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  }).catch(() => {});
}

function deleteFromServer(id: string): void {
  if (!navigator.onLine) return;
  fetch(`/api/credentials/${id}`, { method: "DELETE" }).catch(() => {});
}

export async function listCredentials(
  key: CryptoKey
): Promise<Array<{ id: string; site: string; payload: CredentialPayload; updatedAt: number }>> {
  await pullFromServer();
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
  pushToServer(record);
}

export async function deleteCredential(id: string): Promise<void> {
  await db.credentials.delete(id);
  deleteFromServer(id);
}

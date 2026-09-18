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

/** Pushes any locally queued creates/updates/deletes made while offline. */
async function flushPendingOps(): Promise<void> {
  const all = await db.credentials.toArray();
  const pending = all.filter((r) => r.pendingOp);

  for (const row of pending) {
    if (row.pendingOp === "delete") {
      const res = await fetch(`/api/credentials/${row.id}`, { method: "DELETE" }).catch(
        () => null
      );
      if (res?.ok) await db.credentials.delete(row.id);
    } else {
      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row),
      }).catch(() => null);
      if (res?.ok) await db.credentials.update(row.id, { pendingOp: undefined });
    }
  }
}

/** Pulls the full credential set from the server into the local cache. */
async function pullFromServer(): Promise<void> {
  const res = await fetch("/api/credentials");
  if (!res.ok) return;
  const rows = (await res.json()) as ServerCredential[];

  const localAll = await db.credentials.toArray();
  const pendingIds = new Set(localAll.filter((r) => r.pendingOp).map((r) => r.id));

  await db.credentials.bulkPut(rows.filter((r) => !pendingIds.has(r.id)));

  const serverIds = new Set(rows.map((r) => r.id));
  const localRows = await db.credentials.toArray();
  const staleIds = localRows
    .filter((r) => !serverIds.has(r.id) && !pendingIds.has(r.id))
    .map((r) => r.id);
  if (staleIds.length) await db.credentials.bulkDelete(staleIds);
}

/** Pushes queued offline changes, then refreshes the local cache from the server. */
export async function syncCredentials(): Promise<void> {
  if (!navigator.onLine) return;
  try {
    await flushPendingOps();
    await pullFromServer();
  } catch {
    // server unreachable mid-sync; local cache stays as the fallback
  }
}

export async function listCredentials(
  key: CryptoKey
): Promise<
  Array<{ id: string; site: string; payload: CredentialPayload; updatedAt: number; pending: boolean }>
> {
  const rows = await db.credentials.orderBy("site").toArray();
  return Promise.all(
    rows
      .filter((row) => row.pendingOp !== "delete")
      .map(async (row) => ({
        id: row.id,
        site: row.site,
        updatedAt: row.updatedAt,
        pending: row.pendingOp === "upsert",
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

  if (!navigator.onLine) {
    await db.credentials.put({ ...record, pendingOp: "upsert" });
    return;
  }

  const res = await fetch("/api/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  }).catch(() => null);

  await db.credentials.put(res?.ok ? record : { ...record, pendingOp: "upsert" });
}

export async function deleteCredential(id: string): Promise<void> {
  if (!navigator.onLine) {
    const existing = await db.credentials.get(id);
    if (existing) await db.credentials.put({ ...existing, pendingOp: "delete" });
    return;
  }

  const res = await fetch(`/api/credentials/${id}`, { method: "DELETE" }).catch(() => null);
  if (res?.ok) {
    await db.credentials.delete(id);
  } else {
    const existing = await db.credentials.get(id);
    if (existing) await db.credentials.put({ ...existing, pendingOp: "delete" });
  }
}

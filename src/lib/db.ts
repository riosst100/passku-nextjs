import Dexie, { type Table } from "dexie";
import type { Credential, VaultMeta } from "@/types";

class PasskuDB extends Dexie {
  vaultMeta!: Table<VaultMeta, string>;
  credentials!: Table<Credential, string>;

  constructor() {
    super("passku-db");
    this.version(1).stores({
      vaultMeta: "id",
      credentials: "id, site, updatedAt",
    });
  }
}

export const db = new PasskuDB();

/** Wipes the local offline cache (vault meta + credential ciphertext). Server data is untouched. */
export async function clearOfflineData(): Promise<void> {
  await db.vaultMeta.clear();
  await db.credentials.clear();
}

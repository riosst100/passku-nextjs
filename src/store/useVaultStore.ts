import { create } from "zustand";
import { db } from "@/lib/db";
import {
  deriveKeyFromPassword,
  deriveNewKey,
  decryptString,
  encryptString,
  VERIFIER_PLAINTEXT,
} from "@/lib/crypto";

interface VaultState {
  status: "checking" | "needs-setup" | "locked" | "unlocked";
  key: CryptoKey | null;
  error: string | null;
  init: () => Promise<void>;
  setupMasterPassword: (password: string) => Promise<void>;
  unlock: (password: string) => Promise<boolean>;
  lock: () => void;
}

export const useVaultStore = create<VaultState>((set) => ({
  status: "checking",
  key: null,
  error: null,

  init: async () => {
    const meta = await db.vaultMeta.get("vault-meta");
    set({ status: meta ? "locked" : "needs-setup" });
  },

  setupMasterPassword: async (password: string) => {
    const { key, saltB64 } = await deriveNewKey(password);
    const verifier = await encryptString(key, VERIFIER_PLAINTEXT);
    await db.vaultMeta.put({ id: "vault-meta", saltB64, verifier });
    set({ status: "unlocked", key, error: null });
  },

  unlock: async (password: string) => {
    const meta = await db.vaultMeta.get("vault-meta");
    if (!meta) {
      set({ error: "Vault belum di-setup." });
      return false;
    }
    try {
      const key = await deriveKeyFromPassword(password, meta.saltB64);
      const check = await decryptString(key, meta.verifier);
      if (check !== VERIFIER_PLAINTEXT) throw new Error("mismatch");
      set({ status: "unlocked", key, error: null });
      return true;
    } catch {
      set({ error: "Master password salah." });
      return false;
    }
  },

  lock: () => set({ status: "locked", key: null }),
}));

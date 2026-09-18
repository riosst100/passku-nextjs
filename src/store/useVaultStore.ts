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

async function fetchServerMeta(): Promise<{ saltB64: string; verifier: string } | null> {
  try {
    const res = await fetch("/api/vault-meta");
    if (!res.ok) return null;
    const body = await res.json();
    return body.exists ? { saltB64: body.saltB64, verifier: body.verifier } : null;
  } catch {
    return null;
  }
}

export const useVaultStore = create<VaultState>((set) => ({
  status: "checking",
  key: null,
  error: null,

  init: async () => {
    const serverMeta = await fetchServerMeta();
    if (serverMeta) {
      await db.vaultMeta.put({ id: "vault-meta", ...serverMeta });
      set({ status: "locked" });
      return;
    }

    // Offline fallback: no network, but a vault was set up on this device before.
    const localMeta = await db.vaultMeta.get("vault-meta");
    if (localMeta) {
      set({ status: "locked" });
      return;
    }

    if (!navigator.onLine) {
      set({ status: "locked", error: "Tidak ada koneksi. Sambungkan ke internet untuk setup pertama kali." });
      return;
    }

    set({ status: "needs-setup" });
  },

  setupMasterPassword: async (password: string) => {
    const { key, saltB64 } = await deriveNewKey(password);
    const verifier = await encryptString(key, VERIFIER_PLAINTEXT);

    const res = await fetch("/api/vault-meta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ saltB64, verifier }),
    });
    if (!res.ok) {
      set({ error: "Gagal setup vault di server. Coba lagi." });
      return;
    }

    await db.vaultMeta.put({ id: "vault-meta", saltB64, verifier });

    const authRes = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proof: VERIFIER_PLAINTEXT }),
    });
    if (!authRes.ok) {
      set({ error: "Setup berhasil tapi login otomatis gagal. Coba unlock manual." });
      set({ status: "locked" });
      return;
    }

    set({ status: "unlocked", key, error: null });
  },

  unlock: async (password: string) => {
    const meta = (await fetchServerMeta()) ?? (await db.vaultMeta.get("vault-meta"));
    if (!meta) {
      set({ error: "Vault belum di-setup." });
      return false;
    }

    try {
      const key = await deriveKeyFromPassword(password, meta.saltB64);
      const check = await decryptString(key, meta.verifier);
      if (check !== VERIFIER_PLAINTEXT) throw new Error("mismatch");

      await db.vaultMeta.put({ id: "vault-meta", saltB64: meta.saltB64, verifier: meta.verifier });

      if (navigator.onLine) {
        const authRes = await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ proof: VERIFIER_PLAINTEXT }),
        });
        if (!authRes.ok) {
          set({ error: "Gagal terhubung ke server." });
          return false;
        }
      }

      set({ status: "unlocked", key, error: null });
      return true;
    } catch {
      set({ error: "Master password salah." });
      return false;
    }
  },

  lock: () => {
    fetch("/api/auth", { method: "DELETE" }).catch(() => {});
    set({ status: "locked", key: null });
  },
}));

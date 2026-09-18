import { create } from "zustand";
import { db, clearOfflineData } from "@/lib/db";
import {
  deriveKeyFromPassword,
  deriveNewKey,
  deriveAuthSecret,
  decryptString,
  encryptString,
  VERIFIER_PLAINTEXT,
} from "@/lib/crypto";
import { persistSessionKey, restoreSessionKey, clearSessionKey } from "@/lib/sessionKey";
import { syncCredentials } from "@/lib/credentials";

interface VaultState {
  status: "checking" | "needs-setup" | "locked" | "unlocked";
  key: CryptoKey | null;
  error: string | null;
  syncing: boolean;
  init: () => Promise<void>;
  setupMasterPassword: (password: string) => Promise<void>;
  unlock: (password: string) => Promise<boolean>;
  lock: () => void;
  wipeOfflineData: () => Promise<void>;
}

interface ServerMeta {
  saltB64: string;
  verifier: string;
}

async function fetchServerMeta(): Promise<ServerMeta | null> {
  const res = await fetch("/api/vault-meta");
  if (!res.ok) throw new Error("server unreachable");
  const body = await res.json();
  return body.exists ? { saltB64: body.saltB64, verifier: body.verifier } : null;
}

async function authenticate(password: string, saltB64: string): Promise<boolean> {
  const authSecret = await deriveAuthSecret(password, saltB64);
  const res = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ authSecret }),
  });
  return res.ok;
}

export const useVaultStore = create<VaultState>((set) => ({
  status: "checking",
  key: null,
  error: null,
  syncing: false,

  init: async () => {
    const restoredKey = await restoreSessionKey();
    if (restoredKey) {
      set({ syncing: true });
      await syncCredentials();
      set({ status: "unlocked", key: restoredKey, error: null, syncing: false });
      return;
    }

    try {
      const serverMeta = await fetchServerMeta();
      if (serverMeta) {
        await db.vaultMeta.put({ id: "vault-meta", ...serverMeta });
        set({ status: "locked", error: null });
        return;
      }
      set({ status: "needs-setup", error: null });
      return;
    } catch {
      // Server unreachable: fall back to the local cache so the vault can
      // still be unlocked offline (view-only until back online).
    }

    const localMeta = await db.vaultMeta.get("vault-meta");
    if (localMeta) {
      set({
        status: "locked",
        error: "Offline: menampilkan data dari cache lokal. Sinkronisasi akan lanjut saat online.",
      });
      return;
    }

    set({
      status: "locked",
      error: "Tidak bisa terhubung ke server dan belum ada data lokal. Sambungkan ke internet.",
    });
  },

  setupMasterPassword: async (password: string) => {
    const { key, saltB64 } = await deriveNewKey(password);
    const verifier = await encryptString(key, VERIFIER_PLAINTEXT);
    const authSecret = await deriveAuthSecret(password, saltB64);

    const res = await fetch("/api/vault-meta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ saltB64, verifier, authSecret }),
    });
    if (!res.ok) {
      set({ error: "Gagal setup vault di server. Coba lagi." });
      return;
    }

    await db.vaultMeta.put({ id: "vault-meta", saltB64, verifier });

    const authed = await authenticate(password, saltB64);
    if (!authed) {
      set({ status: "locked", error: "Setup berhasil tapi login otomatis gagal. Coba unlock manual." });
      return;
    }

    await persistSessionKey(key);
    set({ syncing: true });
    await syncCredentials();
    set({ status: "unlocked", key, error: null, syncing: false });
  },

  unlock: async (password: string) => {
    let meta: ServerMeta | null = null;
    let online = true;
    try {
      meta = await fetchServerMeta();
    } catch {
      online = false;
      meta = (await db.vaultMeta.get("vault-meta")) ?? null;
    }

    if (!meta) {
      set({ error: "Vault belum di-setup." });
      return false;
    }

    try {
      const key = await deriveKeyFromPassword(password, meta.saltB64);
      const check = await decryptString(key, meta.verifier);
      if (check !== VERIFIER_PLAINTEXT) throw new Error("mismatch");

      await db.vaultMeta.put({ id: "vault-meta", saltB64: meta.saltB64, verifier: meta.verifier });

      if (online) {
        const authed = await authenticate(password, meta.saltB64);
        if (!authed) {
          set({ error: "Password cocok secara lokal tapi ditolak server. Coba lagi." });
          return false;
        }
      }

      await persistSessionKey(key);
      set({ syncing: true });
      await syncCredentials();
      set({ status: "unlocked", key, error: null, syncing: false });
      return true;
    } catch {
      set({ error: "Master password salah." });
      return false;
    }
  },

  lock: () => {
    fetch("/api/auth", { method: "DELETE" }).catch(() => {});
    clearSessionKey();
    set({ status: "locked", key: null });
  },

  wipeOfflineData: async () => {
    fetch("/api/auth", { method: "DELETE" }).catch(() => {});
    clearSessionKey();
    await clearOfflineData();
    set({ status: "checking", key: null, error: null });
    await useVaultStore.getState().init();
  },
}));

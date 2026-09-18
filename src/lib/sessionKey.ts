import { exportKeyToJwk, importKeyFromJwk } from "@/lib/crypto";

const STORAGE_KEY = "passku_session_key";
export const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

interface StoredSession {
  jwk: JsonWebKey;
  loadedAt: number;
}

/** Called on login and on every page load/refresh — resets the 5-minute clock. */
export async function persistSessionKey(key: CryptoKey): Promise<void> {
  const jwk = await exportKeyToJwk(key);
  const payload: StoredSession = { jwk, loadedAt: Date.now() };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export async function restoreSessionKey(): Promise<CryptoKey | null> {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const payload = JSON.parse(raw) as StoredSession;
    if (Date.now() - payload.loadedAt > IDLE_TIMEOUT_MS) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    // Reload counts as a fresh page load, so the 5-minute window restarts.
    const key = await importKeyFromJwk(payload.jwk);
    await persistSessionKey(key);
    return key;
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function clearSessionKey(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function getLoadedAt(): number | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as StoredSession).loadedAt;
  } catch {
    return null;
  }
}

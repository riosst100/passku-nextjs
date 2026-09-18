import { exportKeyToJwk, importKeyFromJwk } from "@/lib/crypto";

const STORAGE_KEY = "passku_session_key";
export const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

interface StoredSession {
  jwk: JsonWebKey;
  lastActive: number;
}

export async function persistSessionKey(key: CryptoKey): Promise<void> {
  const jwk = await exportKeyToJwk(key);
  const payload: StoredSession = { jwk, lastActive: Date.now() };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function touchSessionKey(): void {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const payload = JSON.parse(raw) as StoredSession;
    payload.lastActive = Date.now();
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}

export async function restoreSessionKey(): Promise<CryptoKey | null> {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const payload = JSON.parse(raw) as StoredSession;
    if (Date.now() - payload.lastActive > IDLE_TIMEOUT_MS) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return await importKeyFromJwk(payload.jwk);
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function clearSessionKey(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function getLastActive(): number | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as StoredSession).lastActive;
  } catch {
    return null;
  }
}

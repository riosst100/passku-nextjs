const KNOWN_SESSIONS_KEY = "passku_known_sessions";

function readKnown(): Set<string> {
  try {
    const raw = localStorage.getItem(KNOWN_SESSIONS_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function writeKnown(ids: Set<string>): void {
  try {
    localStorage.setItem(KNOWN_SESSIONS_KEY, JSON.stringify([...ids]));
  } catch {
    // localStorage unavailable; alerting will just re-trigger next load
  }
}

/**
 * Diffs the given session ids against the ones seen before on this device,
 * marks them all as seen, and returns the ids that are new (a fresh login
 * on another device). The current device's own session id is passed in
 * `currentId` so it's never reported as "new".
 */
export function detectNewSessions(sessionIds: string[], currentId: string | null): string[] {
  const known = readKnown();
  const isFirstLoad = known.size === 0;

  const fresh = sessionIds.filter((id) => id !== currentId && !known.has(id));

  writeKnown(new Set(sessionIds));

  // On the very first load there's nothing to compare against yet, so don't
  // flag every pre-existing session as "new".
  return isFirstLoad ? [] : fresh;
}

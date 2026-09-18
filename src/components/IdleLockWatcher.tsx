"use client";

import { useEffect, useState } from "react";
import { useVaultStore } from "@/store/useVaultStore";
import { touchSessionKey, getLastActive, IDLE_TIMEOUT_MS } from "@/lib/sessionKey";

const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll"] as const;

export function IdleLockWatcher() {
  const status = useVaultStore((s) => s.status);
  const lock = useVaultStore((s) => s.lock);
  const [remainingMs, setRemainingMs] = useState(IDLE_TIMEOUT_MS);

  useEffect(() => {
    if (status !== "unlocked") return;

    touchSessionKey();
    let timer = setTimeout(lock, IDLE_TIMEOUT_MS);

    const onActivity = () => {
      touchSessionKey();
      clearTimeout(timer);
      timer = setTimeout(lock, IDLE_TIMEOUT_MS);
    };

    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, onActivity));

    const tick = setInterval(() => {
      const lastActive = getLastActive();
      if (lastActive === null) return;
      setRemainingMs(Math.max(0, IDLE_TIMEOUT_MS - (Date.now() - lastActive)));
    }, 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(tick);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, onActivity));
    };
  }, [status, lock]);

  if (status !== "unlocked") return null;

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const isWarning = remainingMs <= 60_000;

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm ${
        isWarning
          ? "border-red-300 bg-red-50 text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
          : "border-neutral-200 bg-white text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400"
      }`}
    >
      Logout otomatis dalam {minutes}:{seconds.toString().padStart(2, "0")}
    </div>
  );
}

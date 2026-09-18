"use client";

import { useEffect } from "react";
import { useVaultStore } from "@/store/useVaultStore";
import { touchSessionKey, IDLE_TIMEOUT_MS } from "@/lib/sessionKey";

const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll"] as const;

export function IdleLockWatcher() {
  const status = useVaultStore((s) => s.status);
  const lock = useVaultStore((s) => s.lock);

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
    return () => {
      clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, onActivity));
    };
  }, [status, lock]);

  return null;
}

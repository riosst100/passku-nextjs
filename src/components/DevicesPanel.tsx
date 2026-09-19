"use client";

import { useEffect, useState } from "react";

interface SessionRow {
  id: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: number;
  lastSeenAt: number;
  revoked: boolean;
  current: boolean;
}

function formatDate(ts: number): string {
  return (
    new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Jakarta",
    }).format(ts) + " WIB"
  );
}

function parseDevice(ua: string | null): string {
  if (!ua) return "Tidak diketahui";
  if (/iphone/i.test(ua)) return "iPhone";
  if (/ipad/i.test(ua)) return "iPad";
  if (/android/i.test(ua)) return "Android";
  if (/windows/i.test(ua)) return "Windows";
  if (/macintosh|mac os/i.test(ua)) return "Mac";
  if (/linux/i.test(ua)) return "Linux";
  return "Perangkat lain";
}

function parseBrowser(ua: string | null): string {
  if (!ua) return "";
  if (/edg\//i.test(ua)) return "Edge";
  if (/chrome\//i.test(ua)) return "Chrome";
  if (/firefox\//i.test(ua)) return "Firefox";
  if (/safari\//i.test(ua) && !/chrome/i.test(ua)) return "Safari";
  return "";
}

function DeviceIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M10 18h4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function DevicesPanel({ onClose }: { onClose: () => void }) {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/sessions");
      if (!res.ok) throw new Error();
      setSessions((await res.json()) as SessionRow[]);
    } catch {
      setError("Gagal memuat daftar device.");
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load from server
    void load();
  }, []);

  const handleRevoke = async (id: string) => {
    if (!window.confirm("Blokir akses device ini? Device tersebut harus login ulang dengan master password.")) {
      return;
    }

    setRevokingId(id);
    try {
      const res = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      setError("Gagal memblokir device.");
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85dvh] w-full max-w-md animate-[fade-in-up_0.3s_ease-out] overflow-y-auto rounded-t-2xl border border-neutral-200 bg-white p-6 shadow-xl sm:animate-[scale-in_0.2s_ease-out] sm:rounded-2xl dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Devices & Sesi</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
          >
            <CloseIcon />
          </button>
        </div>

        {error && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950/50 dark:text-red-400">
            {error}
          </p>
        )}

        {sessions === null && !error && (
          <p className="py-8 text-center text-sm text-neutral-400">Memuat...</p>
        )}

        {sessions && sessions.length === 0 && (
          <p className="py-8 text-center text-sm text-neutral-400">Belum ada sesi login tercatat.</p>
        )}

        <ul className="space-y-2">
          {sessions?.map((s) => {
            const browser = parseBrowser(s.userAgent);
            return (
              <li
                key={s.id}
                className={`rounded-xl border p-3.5 ${
                  s.revoked
                    ? "border-neutral-200 bg-neutral-50 opacity-60 dark:border-neutral-800 dark:bg-neutral-900/50"
                    : "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-400">
                    <DeviceIcon />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {parseDevice(s.userAgent)}
                      {browser && <span className="text-neutral-400 dark:text-neutral-500">· {browser}</span>}
                      {s.current && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                          sesi ini
                        </span>
                      )}
                      {s.revoked && (
                        <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                          diblokir
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-neutral-500 dark:text-neutral-400">
                      IP: {s.ip ?? "tidak diketahui"}
                    </p>
                    <p className="truncate text-[11px] text-neutral-400 dark:text-neutral-500" title={s.userAgent ?? ""}>
                      {s.userAgent ?? "User agent tidak diketahui"}
                    </p>
                    <p className="mt-1 text-[11px] text-neutral-400 dark:text-neutral-500">
                      Login: {formatDate(s.createdAt)} · Aktif terakhir: {formatDate(s.lastSeenAt)}
                    </p>
                  </div>
                  {!s.revoked && !s.current && (
                    <button
                      onClick={() => handleRevoke(s.id)}
                      disabled={revokingId === s.id}
                      className="shrink-0 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40"
                    >
                      {revokingId === s.id ? "..." : "Blokir"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

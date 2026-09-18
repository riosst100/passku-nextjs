"use client";

import { useEffect, useState } from "react";
import { useVaultStore } from "@/store/useVaultStore";
import { listCredentials, saveCredential, deleteCredential, syncCredentials } from "@/lib/credentials";
import type { CredentialPayload } from "@/types";

interface Entry {
  id: string;
  site: string;
  payload: CredentialPayload;
  updatedAt: number;
  pending: boolean;
}

export function CredentialsView() {
  const { key, lock, wipeOfflineData } = useVaultStore();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [online, setOnline] = useState(true);

  const refresh = async () => {
    if (!key) return;
    setEntries(await listCredentials(key));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load from IndexedDB/server
    void refresh();
    setOnline(navigator.onLine);
    const onOnline = () => {
      setOnline(true);
      void syncCredentials().then(refresh);
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const filtered = entries.filter((e) =>
    e.site.toLowerCase().includes(query.toLowerCase())
  );

  const toggleReveal = (id: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDelete = async (id: string) => {
    await deleteCredential(id);
    await refresh();
  };

  const handleWipeOfflineData = async () => {
    const hasPending = entries.some((e) => e.pending);
    const warning = hasPending
      ? "Ada perubahan yang belum sinkron ke server dan akan HILANG. Hapus data offline di device ini? Data di server tidak terpengaruh."
      : "Hapus semua data offline (cache credentials & sesi) di browser ini? Kamu perlu login lagi dengan master password. Data di server tidak terpengaruh.";
    if (!window.confirm(warning)) return;
    await wipeOfflineData();
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            Passku
          </h1>
          <p className="text-xs text-neutral-500">
            {online ? "Online" : "Offline"} · {entries.length} credentials tersimpan
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleWipeOfflineData}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
          >
            Hapus data offline
          </button>
          <button
            onClick={lock}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Lock
          </button>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari site atau aplikasi..."
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-800"
        />
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
        >
          {showForm ? "Batal" : "+ Tambah"}
        </button>
      </div>

      {showForm && (
        <AddCredentialForm
          onSaved={async () => {
            setShowForm(false);
            await refresh();
          }}
        />
      )}

      <ul className="space-y-2">
        {filtered.map((entry) => (
          <li
            key={entry.id}
            className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {entry.site}
                  {entry.pending && (
                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-normal text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                      belum sinkron
                    </span>
                  )}
                </p>
                <p className="text-xs text-neutral-500">{entry.payload.username}</p>
                <p className="mt-1 font-mono text-xs text-neutral-700 dark:text-neutral-300">
                  {revealed.has(entry.id) ? entry.payload.password : "••••••••"}
                </p>
              </div>
              <div className="flex gap-2 text-xs">
                <button
                  onClick={() => toggleReveal(entry.id)}
                  className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
                >
                  {revealed.has(entry.id) ? "Sembunyikan" : "Lihat"}
                </button>
                <button
                  onClick={() => handleDelete(entry.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  Hapus
                </button>
              </div>
            </div>
          </li>
        ))}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-neutral-400">
            Belum ada credentials. Tambahkan yang pertama.
          </p>
        )}
      </ul>
    </div>
  );
}

function AddCredentialForm({ onSaved }: { onSaved: () => void }) {
  const { key } = useVaultStore();
  const [site, setSite] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key || !site || !username || !password) return;
    await saveCredential(key, site, { username, password, url, notes });
    onSaved();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-4 space-y-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"
    >
      <input
        value={site}
        onChange={(e) => setSite(e.target.value)}
        placeholder="Site / Aplikasi (mis. Gmail)"
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
        required
      />
      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Username / Email"
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
        required
      />
      <input
        type="text"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm font-mono dark:border-neutral-700 dark:bg-neutral-800"
        required
      />
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="URL (opsional)"
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
      />
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Catatan (opsional)"
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
      />
      <button
        type="submit"
        className="w-full rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
      >
        Simpan
      </button>
    </form>
  );
}

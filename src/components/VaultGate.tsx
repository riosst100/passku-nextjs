"use client";

import { useEffect, useState } from "react";
import { useVaultStore } from "@/store/useVaultStore";

export function VaultGate({ children }: { children: React.ReactNode }) {
  const { status, error, init, setupMasterPassword, unlock } = useVaultStore();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    init();
  }, [init]);

  if (status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-neutral-500">
        Memuat vault...
      </div>
    );
  }

  if (status === "unlocked") {
    return <>{children}</>;
  }

  const isSetup = status === "needs-setup";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isSetup) {
        if (password.length < 8) {
          useVaultStore.setState({ error: "Master password minimal 8 karakter." });
          return;
        }
        if (password !== confirm) {
          useVaultStore.setState({ error: "Konfirmasi password tidak cocok." });
          return;
        }
        await setupMasterPassword(password);
      } else {
        await unlock(password);
      }
    } finally {
      setSubmitting(false);
      setPassword("");
      setConfirm("");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-950">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
      >
        <h1 className="mb-1 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Passku
        </h1>
        <p className="mb-6 text-sm text-neutral-500">
          {isSetup
            ? "Buat master password untuk mengenkripsi vault kamu. Password ini tidak disimpan di mana pun — kalau lupa, data tidak bisa dipulihkan."
            : "Masukkan master password untuk membuka vault."}
        </p>

        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Master Password
        </label>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-800"
          required
        />

        {isSetup && (
          <>
            <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Konfirmasi Password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mb-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-800"
              required
            />
          </>
        )}

        {error && <p className="mb-3 text-xs text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {submitting ? "Memproses..." : isSetup ? "Buat Vault" : "Buka Vault"}
        </button>
      </form>
    </div>
  );
}

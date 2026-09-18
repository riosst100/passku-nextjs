const PBKDF2_ITERATIONS = 250_000;

function bufToBase64(buf: ArrayBufferLike): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function base64ToBuf(b64: string): ArrayBuffer {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer as ArrayBuffer;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

export async function deriveKeyFromPassword(
  password: string,
  saltB64: string
): Promise<CryptoKey> {
  const salt = new Uint8Array(base64ToBuf(saltB64));
  return deriveKey(password, salt);
}

export async function deriveNewKey(
  password: string
): Promise<{ key: CryptoKey; saltB64: string }> {
  const salt = generateSalt();
  const key = await deriveKey(password, salt);
  return { key, saltB64: bufToBase64(salt.buffer) };
}

export async function encryptString(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    new TextEncoder().encode(plaintext)
  );
  return `${bufToBase64(iv.buffer)}.${bufToBase64(ciphertext)}`;
}

export async function decryptString(key: CryptoKey, payload: string): Promise<string> {
  const [ivB64, ctB64] = payload.split(".");
  const iv = new Uint8Array(base64ToBuf(ivB64));
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    base64ToBuf(ctB64)
  );
  return new TextDecoder().decode(plaintext);
}

export const VERIFIER_PLAINTEXT = "passku-verifier";

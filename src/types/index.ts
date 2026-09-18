export interface VaultMeta {
  id: "vault-meta";
  saltB64: string;
  verifier: string;
}

export interface Credential {
  id: string;
  site: string;
  /** encrypted JSON: { username, password, notes, url } */
  data: string;
  createdAt: number;
  updatedAt: number;
  /** set when a local change hasn't been pushed to the server yet */
  pendingOp?: "upsert" | "delete";
}

export interface CredentialPayload {
  username: string;
  password: string;
  phone?: string;
  url?: string;
  notes?: string;
}

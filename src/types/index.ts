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
}

export interface CredentialPayload {
  username: string;
  password: string;
  url?: string;
  notes?: string;
}

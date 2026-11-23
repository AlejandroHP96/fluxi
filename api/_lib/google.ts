import { createSign } from "node:crypto"

// Acceso a las APIs de Google (Firestore y Sheets) con la cuenta de servicio de Firebase, sin SDK:
// un JWT firmado con su clave privada se cambia por un token OAuth

export interface ServiceAccount {
  project_id: string
  client_email: string
  private_key: string
}

export function serviceAccount(): ServiceAccount {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) throw new Error("Falta FIREBASE_SERVICE_ACCOUNT")
  const sa = JSON.parse(raw) as ServiceAccount
  if (!sa.project_id || !sa.client_email || !sa.private_key) throw new Error("FIREBASE_SERVICE_ACCOUNT no es una clave de cuenta de servicio")
  return { ...sa, private_key: sa.private_key.replace(/\\n/g, "\n") }
}

const b64url = (s: string | Buffer) => Buffer.from(s).toString("base64url")

export async function accessToken(sa: ServiceAccount, scopes: string[]): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const claims = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: scopes.join(" "),
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }))
  const signer = createSign("RSA-SHA256")
  signer.update(`${header}.${claims}`)
  const jwt = `${header}.${claims}.${signer.sign(sa.private_key).toString("base64url")}`
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  })
  const d = (await r.json()) as { access_token?: string; error_description?: string; error?: string }
  if (!r.ok || !d.access_token) throw new Error(`Token de Google: ${d.error_description || d.error || r.status}`)
  return d.access_token
}

export async function gfetch<T>(token: string, url: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const r = await fetch(url, {
    method: init.method || "GET",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  const text = await r.text()
  if (!r.ok) throw new Error(`${r.status} ${url.split("?")[0]}: ${text.slice(0, 300)}`)
  return (text ? JSON.parse(text) : {}) as T
}

// ── Firestore (REST): valores tipados -> JSON normal ──
type FsValue = {
  stringValue?: string
  integerValue?: string
  doubleValue?: number
  booleanValue?: boolean
  nullValue?: null
  timestampValue?: string
  mapValue?: { fields?: Record<string, FsValue> }
  arrayValue?: { values?: FsValue[] }
}

export function fromFirestore(v: FsValue): unknown {
  if ("stringValue" in v) return v.stringValue
  if ("integerValue" in v) return Number(v.integerValue)
  if ("doubleValue" in v) return v.doubleValue
  if ("booleanValue" in v) return v.booleanValue
  if ("timestampValue" in v) return v.timestampValue
  if ("mapValue" in v) return fromFields(v.mapValue?.fields)
  if ("arrayValue" in v) return (v.arrayValue?.values ?? []).map(fromFirestore)
  return null
}

export const fromFields = (fields: Record<string, FsValue> | undefined): Record<string, unknown> =>
  Object.fromEntries(Object.entries(fields ?? {}).map(([k, v]) => [k, fromFirestore(v)]))

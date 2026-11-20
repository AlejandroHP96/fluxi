import { createSign } from "node:crypto"
import { SAVINGS_TRANSFER } from "../../src/utils/savingsTransfer.js"

// API de Enable Banking (open banking PSD2). Docs: https://enablebanking.com/docs/api/reference/
// Cada petición lleva un JWT RS256 firmado con la clave privada de la aplicación (nunca sale del servidor).
const BASE = "https://api.enablebanking.com"

const b64url = (s: string | Buffer) => Buffer.from(s).toString("base64url")

export function makeJwt(appId: string, privateKeyPem: string, now = Math.floor(Date.now() / 1000)): string {
  const header = b64url(JSON.stringify({ typ: "JWT", alg: "RS256", kid: appId }))
  const payload = b64url(JSON.stringify({ iss: "enablebanking.com", aud: "api.enablebanking.com", iat: now, exp: now + 3600 }))
  const signer = createSign("RSA-SHA256")
  signer.update(`${header}.${payload}`)
  return `${header}.${payload}.${signer.sign(privateKeyPem).toString("base64url")}`
}

export interface EbConfig {
  appId: string
  privateKey: string
  redirectUrl: string
  aspspName: string
  aspspCountry: string
}

// Variables de entorno de Vercel. La clave puede venir con saltos de línea escapados ("\n")
export function ebConfig(): EbConfig | null {
  const { ENABLE_BANKING_APP_ID, ENABLE_BANKING_PRIVATE_KEY, ENABLE_BANKING_REDIRECT_URL } = process.env
  if (!ENABLE_BANKING_APP_ID || !ENABLE_BANKING_PRIVATE_KEY || !ENABLE_BANKING_REDIRECT_URL) return null
  return {
    appId: ENABLE_BANKING_APP_ID,
    privateKey: ENABLE_BANKING_PRIVATE_KEY.replace(/\\n/g, "\n"),
    redirectUrl: ENABLE_BANKING_REDIRECT_URL,
    aspspName: process.env.ENABLE_BANKING_ASPSP_NAME || "Revolut",
    aspspCountry: process.env.ENABLE_BANKING_ASPSP_COUNTRY || "LT",
  }
}

// Cabeceras PSU: indican que el usuario está delante y evitan el límite de ~4 consultas al día del banco
export type PsuHeaders = Record<string, string>

export async function ebFetch<T>(cfg: EbConfig, path: string, init: { method?: string; body?: unknown; psu?: PsuHeaders } = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    method: init.method || "GET",
    headers: {
      Authorization: `Bearer ${makeJwt(cfg.appId, cfg.privateKey)}`,
      "Content-Type": "application/json",
      ...(init.psu || {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : {}
  if (!res.ok) throw new Error(`Enable Banking ${res.status}: ${data.message || data.error || text.slice(0, 200)}`)
  return data as T
}

interface Aspsp {
  name: string
  country: string
  maximum_consent_validity?: number // segundos
}

// Inicia la autorización: devuelve la URL del banco a la que hay que mandar al usuario
export async function startAuth(cfg: EbConfig, state: string, psu: PsuHeaders): Promise<string> {
  const { aspsps } = await ebFetch<{ aspsps: Aspsp[] }>(cfg, `/aspsps?country=${encodeURIComponent(cfg.aspspCountry)}`, { psu })
  const aspsp = aspsps.find((a) => a.name.toLowerCase() === cfg.aspspName.toLowerCase())
  if (!aspsp) throw new Error(`El banco «${cfg.aspspName}» no está disponible en ${cfg.aspspCountry}`)
  // El máximo que admita el banco, sin pasar de 180 días
  const seconds = Math.min(aspsp.maximum_consent_validity || 90 * 86400, 180 * 86400)
  const validUntil = new Date(Date.now() + (seconds - 3600) * 1000).toISOString()
  const r = await ebFetch<{ url: string }>(cfg, "/auth", {
    method: "POST",
    psu,
    body: {
      access: { valid_until: validUntil },
      aspsp: { name: aspsp.name, country: aspsp.country },
      state,
      redirect_url: cfg.redirectUrl,
      psu_type: "personal",
    },
  })
  return r.url
}

export interface BankAccount {
  uid: string
  name: string
  iban: string
  currency: string
}

export interface BankSession {
  sessionId: string
  validUntil: string // ISO
  bankName: string
  accounts: BankAccount[]
}

interface EbAccount {
  uid: string
  name?: string
  product?: string
  currency?: string
  account_id?: { iban?: string; other?: { identification?: string } }
}

// Al volver del banco: cambia el code por una sesión con sus cuentas
export async function createSession(cfg: EbConfig, code: string, psu: PsuHeaders): Promise<BankSession> {
  const r = await ebFetch<{ session_id: string; accounts: EbAccount[]; access?: { valid_until?: string } }>(cfg, "/sessions", {
    method: "POST",
    psu,
    body: { code },
  })
  return {
    sessionId: r.session_id,
    validUntil: r.access?.valid_until || "",
    bankName: cfg.aspspName,
    accounts: (r.accounts || []).map((a) => ({
      uid: a.uid,
      name: a.name || a.product || "Cuenta",
      iban: a.account_id?.iban || a.account_id?.other?.identification || "",
      currency: a.currency || "EUR",
    })),
  }
}

export interface EbTransaction {
  entry_reference?: string
  transaction_id?: string
  transaction_amount: { amount: string; currency: string }
  credit_debit_indicator?: "DBIT" | "CRDT"
  status?: string // BOOK, PDNG...
  booking_date?: string
  value_date?: string
  transaction_date?: string
  creditor?: { name?: string }
  remittance_information?: string[]
}

export interface BankExpense {
  date: string // YYYY-MM-DD
  time: string // siempre "" (la API no da hora)
  concept: string
  amount: number // positivo
}

// Solo cargos ya contabilizados en euros, con el mismo formato que las filas del CSV de Revolut
export function toExpenses(txs: EbTransaction[]): BankExpense[] {
  const out: BankExpense[] = []
  for (const t of txs) {
    if (t.status && t.status !== "BOOK") continue
    if (t.credit_debit_indicator !== "DBIT") continue
    if (t.transaction_amount?.currency && t.transaction_amount.currency !== "EUR") continue
    const amount = Math.abs(Number(t.transaction_amount?.amount))
    const date = (t.booking_date || t.value_date || t.transaction_date || "").slice(0, 10)
    if (!(amount > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    const remittance = (t.remittance_information || []).join(" ").replace(/\s+/g, " ").trim()
    const concept = (t.creditor?.name || remittance || "Gasto").replace(/\s+/g, " ").trim()
    // Traspasos a Ahorros o bolsillos (el texto puede venir en el nombre o en el concepto): no son gastos
    if (SAVINGS_TRANSFER.test(concept) || SAVINGS_TRANSFER.test(remittance)) continue
    out.push({ date, time: "", concept: concept.slice(0, 200), amount: Math.round(amount * 100) / 100 })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

// Cuentas que de verdad pertenecen a la sesión (y que sigue autorizada): no se confía en lo que mande el cliente
export async function sessionAccounts(cfg: EbConfig, sessionId: string, psu: PsuHeaders): Promise<string[]> {
  const s = await ebFetch<{ status?: string; accounts?: Array<string | { uid: string }> }>(
    cfg,
    `/sessions/${encodeURIComponent(sessionId)}`,
    { psu }
  )
  if (s.status && s.status !== "AUTHORIZED") throw new Error("La conexión con el banco caducó: vuelve a conectarlo")
  return (s.accounts || []).map((a) => (typeof a === "string" ? a : a.uid))
}

export const deleteSession = (cfg: EbConfig, sessionId: string) =>
  ebFetch(cfg, `/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" })

// Movimientos de una cuenta desde dateFrom, siguiendo la paginación
export async function fetchTransactions(cfg: EbConfig, accountUid: string, dateFrom: string, psu: PsuHeaders): Promise<EbTransaction[]> {
  const all: EbTransaction[] = []
  let key: string | undefined
  for (let page = 0; page < 50; page++) {
    const q = new URLSearchParams({ date_from: dateFrom })
    if (key) q.set("continuation_key", key)
    const r = await ebFetch<{ transactions: EbTransaction[]; continuation_key?: string }>(
      cfg,
      `/accounts/${encodeURIComponent(accountUid)}/transactions?${q}`,
      { psu }
    )
    all.push(...(r.transactions || []))
    key = r.continuation_key || undefined
    if (!key) return all
  }
  throw new Error("Demasiados movimientos: elige una fecha de inicio más reciente")
}

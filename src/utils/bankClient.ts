import { auth } from "../lib/firebase"
import type { CsvExpense } from "./revolutCsv"

// Conexión con el banco vía api/bank (Enable Banking). Solo responde a la cuenta dueña (FLUXI_OWNER_UID).

export interface BankAccount {
  uid: string
  name: string
  iban: string
  currency: string
}

// Se guarda en budgets/{uid}.bank. El sessionId no sirve sin la clave privada, que solo está en el servidor
export interface BankSession {
  sessionId: string
  validUntil: string // ISO
  bankName: string
  accounts: BankAccount[]
}

const STATE_KEY = "fluxi_bank_state"

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const idToken = await auth.currentUser?.getIdToken()
  if (!idToken) throw new Error("Inicia sesión para conectar el banco")
  const res = await fetch("/api/bank", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `El banco respondió ${res.status}`)
  return data as T
}

export const bankSessionValid = (s: BankSession | null | undefined): s is BankSession =>
  !!s && !!s.sessionId && (!s.validUntil || Date.parse(s.validUntil) > Date.now())

// Manda al usuario a la web de su banco para autorizar. Vuelve a la app con ?code=...&state=...
export async function startBankConnection(): Promise<void> {
  const state = crypto.randomUUID()
  sessionStorage.setItem(STATE_KEY, state)
  const { url } = await call<{ url: string }>({ action: "auth", state })
  window.location.assign(url)
}

// Si la URL trae la vuelta del banco, devuelve el code (comprobando el state) y limpia la URL
export function takeBankRedirect(): { code: string } | { error: string } | null {
  const params = new URLSearchParams(window.location.search)
  const code = params.get("code")
  const state = params.get("state")
  const error = params.get("error")
  if (!code && !error) return null
  const expected = sessionStorage.getItem(STATE_KEY)
  sessionStorage.removeItem(STATE_KEY)
  window.history.replaceState(null, "", window.location.pathname)
  if (error) return { error: params.get("error_description") || error }
  if (!state || state !== expected) return { error: "La respuesta del banco no coincide con la conexión iniciada. Inténtalo de nuevo." }
  return { code: code! }
}

export const finishBankConnection = (code: string) => call<BankSession>({ action: "session", code })

// Revoca la sesión en el banco (si ya caducó o no existe, da igual: se desconecta igualmente)
export const disconnectBank = (session: BankSession) =>
  call({ action: "disconnect", sessionId: session.sessionId }).catch(() => undefined)

// Gastos de las cuentas elegidas (uids de la sesión) desde dateFrom ("AAAA-MM-DD"), con el formato del CSV de Revolut
export async function fetchBankExpenses(session: BankSession, accountUids: string[], dateFrom: string): Promise<CsvExpense[]> {
  const { items } = await call<{ items: CsvExpense[] }>({
    action: "transactions",
    sessionId: session.sessionId,
    accountUids,
    dateFrom,
  })
  return items
}

// Cuentas de las que se traen movimientos: se recuerda en este dispositivo (por defecto, todas)
const ACCOUNTS_KEY = "fluxi_bank_accounts"

export function loadSelectedAccounts(session: BankSession): string[] {
  const all = session.accounts.map((a) => a.uid)
  try {
    const saved = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "null") as string[] | null
    const valid = Array.isArray(saved) ? saved.filter((uid) => all.includes(uid)) : []
    return valid.length ? valid : all
  } catch {
    return all
  }
}

export function saveSelectedAccounts(uids: string[]) {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(uids))
  } catch {
    // sin almacenamiento (modo privado): solo vale para esta vez
  }
}

// "ES12 3456 7890 1234" -> "•••• 1234"
export const maskIban = (iban: string) => (iban ? `•••• ${iban.replace(/\s+/g, "").slice(-4)}` : "")

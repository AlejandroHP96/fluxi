import type { Account, Goal, Transaction, Transfer, TransferKind } from "../types"

// ── Traspasos con tus otras cuentas ────────────────────────────────────────

const normalizeName = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim()

// "Transferencia de X", "Transferencia a X", "To X", "From X" con X en tus nombres
export function isOwnTransfer(description: string, ownNames: string[]): boolean {
  if (ownNames.length === 0) return false
  const m = normalizeName(description).match(/^(?:TRANSFERENCIA (?:DE|A)|TO|FROM) (.+)$/)
  if (!m) return false
  return ownNames.some((n) => normalizeName(n) === m[1])
}

export const ownTransferKind = (amount: number): TransferKind => (amount > 0 ? "own_in" : "own_out")

// ── Duplicados al importar ─────────────────────────────────────────────────

// Revolut no da ID por movimiento: se identifica por fecha (minuto) + importe absoluto.
// El importe va en absoluto porque al editar se puede cambiar el tipo (y con él el signo).
export const dedupeKey = (date: string, amount: number) =>
  `${String(date).slice(0, 16)}|${Math.abs(Number(amount)).toFixed(2)}`

interface Dated {
  date: string
  amount: number
}

const DAY_MS = 24 * 60 * 60 * 1000
const dayOf = (date: string) => Date.parse(`${String(date).slice(0, 10)}T00:00:00Z`)

// Devuelve los elementos de `incoming` que no están ya en `existing`, uno a uno (si hay 2 movimientos
// iguales guardados y el CSV trae 3, solo entra 1).
// 1ª pasada: misma fecha y hora + importe. 2ª pasada, para lo que quede: mismo importe a ±3 días
// (movimientos importados con la fecha de finalización en vez de la de inicio, o metidos a mano sin hora).
export function filterNew<T extends Dated>(incoming: T[], existing: Dated[], maxDays = 3): T[] {
  const exact = new Map<string, number>()
  for (const e of existing) exact.set(dedupeKey(e.date, e.amount), (exact.get(dedupeKey(e.date, e.amount)) || 0) + 1)

  const unmatchedIn: T[] = []
  for (const item of incoming) {
    const k = dedupeKey(item.date, item.amount)
    const left = exact.get(k) || 0
    if (left > 0) exact.set(k, left - 1)
    else unmatchedIn.push(item)
  }

  // Sobrantes de `existing` agrupados por importe, para la 2ª pasada
  const leftovers = new Map<string, number[]>()
  const used = new Map(exact)
  for (const e of existing) {
    const k = dedupeKey(e.date, e.amount)
    if ((used.get(k) || 0) <= 0) continue
    used.set(k, (used.get(k) || 0) - 1)
    const amt = Math.abs(Number(e.amount)).toFixed(2)
    leftovers.set(amt, [...(leftovers.get(amt) || []), dayOf(e.date)])
  }

  return unmatchedIn.filter((item) => {
    const days = leftovers.get(Math.abs(Number(item.amount)).toFixed(2))
    if (!days?.length) return true
    const d = dayOf(item.date)
    let best = -1
    days.forEach((day, i) => {
      if (Math.abs(day - d) <= maxDays * DAY_MS && (best === -1 || Math.abs(day - d) < Math.abs(days[best] - d))) best = i
    })
    if (best === -1) return true
    days.splice(best, 1)
    return false
  })
}

// ── Resúmenes para la pantalla de Finanzas ─────────────────────────────────

export interface TransferMonth {
  month: string // "YYYY-MM"
  savingsIn: number // aportado a Ahorros (positivo)
  savingsOut: number // retirado de Ahorros (positivo)
  interest: number // intereses (positivo)
  ownIn: number // recibido de tus otras cuentas (positivo)
  ownOut: number // enviado a tus otras cuentas (positivo)
}

// Meses ordenados del más reciente al más antiguo
export function summarizeTransfersByMonth(transfers: Transfer[]): TransferMonth[] {
  const map = new Map<string, TransferMonth>()
  for (const t of transfers) {
    const month = t.date.slice(0, 7)
    const m = map.get(month) || { month, savingsIn: 0, savingsOut: 0, interest: 0, ownIn: 0, ownOut: 0 }
    const v = Math.abs(Number(t.amount))
    if (t.kind === "savings_in") m.savingsIn += v
    if (t.kind === "savings_out") m.savingsOut += v
    if (t.kind === "interest") m.interest += v
    if (t.kind === "own_in") m.ownIn += v
    if (t.kind === "own_out") m.ownOut += v
    map.set(month, m)
  }
  return [...map.values()].sort((a, b) => b.month.localeCompare(a.month))
}

// Gasto del mes por categoría ("YYYY-MM"); solo gastos
export function spentByCategory(transactions: Transaction[], month: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const t of transactions) {
    if (t.type !== "expense" || !t.date.startsWith(month)) continue
    out[t.category] = (out[t.category] || 0) + Math.abs(Number(t.amount))
  }
  return out
}

export interface GoalProgress {
  current: number // saldo actual de la cuenta vinculada
  pct: number // 0-100 (puede pasar de 100 si ya se superó)
  remaining: number // lo que falta (0 si ya se alcanzó)
  monthlyNeeded: number | null // al mes hasta la fecha límite; null si no hay fecha o ya pasó
}

export function goalProgress(goal: Goal, accounts: Account[], today = new Date()): GoalProgress {
  const current = accounts.find((a) => a.id === goal.accountId)?.balance ?? 0
  const remaining = Math.max(0, goal.target - current)
  const pct = goal.target > 0 ? (current / goal.target) * 100 : 0
  let monthlyNeeded: number | null = null
  if (goal.deadline) {
    const [y, m] = goal.deadline.split("-").map(Number)
    const months = (y - today.getFullYear()) * 12 + (m - (today.getMonth() + 1))
    if (months > 0) monthlyNeeded = remaining / months
    else if (months === 0) monthlyNeeded = remaining
  }
  return { current, pct, remaining, monthlyNeeded }
}

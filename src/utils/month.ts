import type { BudgetCategory, EnvelopeSummary, Expense, MonthStatus, MonthSummary } from "../types/budget"

const pad = (n: number) => String(n).padStart(2, "0")

// Fechas en hora local (no UTC), para que un gasto de las 00:30 no caiga en el día anterior
export const toDateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const toMonthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
export const todayKey = () => toDateKey(new Date())
export const currentMonthKey = () => toMonthKey(new Date())

export const shiftMonth = (month: string, delta: number) => {
  const [y, m] = month.split("-").map(Number)
  return toMonthKey(new Date(y, m - 1 + delta, 1))
}

export const daysInMonth = (month: string) => {
  const [y, m] = month.split("-").map(Number)
  return new Date(y, m, 0).getDate()
}

// "noviembre de 2026"
export const monthLabel = (month: string) => {
  const [y, m] = month.split("-").map(Number)
  return new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1))
}

// Última nómina apuntada antes de `month` (para proponerla al apuntar la del mes)
export function lastIncomeBefore(income: Record<string, number>, month: string): number | null {
  const keys = Object.keys(income).filter((k) => k < month).sort()
  return keys.length ? income[keys[keys.length - 1]] : null
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase()

// Categoría de un gasto: por id; los gastos antiguos guardaban el nombre, así que también por nombre
export function resolveCategory(value: string, categories: BudgetCategory[]): BudgetCategory | null {
  return categories.find((c) => c.id === value) ?? categories.find((c) => norm(c.name) === norm(value)) ?? null
}

export const newCategoryId = () => Math.random().toString(36).slice(2, 10)

// Avisos: "casi" desde el 90 % del sobre; ritmo del mes en cuanto se pasa la marca de la barra
const NEAR_PCT = 90

export function summarizeMonth(
  expenses: Expense[],
  month: string,
  income: number | null,
  categories: BudgetCategory[],
  today = new Date()
): MonthSummary {
  const inMonth = expenses.filter((e) => e.date.startsWith(month))
  const total = daysInMonth(month)
  const current = toMonthKey(today)
  const isCurrent = month === current
  const isPast = month < current
  const pctElapsed = isPast ? 100 : isCurrent ? (today.getDate() / total) * 100 : 0
  const daysLeft = isCurrent ? total - today.getDate() + 1 : isPast ? 0 : total

  const spentBy = new Map<string, number>()
  let uncategorized = 0
  for (const e of inMonth) {
    const cat = resolveCategory(e.category, categories)
    if (cat) spentBy.set(cat.id, (spentBy.get(cat.id) || 0) + Number(e.amount))
    else uncategorized += Number(e.amount)
  }

  const base = income ?? 0
  const envelope = (c: BudgetCategory): EnvelopeSummary => {
    const allocated = (base * c.pct) / 100
    const spent = spentBy.get(c.id) || 0
    const pctSpent = allocated > 0 ? (spent / allocated) * 100 : spent > 0 ? 100 : 0
    const status = spent > allocated + 0.005 ? "pasado" : pctSpent >= NEAR_PCT ? "casi" : "ok"
    return { category: c, allocated, spent, remaining: allocated - spent, pctSpent, status }
  }

  const totalPct = categories.reduce((a, c) => a + Number(c.pct), 0)
  const unassignedPct = Math.max(0, 100 - totalPct)
  const savings = categories.filter((c) => c.savings).map(envelope)
  const envelopes = categories.filter((c) => !c.savings).map(envelope)
  const saved = savings.reduce((a, s) => a + s.allocated, 0)
  const spent = inMonth.reduce((a, e) => a + Number(e.amount), 0)
  const spendable = base - saved
  const available = spendable - spent
  const pctSpent = spendable > 0 ? (spent / spendable) * 100 : 0

  let status: MonthStatus = "sin-nomina"
  if (income !== null) {
    if (spent > spendable + 0.005) status = "pasado"
    else if (isCurrent && pctSpent > pctElapsed) status = "ritmo-alto"
    else status = "bien"
  }

  return {
    month, income, totalPct, unassignedPct, unassigned: (base * unassignedPct) / 100, saved, spendable, spent, available,
    pctSpent, pctElapsed, status, daysInMonth: total, daysLeft,
    dailyAllowance: isCurrent && income !== null && daysLeft > 0 ? Math.max(0, available) / daysLeft : null,
    isCurrent, isPast, envelopes, savings, uncategorized, count: inMonth.length,
  }
}

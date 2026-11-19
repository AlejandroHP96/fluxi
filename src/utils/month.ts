import type { BudgetHistory, Expense, MonthStatus, MonthSummary } from "../types/budget"

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

// Presupuesto vigente en un mes: el último fijado en ese mes o antes
export function budgetFor(history: BudgetHistory, month: string): number | null {
  const keys = Object.keys(history).filter((k) => k <= month).sort()
  return keys.length ? history[keys[keys.length - 1]] : null
}

// Margen (puntos %) sobre el ritmo esperado antes de avisar. 0 = en cuanto se pasa la marca de la barra,
// para que el mensaje coincida con lo que se ve
const PACE_MARGIN = 0

export function summarizeMonth(expenses: Expense[], month: string, budget: number | null, today = new Date()): MonthSummary {
  const inMonth = expenses.filter((e) => e.date.startsWith(month))
  const spent = inMonth.reduce((a, e) => a + Number(e.amount), 0)
  const total = daysInMonth(month)
  const current = toMonthKey(today)
  const isCurrent = month === current
  const isPast = month < current

  const pctElapsed = isPast ? 100 : isCurrent ? (today.getDate() / total) * 100 : 0
  const daysLeft = isCurrent ? total - today.getDate() + 1 : isPast ? 0 : total
  const pctSpent = budget && budget > 0 ? (spent / budget) * 100 : 0
  const remaining = budget !== null ? budget - spent : 0

  let status: MonthStatus = "sin-presupuesto"
  if (budget !== null) {
    if (spent > budget) status = "pasado"
    else if (isCurrent && pctSpent > pctElapsed + PACE_MARGIN) status = "ritmo-alto"
    else status = "bien"
  }

  const dailyAllowance = isCurrent && budget !== null && daysLeft > 0 ? Math.max(0, remaining) / daysLeft : null

  const byCat = new Map<string, number>()
  for (const e of inMonth) byCat.set(e.category, (byCat.get(e.category) || 0) + Number(e.amount))
  const byCategory = [...byCat.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount)

  return {
    month, budget, spent, remaining, pctSpent, pctElapsed, status, daysInMonth: total, daysLeft,
    dailyAllowance, isCurrent, isPast, byCategory, count: inMonth.length,
  }
}

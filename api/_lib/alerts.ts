import type { BudgetCategory, Carry, Expense, FixedExpense } from "../../src/types/budget.js"
import { summarizeMonth, toMonthKey } from "../../src/utils/month.js"

export const ALERT_PCT = 80

export interface AlertBudget {
  categories?: BudgetCategory[]
  fixedExpenses?: FixedExpense[]
  income?: Record<string, number>
  carry?: Carry
  alerts?: Record<string, string[]> // mes -> sobres ya avisados
}

export interface Alert {
  categoryId: string
  name: string
  pct: number
  remaining: number
}

// Sobres del mes en curso que han llegado al 80 % y de los que aún no se ha avisado (un aviso por sobre y mes)
export function pendingAlerts(month: string, expenses: Expense[], budget: AlertBudget, today = new Date()): Alert[] {
  if (month !== toMonthKey(today)) return []
  const income = budget.income?.[month]
  if (income === undefined) return []
  const s = summarizeMonth(expenses, month, income, budget.categories ?? [], budget.fixedExpenses ?? [], today, budget.carry ?? {})
  const done = new Set(budget.alerts?.[month] ?? [])
  return s.envelopes
    .filter((e) => e.allocated > 0.005 && e.pctSpent >= ALERT_PCT && !done.has(e.category.id))
    .map((e) => ({ categoryId: e.category.id, name: e.category.name, pct: Math.round(e.pctSpent), remaining: Math.round(e.remaining * 100) / 100 }))
}

const eur = (n: number) => `${n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

export function alertMessage(a: Alert): { title: string; body: string } {
  return a.remaining < 0
    ? { title: `${a.name}: te has pasado`, body: `Llevas el ${a.pct} % del sobre (${eur(-a.remaining)} por encima).` }
    : { title: `${a.name} al ${a.pct} %`, body: `Quedan ${eur(a.remaining)} en el sobre este mes.` }
}

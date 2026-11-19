// Fluxi simple: gastos a mano y un presupuesto fijo al mes

export interface Expense {
  id: string
  userId: string
  amount: number // positivo, en €
  concept: string
  category: string // una de CATEGORIES (src/constants/categories.ts)
  date: string // "YYYY-MM-DD"
}

export type NewExpense = Pick<Expense, "amount" | "concept" | "category" | "date">

// Documento budgets/{uid}: el presupuesto vale desde el mes en que se fija hasta el siguiente cambio.
// { "2026-11": 1200, "2027-02": 1300 } -> nov 2026 a ene 2027 = 1200 €, desde feb 2027 = 1300 €
export type BudgetHistory = Record<string, number> // "YYYY-MM" -> €

export type MonthStatus = "sin-presupuesto" | "bien" | "ritmo-alto" | "pasado"

export interface MonthSummary {
  month: string // "YYYY-MM"
  budget: number | null
  spent: number
  remaining: number // puede ser negativo si te pasas (0 si no hay presupuesto)
  pctSpent: number // gastado / presupuesto * 100 (0 si no hay presupuesto)
  pctElapsed: number // % del mes transcurrido (100 en meses pasados, 0 en futuros)
  status: MonthStatus
  daysInMonth: number
  daysLeft: number // días que quedan contando hoy (0 en meses pasados)
  dailyAllowance: number | null // lo que puedes gastar al día hasta fin de mes (solo mes actual con presupuesto)
  isCurrent: boolean
  isPast: boolean
  byCategory: Array<{ category: string; amount: number }> // de mayor a menor
  count: number
}

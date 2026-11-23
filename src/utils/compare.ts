import { netAmount, type BudgetCategory, type Expense } from "../types/budget.js"
import { daysInMonth, resolveCategory, shiftMonth, toMonthKey } from "./month.js"

export interface CategoryTrend {
  category: BudgetCategory
  spent: number // este mes (en el mes actual, hasta hoy)
  average: number // media de los meses anteriores (hasta el mismo día si es el mes actual)
  diffPct: number | null // (spent − average) / average · 100; null si la media es 0
}

export interface MonthComparison {
  months: number // meses anteriores con gastos que entran en la media (0 = no hay con qué comparar)
  upToDay: number | null // mes actual: se compara hasta este día de cada mes
  total: { spent: number; average: number; diffPct: number | null }
  rows: CategoryTrend[] // sobres de gasto, en el orden del reparto
}

const diff = (spent: number, average: number) => (average > 0.005 ? ((spent - average) / average) * 100 : null)

// Gasto de cada sobre este mes frente a la media de los `lookback` meses anteriores que tienen gastos.
// En el mes en curso se compara con lo gastado en esos meses hasta el mismo día, para que sea justo
export function compareWithPast(expenses: Expense[], month: string, categories: BudgetCategory[], today = new Date(), lookback = 3): MonthComparison {
  const current = toMonthKey(today)
  const upToDay = month === current ? today.getDate() : null
  const cats = categories.filter((c) => !c.savings)
  const spentIn = (m: string) => {
    const last = upToDay === null ? "99" : String(Math.min(upToDay, daysInMonth(m))).padStart(2, "0")
    const byCat = new Map<string, number>()
    let any = false
    for (const e of expenses) {
      if (!e.date.startsWith(m)) continue
      any = true
      if (e.date.slice(8, 10) > last) continue
      const c = resolveCategory(e.category, categories)
      if (c && !c.savings) byCat.set(c.id, (byCat.get(c.id) ?? 0) + netAmount(e))
    }
    return { byCat, any }
  }

  const empty: MonthComparison = { months: 0, upToDay, total: { spent: 0, average: 0, diffPct: null }, rows: [] }
  if (month > current) return empty
  // Meses anteriores con algún gasto (hasta 2 años atrás, para no recorrer de más)
  const past: Map<string, number>[] = []
  for (let i = 1; i <= 24 && past.length < lookback; i++) {
    const r = spentIn(shiftMonth(month, -i))
    if (r.any) past.push(r.byCat)
  }
  if (!past.length) return empty

  const now = spentIn(month).byCat
  const rows = cats.map((c) => {
    const spent = now.get(c.id) ?? 0
    const average = past.reduce((a, m) => a + (m.get(c.id) ?? 0), 0) / past.length
    return { category: c, spent, average, diffPct: diff(spent, average) }
  })
  const spent = rows.reduce((a, r) => a + r.spent, 0)
  const average = rows.reduce((a, r) => a + r.average, 0)
  return { months: past.length, upToDay, total: { spent, average, diffPct: diff(spent, average) }, rows }
}

// El cambio más llamativo (para el titular): al menos un 20 % y 15 € de diferencia con la media
export function biggestChange(c: MonthComparison): CategoryTrend | null {
  const big = c.rows.filter((r) => r.diffPct !== null && Math.abs(r.diffPct) >= 20 && Math.abs(r.spent - r.average) >= 15)
  return big.sort((a, b) => Math.abs(b.spent - b.average) - Math.abs(a.spent - a.average))[0] ?? null
}

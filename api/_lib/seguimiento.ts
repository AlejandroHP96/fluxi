import { netAmount, type BudgetCategory, type Expense, type FixedExpense, type Members } from "../../src/types/budget.js"
import { monthLabel, resolveCategory, summarizeMonth } from "../../src/utils/month.js"
import { authorName } from "../../src/utils/members.js"

// Hoja de un mes del «Seguimiento» (Google Sheets): resumen, sobres y todos los gastos del mes.
// Solo construye las celdas; quien la escribe es api/seguimiento.ts

export interface BudgetDoc {
  categories?: BudgetCategory[]
  fixedExpenses?: FixedExpense[]
  income?: Record<string, number>
  members?: Members
}

// Rango de celdas (filas y columnas desde 0, el final no incluido) para darle formato
export interface CellRange {
  startRow: number
  endRow: number
  startCol: number
  endCol: number
}

export interface MonthSheet {
  rows: Array<Array<string | number>>
  bold: CellRange[]
  money: CellRange[]
}

const r2 = (n: number) => Math.round(n * 100) / 100

export function buildMonthSheet(month: string, expenses: Expense[], budget: BudgetDoc, today = new Date()): MonthSheet {
  const categories = budget.categories ?? []
  const income = budget.income?.[month] ?? null
  const s = summarizeMonth(expenses, month, income, categories, budget.fixedExpenses ?? [], today)
  const members = budget.members ?? {}
  const shared = Object.keys(members).length > 1

  const rows: MonthSheet["rows"] = []
  const bold: CellRange[] = []
  const money: CellRange[] = []
  const title = monthLabel(month)
  rows.push([`Fluxi · ${title.charAt(0).toUpperCase()}${title.slice(1)}`])
  bold.push({ startRow: 0, endRow: 1, startCol: 0, endCol: 1 })
  rows.push([])

  // Resumen
  const summaryStart = rows.length
  rows.push(["Nómina", income ?? "Sin apuntar"])
  rows.push(["Gastos fijos", r2(s.totalFixed)])
  if (s.saved > 0) rows.push(["Apartado (sobres de ahorro)", r2(s.saved)])
  rows.push(["Para gastar", r2(s.spendable)])
  rows.push(["Gastado", r2(s.spent)])
  rows.push([s.available >= 0 ? "Sobrante" : "Te pasaste", r2(Math.abs(s.available))])
  money.push({ startRow: summaryStart, endRow: rows.length, startCol: 1, endCol: 2 })
  bold.push({ startRow: summaryStart, endRow: rows.length, startCol: 0, endCol: 1 })
  rows.push([])

  // Sobres
  const envHeader = rows.length
  rows.push(["Sobre", "Asignado", "Gastado", "Queda"])
  bold.push({ startRow: envHeader, endRow: envHeader + 1, startCol: 0, endCol: 4 })
  for (const e of [...s.envelopes, ...s.savings]) {
    const name = e.category.savings ? `${e.category.name} (ahorro)` : e.category.name
    rows.push([name, r2(e.allocated), r2(e.spent), r2(e.remaining)])
  }
  if (s.uncategorized > 0) rows.push(["Sin categoría", 0, r2(s.uncategorized), r2(-s.uncategorized)])
  money.push({ startRow: envHeader + 1, endRow: rows.length, startCol: 1, endCol: 4 })
  rows.push([])

  // Gastos, del más antiguo al más reciente
  const expHeader = rows.length
  const header = ["Fecha", "Concepto", "Categoría", "Importe", "Devuelto", "Neto"]
  rows.push(shared ? [...header, "Apuntado por"] : header)
  bold.push({ startRow: expHeader, endRow: expHeader + 1, startCol: 0, endCol: header.length + 1 })
  const list = expenses.filter((e) => e.date.startsWith(month)).sort((a, b) => a.date.localeCompare(b.date))
  for (const e of list) {
    const net = netAmount(e)
    const row: Array<string | number> = [
      e.date,
      e.concept,
      resolveCategory(e.category, categories)?.name ?? "Sin categoría",
      r2(e.amount),
      r2(e.amount - net),
      r2(net),
    ]
    if (shared) row.push(authorName(e, members) ?? "")
    rows.push(row)
  }
  if (!list.length) rows.push(["Sin gastos este mes"])
  else money.push({ startRow: expHeader + 1, endRow: rows.length, startCol: 3, endCol: 6 })

  return { rows, bold, money }
}

// Mes que acaba de cerrar ("YYYY-MM"), visto desde `now`
export function previousMonth(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

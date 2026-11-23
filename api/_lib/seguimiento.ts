import { netAmount, type BudgetCategory, type Expense, type FixedExpense, type Members, type MonthStatus } from "../../src/types/budget.js"
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

// Colores de estado, los mismos que en la app: bien (verde), casi (ámbar), te pasas (rojo)
export type Tone = "ok" | "casi" | "pasado"

export interface MonthSheet {
  rows: Array<Array<string | number>>
  bold: CellRange[]
  money: CellRange[]
  tones: Array<{ range: CellRange; tone: Tone }>
}

const MONTH_STATUS: Record<MonthStatus, [string, Tone | null]> = {
  bien: ["Vas bien", "ok"],
  "ritmo-alto": ["Ritmo alto: gastas más rápido de lo que pasa el mes", "casi"],
  pasado: ["Te has pasado", "pasado"],
  "sin-nomina": ["Sin nómina apuntada", null],
}
const ENVELOPE_STATUS: Record<Tone, string> = { ok: "Bien", casi: "Casi", pasado: "Te pasaste" }
const pad = (n: number) => String(n).padStart(2, "0")

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
  const tones: MonthSheet["tones"] = []
  const cell = (row: number, col: number): CellRange => ({ startRow: row, endRow: row + 1, startCol: col, endCol: col + 1 })
  const title = monthLabel(month)
  rows.push([`Fluxi · ${title.charAt(0).toUpperCase()}${title.slice(1)}`])
  bold.push({ startRow: 0, endRow: 1, startCol: 0, endCol: 1 })
  const updated = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
  rows.push([s.isPast ? `Mes cerrado · actualizado el ${updated}` : `Mes en curso · actualizado el ${updated}`])
  rows.push([])

  // Estado del mes
  const [statusText, statusTone] = MONTH_STATUS[s.status]
  rows.push(["Estado", statusText])
  bold.push(cell(rows.length - 1, 0))
  if (statusTone) tones.push({ range: { startRow: rows.length - 1, endRow: rows.length, startCol: 0, endCol: 2 }, tone: statusTone })

  // Resumen
  const summaryStart = rows.length
  rows.push(["Nómina", income ?? "Sin apuntar"])
  rows.push(["Gastos fijos", r2(s.totalFixed)])
  if (s.saved > 0) rows.push(["Apartado (sobres de ahorro)", r2(s.saved)])
  rows.push(["Para gastar", r2(s.spendable)])
  rows.push(["Gastado", r2(s.spent)])
  rows.push([s.available >= 0 ? (s.isPast ? "Sobrante" : "Disponible") : "Te pasaste", r2(Math.abs(s.available))])
  if (income !== null) tones.push({ range: cell(rows.length - 1, 1), tone: s.available >= 0 ? "ok" : "pasado" })
  money.push({ startRow: summaryStart, endRow: rows.length, startCol: 1, endCol: 2 })
  bold.push({ startRow: summaryStart, endRow: rows.length, startCol: 0, endCol: 1 })
  rows.push([])

  // Sobres
  const envHeader = rows.length
  rows.push(["Sobre", "Asignado", "Gastado", "Queda", "Estado"])
  bold.push({ startRow: envHeader, endRow: envHeader + 1, startCol: 0, endCol: 5 })
  for (const e of [...s.envelopes, ...s.savings]) {
    const name = e.category.savings ? `${e.category.name} (ahorro)` : e.category.name
    rows.push([name, r2(e.allocated), r2(e.spent), r2(e.remaining), ENVELOPE_STATUS[e.status]])
    tones.push({ range: { startRow: rows.length - 1, endRow: rows.length, startCol: 3, endCol: 5 }, tone: e.status })
  }
  if (s.uncategorized > 0) {
    rows.push(["Sin categoría", 0, r2(s.uncategorized), r2(-s.uncategorized), "Sin sobre"])
    tones.push({ range: { startRow: rows.length - 1, endRow: rows.length, startCol: 3, endCol: 5 }, tone: "casi" })
  }
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

  return { rows, bold, money, tones }
}

// Meses ("YYYY-MM") de la semana que acaba de terminar (los 7 días antes de `now`): normalmente uno; dos si la
// semana cruza de un mes a otro, así el mes que cierra se escribe ya completo el lunes siguiente
export function monthsOfLastWeek(now = new Date()): string[] {
  const months = new Set<string>()
  for (let back = 7; back >= 1; back--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - back))
    months.add(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`)
  }
  return [...months]
}

import { netAmount, type BudgetCategory, type Carry, type Expense, type FixedExpense, type Members, type MonthStatus } from "../../src/types/budget.js"
import { daysInMonth, monthLabel, resolveCategory, summarizeMonth } from "../../src/utils/month.js"
import { authorName } from "../../src/utils/members.js"

// Pestaña de un mes del «Seguimiento» (Google Sheets), maquetada como un panel:
//
//   Título y estado
//   KPIs en fila (nómina, fijos, para gastar, gastado, disponible, estado, % gastado, % del mes…)
//   Izquierda: sobres y debajo todos los gastos      Derecha: semana a semana, gastos fijos y 3 gráficas
//   Columnas ocultas (O:Q): datos de la gráfica diaria
//
// Solo describe celdas, formatos y gráficas; quien lo traduce a la API de Sheets es api/seguimiento.ts

export interface BudgetDoc {
  categories?: BudgetCategory[]
  fixedExpenses?: FixedExpense[]
  income?: Record<string, number>
  members?: Members
  carry?: Carry // sobrante pasado de un mes al siguiente
  alerts?: Record<string, string[]> // avisos ya enviados (ver alerts.ts)
}

// Rango de celdas (filas y columnas desde 0, el final no incluido)
export interface CellRange {
  startRow: number
  endRow: number
  startCol: number
  endCol: number
}

// Colores de estado, los mismos que en la app: bien (verde), casi (ámbar), te pasas (rojo)
export type Tone = "ok" | "casi" | "pasado"
export type Style = "title" | "subtitle" | "kpiLabel" | "kpiValue" | "section" | "header" | "total"

export interface Chart {
  title: string
  type: "COLUMN" | "LINE" | "BAR"
  anchor: { row: number; col: number }
  width: number
  height: number
  domain: CellRange // con la fila de cabecera
  series: Array<{ range: CellRange; color: string }> // con la fila de cabecera (el nombre de la serie)
}

export interface MonthSheet {
  rows: Array<Array<string | number>>
  tone: Tone | null // estado del mes (color de la pestaña)
  merges: CellRange[]
  styles: Array<{ range: CellRange; style: Style }>
  money: CellRange[]
  percent: CellRange[]
  tones: Array<{ range: CellRange; tone: Tone }>
  widths: number[] // ancho de cada columna en px
  hidden: { startCol: number; endCol: number } // columnas con los datos de las gráficas
  charts: Chart[]
}

const MONTH_STATUS: Record<MonthStatus, [string, Tone | null]> = {
  bien: ["Vas bien", "ok"],
  "ritmo-alto": ["Ritmo alto", "casi"],
  pasado: ["Te has pasado", "pasado"],
  "sin-nomina": ["Sin nómina", null],
}
const ENVELOPE_STATUS: Record<Tone, string> = { ok: "Bien", casi: "Casi", pasado: "Te pasaste" }
const SHORT_MONTH = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
const pad = (n: number) => String(n).padStart(2, "0")
const r2 = (n: number) => Math.round(n * 100) / 100
const r4 = (n: number) => Math.round(n * 10000) / 10000
const toneOf = (spent: number, budget: number): Tone =>
  spent > budget + 0.005 ? "pasado" : budget > 0 && spent / budget >= 0.9 ? "casi" : "ok"

// Columnas: izquierda A–G, hueco H, derecha I–M, hueco N, datos ocultos O–Q
const L = 0
const R = 8
const DATA = 14
const WIDTHS = [110, 210, 130, 110, 110, 95, 120, 24, 150, 70, 110, 110, 110, 24, 60, 110, 110]
const COLORS = { spent: "#0891b2", budget: "#cbd5e1", pace: "#94a3b8" }

const MONTH_NAME = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

// Nombre de la pestaña de un mes: "2026-11" -> "Noviembre 26"
export const tabTitle = (month: string) => `${MONTH_NAME[Number(month.slice(5, 7)) - 1]} ${month.slice(2, 4)}`

// Semanas de lunes a domingo, recortadas al mes: [día de inicio, día de fin]
export function weeksOfMonth(month: string): Array<[number, number]> {
  const [y, m] = month.split("-").map(Number)
  const total = daysInMonth(month)
  const weeks: Array<[number, number]> = []
  for (let d = 1; d <= total; d++) {
    const monday = new Date(y, m - 1, d).getDay() === 1
    if (d === 1 || monday) weeks.push([d, d])
    else weeks[weeks.length - 1][1] = d
  }
  return weeks
}

export function buildMonthSheet(month: string, expenses: Expense[], budget: BudgetDoc, today = new Date()): MonthSheet {
  const categories = budget.categories ?? []
  const income = budget.income?.[month] ?? null
  const fixed = budget.fixedExpenses ?? []
  const s = summarizeMonth(expenses, month, income, categories, fixed, today, budget.carry ?? {})
  const members = budget.members ?? {}
  const shared = Object.keys(members).length > 1
  const list = expenses.filter((e) => e.date.startsWith(month)).sort((a, b) => a.date.localeCompare(b.date))
  const total = s.daysInMonth
  const todayDay = s.isCurrent ? today.getDate() : s.isPast ? total : 0

  const grid: Array<Array<string | number>> = []
  const put = (row: number, col: number, values: Array<string | number>) => {
    while (grid.length <= row) grid.push([])
    const r = grid[row]
    while (r.length < col) r.push("")
    values.forEach((v, i) => (r[col + i] = v))
  }
  const range = (startRow: number, endRow: number, startCol: number, endCol: number): CellRange => ({ startRow, endRow, startCol, endCol })
  const merges: CellRange[] = []
  const styles: MonthSheet["styles"] = []
  const money: CellRange[] = []
  const percent: CellRange[] = []
  const tones: MonthSheet["tones"] = []
  const style = (r: CellRange, st: Style) => styles.push({ range: r, style: st })

  // ── Título ──
  const label = monthLabel(month)
  const [statusText, statusTone] = MONTH_STATUS[s.status]
  const updated = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
  put(0, 0, [`Fluxi · ${label.charAt(0).toUpperCase()}${label.slice(1)}`])
  put(1, 0, [`${s.isPast ? "Mes cerrado" : "Mes en curso"} · actualizado el ${updated} · ${list.length} gastos`])
  merges.push(range(0, 1, 0, R + 5), range(1, 2, 0, R + 5))
  style(range(0, 1, 0, R + 5), "title")
  style(range(1, 2, 0, R + 5), "subtitle")

  // ── KPIs ──
  const kpis: Array<[string, string | number, "money" | "text", Tone | null]> = [
    ["Nómina", income ?? "Sin apuntar", "money", null],
    ["Gastos fijos", r2(s.totalFixed), "money", null],
    ["Para gastar", r2(s.spendable), "money", null],
    ["Gastado", r2(s.spent), "money", null],
    [s.available >= 0 ? (s.isPast ? "Sobrante" : "Disponible") : "Te pasaste", r2(Math.abs(s.available)), "money",
      income === null ? null : s.available >= 0 ? "ok" : "pasado"],
    ["Estado", statusText, "text", statusTone],
  ]
  kpis.forEach(([k, v, fmt, tone], i) => {
    put(3, i, [k])
    put(4, i, [v])
    if (fmt === "money") money.push(range(4, 5, i, i + 1))
    if (tone) tones.push({ range: range(4, 5, i, i + (i === 5 ? 2 : 1)), tone }) // el estado ocupa F:G
  })
  merges.push(range(3, 4, 5, 7), range(4, 5, 5, 7))
  style(range(3, 4, 0, 7), "kpiLabel")
  style(range(4, 5, 0, 7), "kpiValue")
  // A la derecha, el ritmo del mes
  put(3, R, ["% gastado", "", "% del mes", "€/día que quedan", "Nº de gastos"])
  put(4, R, [r4(s.spendable > 0 ? s.spent / s.spendable : 0), "", r4(s.pctElapsed / 100), s.dailyAllowance === null ? "—" : r2(s.dailyAllowance), list.length])
  merges.push(range(3, 4, R, R + 2), range(4, 5, R, R + 2))
  percent.push(range(4, 5, R, R + 1), range(4, 5, R + 2, R + 3))
  if (s.dailyAllowance !== null) money.push(range(4, 5, R + 3, R + 4))
  if (s.spendable > 0) {
    const pace: Tone = s.spent > s.spendable + 0.005 ? "pasado" : s.isCurrent && s.pctSpent > s.pctElapsed ? "casi" : "ok"
    tones.push({ range: range(4, 5, R, R + 2), tone: pace })
  }
  style(range(3, 4, R, R + 5), "kpiLabel")
  style(range(4, 5, R, R + 5), "kpiValue")

  // ── Izquierda: sobres ──
  put(6, L, ["Sobres"])
  style(range(6, 7, L, L + 1), "section")
  const envHeader = 7
  put(envHeader, L, ["Sobre", "Asignado", "Gastado", "Queda", "% gastado", "Estado"])
  style(range(envHeader, envHeader + 1, L, L + 6), "header")
  let row = envHeader + 1
  for (const e of [...s.envelopes, ...s.savings]) {
    const name = e.category.savings ? `${e.category.name} (ahorro)` : e.category.name
    put(row, L, [name, r2(e.allocated), r2(e.spent), r2(e.remaining), r4(e.pctSpent / 100), ENVELOPE_STATUS[e.status]])
    tones.push({ range: range(row, row + 1, L + 3, L + 6), tone: e.status })
    row++
  }
  if (s.uncategorized > 0) {
    put(row, L, ["Sin categoría", 0, r2(s.uncategorized), r2(-s.uncategorized), "", "Sin sobre"])
    tones.push({ range: range(row, row + 1, L + 3, L + 6), tone: "casi" })
    row++
  }
  const envEnd = row
  money.push(range(envHeader + 1, envEnd, L + 1, L + 4))
  percent.push(range(envHeader + 1, envEnd, L + 4, L + 5))

  // ── Derecha: semana a semana ──
  put(6, R, ["Semana a semana"])
  style(range(6, 7, R, R + 1), "section")
  const weekHeader = 7
  put(weekHeader, R, ["Semana", "Días", "Gastado", "Presupuesto", "Estado"])
  style(range(weekHeader, weekHeader + 1, R, R + 5), "header")
  const short = SHORT_MONTH[Number(month.slice(5, 7)) - 1]
  const spentOn = (day: number) => list.filter((e) => Number(e.date.slice(8, 10)) === day).reduce((a, e) => a + netAmount(e), 0)
  row = weekHeader + 1
  for (const [from, to] of weeksOfMonth(month)) {
    const days = to - from + 1
    let spent = 0
    for (let d = from; d <= to; d++) spent += spentOn(d)
    const weekBudget = r2((s.spendable * days) / total)
    const future = from > todayDay
    const current = !future && to > todayDay
    const tone = income === null || future ? null : toneOf(spent, weekBudget)
    const text = future ? "Por venir" : !tone ? "—" : current ? `En curso · ${ENVELOPE_STATUS[tone]}` : ENVELOPE_STATUS[tone]
    put(row, R, [from === to ? `${from} ${short}` : `${from}–${to} ${short}`, days, future ? "" : r2(spent), weekBudget, text])
    if (tone) tones.push({ range: range(row, row + 1, R + 4, R + 5), tone })
    row++
  }
  const weekEnd = row
  money.push(range(weekHeader + 1, weekEnd, R + 2, R + 4))

  // ── Derecha: gastos fijos ──
  row = weekEnd + 1
  if (fixed.length) {
    put(row, R, ["Gastos fijos"])
    style(range(row, row + 1, R, R + 1), "section")
    row++
    put(row, R, ["Gasto fijo", "", "Importe"])
    merges.push(range(row, row + 1, R, R + 2))
    style(range(row, row + 1, R, R + 3), "header")
    const start = ++row
    for (const f of fixed) {
      put(row, R, [f.name, "", r2(Number(f.amount) || 0)])
      merges.push(range(row, row + 1, R, R + 2))
      row++
    }
    put(row, R, ["Total", "", r2(s.totalFixed)])
    merges.push(range(row, row + 1, R, R + 2))
    style(range(row, row + 1, R, R + 3), "total")
    money.push(range(start, row + 1, R + 2, R + 3))
    row++
  }

  // ── Derecha: gráficas, una debajo de otra ──
  const chartRow = row + 1
  const CH = 280
  const CW = 550
  const ROWS_PER_CHART = 15

  // Datos de la gráfica diaria (columnas ocultas): gastado acumulado y ritmo para no pasarte
  const dailyHeader = 7
  put(dailyHeader, DATA, ["Día", "Gastado", "Ritmo"])
  let acc = 0
  for (let d = 1; d <= total; d++) {
    acc += spentOn(d)
    put(dailyHeader + d, DATA, [d, d <= todayDay ? r2(acc) : "", r2((s.spendable * d) / total)])
  }

  const charts: Chart[] = [
    {
      title: "Gasto por semana",
      type: "COLUMN",
      anchor: { row: chartRow, col: R },
      width: CW,
      height: CH,
      domain: range(weekHeader, weekEnd, R, R + 1),
      series: [
        { range: range(weekHeader, weekEnd, R + 2, R + 3), color: COLORS.spent },
        { range: range(weekHeader, weekEnd, R + 3, R + 4), color: COLORS.budget },
      ],
    },
    {
      title: "Gastado en el mes frente al ritmo",
      type: "LINE",
      anchor: { row: chartRow + ROWS_PER_CHART, col: R },
      width: CW,
      height: CH,
      domain: range(dailyHeader, dailyHeader + total + 1, DATA, DATA + 1),
      series: [
        { range: range(dailyHeader, dailyHeader + total + 1, DATA + 1, DATA + 2), color: COLORS.spent },
        { range: range(dailyHeader, dailyHeader + total + 1, DATA + 2, DATA + 3), color: COLORS.pace },
      ],
    },
  ]
  if (envEnd > envHeader + 1) {
    charts.push({
      title: "Sobres: gastado frente a asignado",
      type: "BAR",
      anchor: { row: chartRow + 2 * ROWS_PER_CHART, col: R },
      width: CW,
      height: Math.max(CH, 60 + 34 * (envEnd - envHeader - 1)),
      domain: range(envHeader, envEnd, L, L + 1),
      series: [
        { range: range(envHeader, envEnd, L + 2, L + 3), color: COLORS.spent },
        { range: range(envHeader, envEnd, L + 1, L + 2), color: COLORS.budget },
      ],
    })
  }

  // ── Izquierda: todos los gastos, debajo de los sobres ──
  row = envEnd + 1
  put(row, L, ["Gastos del mes"])
  style(range(row, row + 1, L, L + 1), "section")
  row++
  const header = ["Fecha", "Concepto", "Categoría", "Importe", "Devuelto", "Neto"]
  put(row, L, shared ? [...header, "Apuntado por"] : header)
  style(range(row, row + 1, L, L + header.length + (shared ? 1 : 0)), "header")
  const expStart = ++row
  for (const e of list) {
    const net = netAmount(e)
    const cells: Array<string | number> = [
      e.date,
      e.concept,
      resolveCategory(e.category, categories)?.name ?? "Sin categoría",
      r2(e.amount),
      r2(e.amount - net),
      r2(net),
    ]
    if (shared) cells.push(authorName(e, members) ?? "")
    put(row++, L, cells)
  }
  if (!list.length) put(row++, L, ["Sin gastos este mes"])
  else money.push(range(expStart, row, L + 3, L + 6))

  // Todas las filas con el mismo ancho
  const width = DATA + 3
  const rows = grid.map((r) => [...r, ...Array(Math.max(0, width - r.length)).fill("")])

  return {
    rows, tone: statusTone, merges, styles, money, percent, tones, widths: WIDTHS,
    hidden: { startCol: DATA, endCol: DATA + 3 }, charts,
  }
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

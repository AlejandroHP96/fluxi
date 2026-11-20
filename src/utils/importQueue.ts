import { categorize, conceptKey } from "./categorize"
import { resolveCategory, shiftMonth } from "./month"
import type { CsvExpense } from "./revolutCsv"
import type { BudgetCategory, Expense } from "../types/budget"

// "Omitir" como elección (también se recuerda por concepto)
export const SKIP = "__skip__"

// Memoria de elecciones: conceptKey(concepto) -> id de categoría o SKIP (budgets/{uid}.memory)
export type CategoryMemory = Record<string, string>

export interface ImportItem {
  id: number
  date: string // "YYYY-MM-DD"
  time: string // "HH:mm" o ""
  concept: string // el que se guardará (en los de Ventajón, el comercio real si se encontró)
  originalConcept: string // tal cual viene en el CSV
  amount: number // positivo
  isVentajon: boolean
  ventajonFound: boolean // se encontró el comercio real en Ventajón
  duplicateOf: Expense | null // gasto ya apuntado con el mismo importe y fecha cercana
  suggestion: string | null // id de categoría propuesta, SKIP, o null si no hay ninguna que encaje
}

const MAX_DAYS = 3
const DAY_MS = 24 * 60 * 60 * 1000
const dayMs = (date: string) => Date.parse(`${date.slice(0, 10)}T00:00:00Z`)
const sameAmount = (a: number, b: number) => Math.abs(Number(a) - Number(b)) < 0.005
const isVentajonConcept = (c: string) => /ventaj[oó]n/i.test(c)

// Categoría propuesta (solo de gasto, no de ahorro): lo que elegiste antes para ese concepto; si no, una
// categoría tuya cuyo nombre aparezca en el concepto; si no, la de las reglas de serie (Mercadona -> "Alimentación") si tienes una categoría con ese nombre
export function suggestFor(concept: string, memory: CategoryMemory, categories: BudgetCategory[]): string | null {
  const spendable = categories.filter((c) => !c.savings)
  const remembered = memory[conceptKey(concept)]
  if (remembered === SKIP) return SKIP
  if (remembered && spendable.some((c) => c.id === remembered)) return remembered
  // Una categoría tuya cuyo nombre sale en el concepto («Multitienda» en «MULTITIENDA DIANA»); la más larga gana
  const key = ` ${conceptKey(concept)} `
  const byName = spendable
    .map((c) => ({ c, name: conceptKey(c.name) }))
    .filter(({ name }) => name.length >= 3 && key.includes(` ${name} `))
    .sort((x, y) => y.name.length - x.name.length)[0]
  if (byName) return byName.c.id
  const guess = categorize(concept, false)
  const match = resolveCategory(guess, spendable) ?? resolveCategory(`${guess}s`, spendable) // "Otro" -> "Otros"
  return match?.id ?? null
}

/**
 * Cola de revisión de un mes: un elemento por gasto del CSV, marcando los que ya estén apuntados
 * (mismo importe y a ±3 días de un gasto existente; cada gasto existente solo se usa una vez).
 */
export function buildImportQueue(
  rows: CsvExpense[],
  month: string,
  existing: Expense[],
  memory: CategoryMemory,
  categories: BudgetCategory[]
): ImportItem[] {
  const used = new Set<string>()
  return rows
    .filter((r) => r.date.startsWith(month))
    .map((r, id) => {
      let duplicateOf: Expense | null = null
      let best = Infinity
      for (const e of existing) {
        if (used.has(e.id) || !sameAmount(e.amount, r.amount)) continue
        const diff = Math.abs(dayMs(e.date) - dayMs(r.date)) / DAY_MS
        if (diff <= MAX_DAYS && diff < best) {
          best = diff
          duplicateOf = e
        }
      }
      if (duplicateOf) used.add(duplicateOf.id)
      const isVentajon = isVentajonConcept(r.concept)
      return {
        id,
        date: r.date,
        time: r.time,
        concept: r.concept,
        originalConcept: r.concept,
        amount: r.amount,
        isVentajon,
        ventajonFound: false,
        duplicateOf,
        suggestion: duplicateOf ? SKIP : suggestFor(r.concept, memory, categories),
      }
    })
}

// Meses que hay que pedir a Ventajón para los pagos "Ventajon" de la cola (incluye los vecinos por ±3 días)
export function ventajonMonths(queue: ImportItem[]): string[] {
  const months = new Set<string>()
  for (const it of queue) {
    if (!it.isVentajon) continue
    const m = it.date.slice(0, 7)
    months.add(m)
    const day = Number(it.date.slice(8, 10))
    if (day <= MAX_DAYS) months.add(shiftMonth(m, -1))
    if (day >= 26) months.add(shiftMonth(m, 1))
  }
  return [...months].sort()
}

/**
 * Cambia "Ventajon" por el comercio real: compra de Ventajón con el mismo importe y la fecha más cercana
 * (±3 días; cada compra una vez) y vuelve a calcular la sugerencia con el nuevo concepto.
 */
export function applyVentajon(
  queue: ImportItem[],
  purchases: Array<{ date: string; concept: string; amount: number }>,
  memory: CategoryMemory,
  categories: BudgetCategory[]
): ImportItem[] {
  const used = new Set<number>()
  return queue.map((it) => {
    if (!it.isVentajon) return it
    let bestIdx = -1
    let best = Infinity
    purchases.forEach((p, idx) => {
      if (used.has(idx) || !sameAmount(p.amount, it.amount)) return
      const diff = Math.abs(dayMs(p.date) - dayMs(it.date)) / DAY_MS
      if (diff <= MAX_DAYS && diff < best) {
        best = diff
        bestIdx = idx
      }
    })
    if (bestIdx === -1) return it
    used.add(bestIdx)
    const concept = purchases[bestIdx].concept
    return { ...it, concept, ventajonFound: true, suggestion: it.duplicateOf ? SKIP : suggestFor(concept, memory, categories) }
  })
}

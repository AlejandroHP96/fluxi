import { MONTHS } from "../constants/categories"
import type { Transaction } from "../types"

export interface MonthOption {
  key: string // "YYYY-MM"
  label: string // "Noviembre 2026"
}

/**
 * Obtiene la lista de meses disponibles presentes en las transacciones (o el mes actual por defecto),
 * ordenados del más reciente al más antiguo.
 */
export function getAvailableMonths(transactions: Transaction[]): MonthOption[] {
  const set = new Set<string>()

  // Asegurar mes actual
  const now = new Date()
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  set.add(currentKey)

  // Agregar meses presentes en transacciones
  transactions.forEach((t) => {
    if (t.date) {
      const ym = t.date.slice(0, 7) // "YYYY-MM"
      if (/^\d{4}-\d{2}$/.test(ym)) {
        set.add(ym)
      }
    }
  })

  const sortedKeys = Array.from(set).sort().reverse()

  const MONTH_NAMES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ]

  return sortedKeys.map((key) => {
    const [year, monthStr] = key.split("-")
    const mIdx = parseInt(monthStr, 10) - 1
    return {
      key,
      label: `${MONTH_NAMES[mIdx] || monthStr} ${year}`,
    }
  })
}

/**
 * Filtra transacciones por mes "YYYY-MM" o devuelve todas si key === "all"
 */
export function filterTransactionsByMonth(transactions: Transaction[], monthKey: string): Transaction[] {
  if (monthKey === "all") return transactions
  return transactions.filter((t) => t.date && t.date.startsWith(monthKey))
}

/**
 * Calcula totales para un conjunto de transacciones filtrado
 */
export function computeTotals(txs: Transaction[]) {
  const acc = txs.reduce(
    (a, t) => {
      if (t.type === "income") a.income += Number(t.amount)
      if (t.type === "expense") a.expense += Math.abs(Number(t.amount))
      return a
    },
    { income: 0, expense: 0 }
  )

  const balance = acc.income - acc.expense
  const savingsRate = acc.income > 0 ? ((balance / acc.income) * 100).toFixed(1) : "0.0"

  return { ...acc, balance, savingsRate }
}

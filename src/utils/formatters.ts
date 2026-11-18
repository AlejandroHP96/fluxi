import type { Transaction, MonthlyData, CategoryData } from "../types"

export const fmt = (n: number): string =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)

export const fmtDec = (n: number): string =>
  new Intl.NumberFormat("es-ES", {
    style: "currency", currency: "EUR",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n)

export const buildMonthlyData = (txs: Transaction[], months: string[]): MonthlyData[] => {
  // Ordenar transacciones por fecha ascendente para procesar cronológicamente
  const sorted = [...txs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const map: Record<string, { label: string; income: number; expense: number; year: number; month: number }> = {}

  sorted.forEach((t) => {
    const d = new Date(t.date)
    if (isNaN(d.getTime())) return
    const year = d.getFullYear()
    const month = d.getMonth()
    const key = `${year}-${String(month).padStart(2, "0")}`
    const label = `${months[month]} ${String(year).slice(-2)}`

    if (!map[key]) {
      map[key] = { label, income: 0, expense: 0, year, month }
    }
    if (t.type === "income") map[key].income += Number(t.amount)
    if (t.type === "expense") map[key].expense += Math.abs(Number(t.amount))
  })

  // Ordenar cronológicamente las claves YYYY-MM
  return Object.keys(map)
    .sort()
    .map((k) => {
      const m = map[k]
      return {
        label: m.label,
        income: m.income,
        expense: m.expense,
        savings: m.income - m.expense,
      }
    })
}

export const buildCategoryData = (txs: Transaction[]): CategoryData[] => {
  const map: Record<string, number> = {}
  txs.filter((t) => t.type === "expense").forEach((t) => {
    map[t.category] = (map[t.category] || 0) + Math.abs(Number(t.amount))
  })
  return Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}

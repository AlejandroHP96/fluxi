import type { Expense } from "../types/budget.js"

export interface Suggestion {
  concept: string
  category: string
  amount: number
}

// Quita mayúsculas y tildes para comparar («Panadería» = «panaderia»)
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase()

// Conceptos ya usados que encajan con lo que se escribe, con el sobre y el importe de la última vez.
// Primero los que empiezan por el texto y, dentro de eso, los más usados. Si el texto ya es igual a un
// concepto, no se sugiere nada (no hace falta)
export function conceptSuggestions(expenses: Expense[], typed: string, limit = 4): Suggestion[] {
  const q = norm(typed)
  if (q.length < 2) return []
  const seen = new Map<string, { last: Expense; uses: number }>()
  for (const e of expenses) {
    const k = norm(e.concept)
    if (!k) continue
    const s = seen.get(k)
    if (!s) seen.set(k, { last: e, uses: 1 })
    else {
      s.uses++
      if (e.date > s.last.date) s.last = e
    }
  }
  if (seen.has(q)) return []
  return [...seen.entries()]
    .filter(([k]) => k.includes(q))
    .sort(([a, x], [b, y]) => Number(b.startsWith(q)) - Number(a.startsWith(q)) || y.uses - x.uses || y.last.date.localeCompare(x.last.date))
    .slice(0, limit)
    .map(([, { last }]) => ({ concept: last.concept, category: last.category, amount: last.amount }))
}

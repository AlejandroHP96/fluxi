import { CATEGORY_TEMPLATE } from "../../hooks/useBudget"
import { newCategoryId } from "../../utils/month"
import type { BudgetCategory } from "../../types/budget"
import { parseAmount } from "./helpers"

// Fila de categoría en edición: el % va como texto para poder escribir "12,5"
export interface DraftCat {
  id: string
  name: string
  pct: string
  savings: boolean
  isNew: boolean // aún no guardada (borrarla no afecta a ningún gasto)
}

export const toDraft = (cats: BudgetCategory[]): DraftCat[] =>
  cats.map((c) => ({ id: c.id, name: c.name, pct: String(c.pct).replace(".", ","), savings: c.savings, isNew: false }))

export const templateDraft = (): DraftCat[] =>
  CATEGORY_TEMPLATE.map((c) => ({ id: newCategoryId(), name: c.name, pct: String(c.pct), savings: c.savings, isNew: true }))

export const blankDraft = (): DraftCat => ({ id: newCategoryId(), name: "", pct: "0", savings: false, isNew: true })

// Vacío cuenta como 0; texto no numérico, como NaN
export const draftPct = (d: DraftCat): number => (d.pct.trim() === "" ? 0 : parseAmount(d.pct))

export const draftTotal = (draft: DraftCat[]) => draft.reduce((a, d) => a + (Number.isFinite(draftPct(d)) ? draftPct(d) : 0), 0)

// Mensaje de error si la lista no se puede guardar
export function validateDraft(draft: DraftCat[]): string | null {
  if (draft.length === 0) return "Crea al menos una categoría."
  for (const d of draft) {
    if (!d.name.trim()) return "Todas las categorías necesitan un nombre."
    const p = draftPct(d)
    if (!Number.isFinite(p) || p < 0 || p > 100) return `El % de «${d.name.trim()}» tiene que ser un número entre 0 y 100.`
  }
  const names = draft.map((d) => d.name.trim().toLowerCase())
  if (new Set(names).size !== names.length) return "Hay dos categorías con el mismo nombre."
  return null
}

export const fromDraft = (draft: DraftCat[]): BudgetCategory[] =>
  draft.map((d) => ({ id: d.id, name: d.name.trim(), pct: Math.round(draftPct(d) * 100) / 100, savings: d.savings }))

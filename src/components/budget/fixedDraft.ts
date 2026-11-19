import { newCategoryId } from "../../utils/month"
import type { FixedExpense } from "../../types/budget"
import { parseAmount } from "./helpers"

// Fila de gasto fijo en edición: el importe va como texto para escribir "600", "45,50"
export interface DraftFixed {
  id: string
  name: string
  amount: string
  isNew: boolean
}

export const toFixedDraft = (list: FixedExpense[]): DraftFixed[] =>
  list.map((f) => ({ id: f.id, name: f.name, amount: String(f.amount).replace(".", ","), isNew: false }))

export const blankFixedDraft = (): DraftFixed => ({
  id: newCategoryId(),
  name: "",
  amount: "",
  isNew: true,
})

export const draftFixedAmount = (d: DraftFixed): number => (d.amount.trim() === "" ? 0 : parseAmount(d.amount))

export const draftFixedTotal = (draft: DraftFixed[]) =>
  draft.reduce((a, d) => {
    const n = draftFixedAmount(d)
    return a + (Number.isFinite(n) ? n : 0)
  }, 0)

export function validateFixedDraft(draft: DraftFixed[]): string | null {
  for (const d of draft) {
    const hasName = Boolean(d.name.trim())
    const hasAmount = Boolean(d.amount.trim())
    // Si la fila está totalmente vacía, se ignora al guardar
    if (!hasName && !hasAmount) continue
    if (!hasName && hasAmount) return "Todos los gastos fijos necesitan un nombre."
    if (hasName && !hasAmount) return `Pon un importe para «${d.name.trim()}».`
    const a = draftFixedAmount(d)
    if (!Number.isFinite(a) || a <= 0) return `El importe de «${d.name.trim()}» tiene que ser mayor que 0.`
  }
  return null
}

export const fromFixedDraft = (draft: DraftFixed[]): FixedExpense[] =>
  draft
    .filter((d) => d.name.trim() && draftFixedAmount(d) > 0)
    .map((d) => ({
      id: d.id,
      name: d.name.trim(),
      amount: Math.round(draftFixedAmount(d) * 100) / 100,
    }))

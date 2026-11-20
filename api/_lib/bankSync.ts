import { createHash } from "node:crypto"
import { buildImportQueue, SKIP, type CategoryMemory } from "../../src/utils/importQueue.js"
import type { BudgetCategory, Expense, NewExpense } from "../../src/types/budget.js"
import type { BankExpense } from "./enablebanking.js"

// Clave corta y segura como nombre de campo de Firestore para el id de un movimiento del banco
export const refKey = (ref: string) => createHash("sha256").update(ref).digest("hex").slice(0, 32)

// Importación automática (cron): mismas reglas que el importador manual, pero sin revisión.
//  - Movimientos ya vistos en otra ejecución (seen, por refKey): nunca se repiten, aunque borraras el gasto.
//  - Se saltan los ya apuntados (mismo importe a ±3 días) y los conceptos que elegiste omitir.
//  - Categoría: la que elegiste antes para ese concepto, la de las reglas de serie o, si no, la de reserva.
export function planAutoImport(
  rows: BankExpense[],
  existing: Expense[],
  memory: CategoryMemory,
  categories: BudgetCategory[],
  seen: Record<string, string> = {}
): NewExpense[] {
  const spendable = categories.filter((c) => !c.savings)
  const fallback = spendable.find((c) => /^otros?$/i.test(c.name.trim())) ?? spendable[spendable.length - 1]
  if (!fallback) return [] // sin categorías de gasto no hay dónde apuntarlos
  const fresh = rows.filter((r) => !seen[refKey(r.ref)])
  const out: NewExpense[] = []
  for (const it of buildImportQueue(fresh, "", existing, memory, categories)) {
    if (it.duplicateOf || it.suggestion === SKIP) continue
    out.push({ amount: it.amount, concept: it.concept, category: it.suggestion ?? fallback.id, date: it.date })
  }
  return out
}

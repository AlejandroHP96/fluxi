import type { Expense, Members } from "../types/budget"

// Hay alguien más que el dueño: solo entonces se enseña quién hizo cada cosa
export const isShared = (members: Members) => Object.keys(members).length > 1

// Quién apuntó el gasto: createdBy o, en los antiguos, el dueño del presupuesto (userId)
export const authorName = (e: Pick<Expense, "userId" | "createdBy">, members: Members): string | null =>
  members[e.createdBy ?? e.userId] ?? null

// «Apuntado por X · editado por Y» (el editor solo si es otra persona); null si no se comparte
export function authorshipLabel(e: Pick<Expense, "userId" | "createdBy" | "updatedBy">, members: Members): string | null {
  if (!isShared(members)) return null
  const author = authorName(e, members)
  if (!author) return null
  const editor = e.updatedBy && e.updatedBy !== (e.createdBy ?? e.userId) ? members[e.updatedBy] : null
  return editor ? `Apuntado por ${author} · editado por ${editor}` : `Apuntado por ${author}`
}

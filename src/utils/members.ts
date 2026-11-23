import type { Expense, Members } from "../types/budget.js"

// Hay alguien más que el dueño: solo entonces se enseña quién hizo cada cosa
export const isShared = (members: Members) => Object.keys(members).length > 1

// Quién apuntó el gasto: createdBy o, en los antiguos, el dueño del presupuesto (userId)
export const authorName = (e: Pick<Expense, "userId" | "createdBy">, members: Members): string | null =>
  members[e.createdBy ?? e.userId] ?? null

// Etiqueta corta de cada miembro para la burbuja de la lista: la inicial o, si otro empieza igual, las letras
// justas para distinguirlos («Al» y «An»), hasta 3
export function memberInitials(members: Members): Record<string, string> {
  const names = Object.entries(members).map(([uid, n]) => [uid, n.trim()] as const)
  const out: Record<string, string> = {}
  for (const [uid, name] of names) {
    const low = name.toLowerCase()
    let k = 1
    while (k < 3 && k < name.length && names.some(([o, n]) => o !== uid && n.toLowerCase().startsWith(low.slice(0, k)))) k++
    out[uid] = name.charAt(0).toUpperCase() + name.slice(1, k).toLowerCase() || "?"
  }
  return out
}

// «Apuntado por X · editado por Y» (el editor solo si es otra persona); null si no se comparte
export function authorshipLabel(e: Pick<Expense, "userId" | "createdBy" | "updatedBy">, members: Members): string | null {
  if (!isShared(members)) return null
  const author = authorName(e, members)
  if (!author) return null
  const editor = e.updatedBy && e.updatedBy !== (e.createdBy ?? e.userId) ? members[e.updatedBy] : null
  return editor ? `Apuntado por ${author} · editado por ${editor}` : `Apuntado por ${author}`
}

import type { BudgetCategory } from "../../types/budget"

// Acepta "12,50", "12.5" y "1.200" / "1.200,50" (puntos de millares)
export const parseAmount = (raw: string): number => {
  let s = raw.trim().replace(/\s|€/g, "")
  if (!s) return NaN
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".")
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "")
  return /^\d*\.?\d+$|^\d+\.$/.test(s) ? Number(s) : NaN
}

// Paleta de categorías: sin verde, ámbar ni rojo (son los colores de estado) y sin repetir en consecutivas
// Categorías de gasto: sin verde, ámbar ni rojo (son los colores de estado) y sin el cian del ahorro
const CATEGORY_PALETTE = ["#a78bfa", "#f472b6", "#60a5fa", "#e879f9", "#818cf8", "#c084fc", "#93c5fd", "#94a3b8"]
// Ahorro: siempre cian, para distinguirlo de las de gasto
const SAVINGS_COLOR = "#22d3ee"

// Color por posición en la lista de categorías del usuario (gris si ya no existe)
export const catColor = (categories: BudgetCategory[], category: BudgetCategory | string | null | undefined): string => {
  const id = typeof category === "string" ? category : category?.id
  const found = categories.find((c) => c.id === id)
  if (!found) return "#6b7280"
  if (found.savings) return SAVINGS_COLOR
  // Posición entre las de gasto, para que el color no cambie al marcar/desmarcar una de ahorro
  const i = categories.filter((c) => !c.savings).findIndex((c) => c.id === id)
  return CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]
}

const LAST_CAT_KEY = "fluxi_last_category"

// Última categoría usada al apuntar un gasto, si sigue existiendo entre las dadas ("" si no hay)
export const getLastCategory = (valid: BudgetCategory[]): string => {
  try {
    const c = localStorage.getItem(LAST_CAT_KEY)
    return c && valid.some((x) => x.id === c) ? c : ""
  } catch {
    return ""
  }
}

export const saveLastCategory = (category: string) => {
  try {
    localStorage.setItem(LAST_CAT_KEY, category)
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
}

// "2026-11-17" -> "17 nov"
export const shortDate = (dateKey: string): string => {
  const [y, m, d] = dateKey.split("-").map(Number)
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(new Date(y, m - 1, d)).replace(".", "")
}

// "2026-11-17" -> "martes, 17 nov"
export const longDate = (dateKey: string): string => {
  const [y, m, d] = dateKey.split("-").map(Number)
  return new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "short" })
    .format(new Date(y, m - 1, d))
    .replace(".", "")
}

// "2026-11-17" -> "Hoy" | "Ayer" | "17 nov"
export const dayLabel = (dateKey: string, today: string): string => {
  const [y, m, d] = dateKey.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  const [ty, tm, td] = today.split("-").map(Number)
  const diff = Math.round((new Date(ty, tm - 1, td).getTime() - date.getTime()) / 86400000)
  if (diff === 0) return "Hoy"
  if (diff === 1) return "Ayer"
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(date).replace(".", "")
}

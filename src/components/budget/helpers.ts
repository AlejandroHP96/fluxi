import { CATEGORIES, CAT_COLORS } from "../../constants/categories"

// Acepta "12,50", "12.5" y "1.200" / "1.200,50" (puntos de millares)
export const parseAmount = (raw: string): number => {
  let s = raw.trim().replace(/\s|€/g, "")
  if (!s) return NaN
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".")
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "")
  return /^\d*\.?\d+$|^\d+\.$/.test(s) ? Number(s) : NaN
}

export const catColor = (category: string): string => {
  const i = CATEGORIES.indexOf(category)
  return CAT_COLORS[(i < 0 ? CATEGORIES.length - 1 : i) % CAT_COLORS.length]
}

const LAST_CAT_KEY = "fluxi_last_category"

export const getLastCategory = (): string => {
  try {
    const c = localStorage.getItem(LAST_CAT_KEY)
    return c && CATEGORIES.includes(c) ? c : "Otro"
  } catch {
    return "Otro"
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

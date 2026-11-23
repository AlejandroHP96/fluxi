// Temas de color de la app: cambian el acento (el «cian» de botones, enlaces y gráficas). Siempre oscuros.
// Verde, ámbar y rojo no se usan como acento: son los colores de estado (vas bien / casi / te pasas).
// Cada tono va en canales RGB («r g b») para poder usarlo con opacidad: rgb(var(--acc-400) / 0.5)
export interface Theme {
  id: string
  name: string
  acc: Record<100 | 200 | 300 | 400 | 500 | 950, string>
  alt: Record<400 | 500, string> // segundo tono de los degradados
}

export const THEMES: Theme[] = [
  {
    id: "cian", name: "Cian",
    acc: { 100: "207 250 254", 200: "165 243 252", 300: "103 232 249", 400: "34 211 238", 500: "6 182 212", 950: "4 32 42" },
    alt: { 400: "56 189 248", 500: "14 165 233" },
  },
  {
    id: "azul", name: "Azul",
    acc: { 100: "219 234 254", 200: "191 219 254", 300: "147 197 253", 400: "96 165 250", 500: "59 130 246", 950: "23 37 84" },
    alt: { 400: "129 140 248", 500: "99 102 241" },
  },
  {
    id: "violeta", name: "Violeta",
    acc: { 100: "237 233 254", 200: "221 214 254", 300: "196 181 253", 400: "167 139 250", 500: "139 92 246", 950: "46 16 101" },
    alt: { 400: "192 132 252", 500: "168 85 247" },
  },
  {
    id: "fucsia", name: "Fucsia",
    acc: { 100: "250 232 255", 200: "245 208 254", 300: "240 171 252", 400: "232 121 249", 500: "217 70 239", 950: "74 4 78" },
    alt: { 400: "167 139 250", 500: "139 92 246" },
  },
  {
    id: "rosa", name: "Rosa",
    acc: { 100: "252 231 243", 200: "251 207 232", 300: "249 168 212", 400: "244 114 182", 500: "236 72 153", 950: "80 7 36" },
    alt: { 400: "253 164 175", 500: "251 113 133" },
  },
  {
    id: "grafito", name: "Grafito",
    acc: { 100: "241 245 249", 200: "226 232 240", 300: "203 213 225", 400: "148 163 184", 500: "100 116 139", 950: "2 6 23" },
    alt: { 400: "148 163 184", 500: "71 85 105" },
  },
]

export const DEFAULT_THEME = "cian"

export const themeById = (id: string | null | undefined): Theme =>
  THEMES.find((t) => t.id === id) ?? THEMES.find((t) => t.id === DEFAULT_THEME)!

// Pone el tema en la página (variables CSS de :root; los valores por defecto, cian, están en index.css)
export function applyTheme(id: string | null | undefined) {
  const t = themeById(id)
  const s = document.documentElement.style
  for (const [k, v] of Object.entries(t.acc)) s.setProperty(`--acc-${k}`, v)
  for (const [k, v] of Object.entries(t.alt)) s.setProperty(`--alt-${k}`, v)
}

// Último tema de cada cuenta en este dispositivo: se aplica al entrar, antes de que lleguen los datos
const key = (uid: string) => `fluxi:theme:${uid}`
export const rememberedTheme = (uid: string): string | null => {
  try { return localStorage.getItem(key(uid)) } catch { return null }
}
export const rememberTheme = (uid: string, id: string) => {
  try { localStorage.setItem(key(uid), id) } catch { /* sin almacenamiento */ }
}

import { cleanVentajonConcept, categorizeVentajonItem } from "./_lib/ventajon.js"

export const config = {
  runtime: "nodejs",
}

// API no oficial de la web de Ventajón (www.ventajon.com). Si cambian su web, esto puede dejar de funcionar.
const BASE = "https://www.ventajon.com"
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36"
const MAX_MONTHS = 36

interface Session {
  token: string
  refreshToken: string
  uuid: string
}

export interface VentajonPurchase {
  date: string // "2026-10-31T13:30:44.149" (hora local de la compra)
  concept: string
  amount: number // positivo
  category: string
}

// El login es una server action de Next.js cuyo ID cambia con cada despliegue de Ventajón:
// se busca en sus chunks JS y se reutiliza mientras la instancia siga viva.
let cachedLoginActionId: string | null = null

function readSetCookie(res: Response, name: string): string | null {
  for (const c of res.headers.getSetCookie()) {
    const m = c.match(new RegExp(`^${name}=([^;]*)`))
    if (m) return m[1]
  }
  return null
}

async function findLoginActionId(loginHtml: string): Promise<string> {
  const chunks = [...new Set(loginHtml.match(/\/_next\/static\/chunks\/[\w/.-]+\.js/g) || [])]
  const re = /createServerReference\)\("([0-9a-f]+)",[^)]{0,120}"WebAccountLogin"\)/
  for (let i = 0; i < chunks.length; i += 10) {
    const found = await Promise.all(
      chunks.slice(i, i + 10).map(async (path) => {
        const r = await fetch(BASE + path, { headers: { "User-Agent": UA } })
        return r.ok ? ((await r.text()).match(re)?.[1] ?? null) : null
      })
    )
    const id = found.find(Boolean)
    if (id) return id
  }
  throw new Error("No se encontró el login en la web de Ventajón (puede que hayan cambiado la web)")
}

export async function ventajonLogin(email: string, password: string): Promise<Session> {
  const page = await fetch(`${BASE}/iniciar-sesion`, { headers: { "User-Agent": UA } })
  const uuid = readSetCookie(page, "VENTAJON_web_uuid")
  const html = await page.text()
  if (!uuid) throw new Error("Ventajón no devolvió la cookie de sesión")

  // Dos intentos: si el ID guardado ya no vale, se busca de nuevo
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!cachedLoginActionId) cachedLoginActionId = await findLoginActionId(html)
    const r = await fetch(`${BASE}/iniciar-sesion`, {
      method: "POST",
      headers: {
        "User-Agent": UA,
        "Next-Action": cachedLoginActionId,
        Accept: "text/x-component",
        "Content-Type": "text/plain;charset=UTF-8",
        Origin: BASE,
        Referer: `${BASE}/iniciar-sesion`,
        Cookie: `VENTAJON_web_uuid=${uuid}`,
      },
      body: JSON.stringify([{ userAgent: UA, webAuthData: { email, password, auth_type: "api" } }]),
    })
    // Respuesta en formato RSC: una de las filas es "1:{"status":200,"data":{...}}"
    const row = (await r.text()).split("\n").find((l) => /^\d+:\{"status":/.test(l))
    if (!row) {
      cachedLoginActionId = null
      continue
    }
    const result = JSON.parse(row.slice(row.indexOf(":") + 1))
    if (result.status !== 200 || !result.data?.token) {
      throw new Error(`Ventajón rechazó el login (estado ${result.status}). Revisa el email y la contraseña.`)
    }
    return { token: result.data.token, refreshToken: result.data.refresh_token, uuid }
  }
  throw new Error("No se pudo hacer login en Ventajón (puede que hayan cambiado la web)")
}

async function ventajonGet(session: Session, path: string): Promise<any> {
  const auth = encodeURIComponent(JSON.stringify({ token: session.token, refreshToken: session.refreshToken }))
  const r = await fetch(`${BASE}/web-api/${path}`, {
    headers: {
      "User-Agent": UA,
      Accept: "*/*",
      Referer: `${BASE}/cuenta/mis-movimientos`,
      Cookie: `VENTAJON_web_auth=${auth}; VENTAJON_web_uuid=${session.uuid}`,
    },
  })
  if (r.status === 204) return null
  if (!r.ok) throw new Error(`Ventajón respondió ${r.status} al pedir los movimientos`)
  return r.json()
}

// Compras cobradas en la tarjeta vinculada (las que en Revolut salen como "Ventajon").
// Se descartan las pagadas con saldo de Ventajón (fundingSource ACCOUNT) y los ingresos de ahorro.
export async function fetchVentajonPurchases(session: Session, months: string[]): Promise<VentajonPurchase[]> {
  const cards: Array<{ panMd5: string }> = (await ventajonGet(session, "cards")) || []
  const out: VentajonPurchase[] = []

  for (const { panMd5 } of cards) {
    for (let i = 0; i < months.length; i += 4) {
      const batches = await Promise.all(
        months.slice(i, i + 4).map(async (month) => {
          const rows: any[] = []
          for (let page = 0; ; page++) {
            const d = await ventajonGet(session, `cards/${panMd5}/transactions?page=${page}&size=30&startDate=${month}-01`)
            if (!d) break
            rows.push(...(d.content || []))
            if (d.last || !d.content?.length) break
          }
          return rows
        })
      )
      for (const tx of batches.flat()) {
        if (tx.type !== "COMPRA" || tx.fundingSource !== "DECOUPLED_CARD") continue
        const concept = cleanVentajonConcept(String(tx.description || ""))
        out.push({
          date: String(tx.date),
          concept,
          amount: Math.abs(Number(tx.amount)),
          category: categorizeVentajonItem(concept),
        })
      }
    }
  }
  return out
}

// Solo el dueño de la app: valida el ID token de Firebase y compara el UID
async function firebaseUid(idToken: string): Promise<string | null> {
  const apiKey = process.env.VITE_FIREBASE_API_KEY
  if (!idToken || !apiKey) return null
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  })
  if (!r.ok) return null
  const d = await r.json()
  return d.users?.[0]?.localId ?? null
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  const { VENTAJON_EMAIL, VENTAJON_PASSWORD, FLUXI_OWNER_UID } = process.env
  if (!VENTAJON_EMAIL || !VENTAJON_PASSWORD || !FLUXI_OWNER_UID) {
    return res.status(500).json({ error: "Falta configurar VENTAJON_EMAIL, VENTAJON_PASSWORD o FLUXI_OWNER_UID en Vercel" })
  }

  const idToken = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "")
  if ((await firebaseUid(idToken)) !== FLUXI_OWNER_UID) {
    return res.status(403).json({ error: "No autorizado" })
  }

  const months: string[] = [...new Set<string>((req.body?.months || []).filter((m: unknown) => /^\d{4}-\d{2}$/.test(String(m))))]
  if (months.length === 0 || months.length > MAX_MONTHS) {
    return res.status(400).json({ error: `Indica entre 1 y ${MAX_MONTHS} meses (AAAA-MM)` })
  }

  try {
    const session = await ventajonLogin(VENTAJON_EMAIL, VENTAJON_PASSWORD)
    const items = await fetchVentajonPurchases(session, months)
    return res.status(200).json({ items, count: items.length })
  } catch (error: any) {
    console.error("Error al sincronizar con Ventajón:", error)
    return res.status(502).json({ error: error?.message || "Error al sincronizar con Ventajón" })
  }
}

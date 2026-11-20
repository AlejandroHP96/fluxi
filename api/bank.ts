import { isOwner } from "./_lib/owner.js"
import { createSession, deleteSession, ebConfig, fetchTransactions, sessionAccounts, startAuth, toExpenses, type PsuHeaders } from "./_lib/enablebanking.js"

export const config = {
  runtime: "nodejs",
}

// Conexión con el banco vía Enable Banking. Una sola función con varias acciones (POST { action, ... }):
//  - auth:         { state }                       -> { url } del banco para autorizar
//  - session:      { code }                        -> sesión con sus cuentas (el cliente la guarda en Firestore)
//  - transactions: { sessionId, accountUids, dateFrom } -> gastos con el formato del CSV de Revolut
//  - disconnect:   { sessionId }                   -> revoca la sesión en Enable Banking
// Solo responde al dueño de la app (FLUXI_OWNER_UID), igual que ventajon-sync.
export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" })

  // Primero quién llama: a un desconocido no se le dice ni qué configuración falta
  const owner = await isOwner(req).catch(() => false)
  if (!owner) return res.status(403).json({ error: "No autorizado" })
  const cfg = ebConfig()
  if (!cfg) {
    return res.status(500).json({ error: "Falta configurar ENABLE_BANKING_APP_ID, ENABLE_BANKING_PRIVATE_KEY o ENABLE_BANKING_REDIRECT_URL en Vercel" })
  }

  // El usuario está delante: se lo decimos al banco para no gastar el cupo de consultas en segundo plano
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim()
  const psu: PsuHeaders = {}
  if (ip) psu["Psu-Ip-Address"] = ip
  if (req.headers["user-agent"]) psu["Psu-User-Agent"] = String(req.headers["user-agent"]).slice(0, 300)

  const body = req.body || {}
  try {
    switch (body.action) {
      case "auth": {
        const state = String(body.state || "")
        if (!/^[\w-]{16,100}$/.test(state)) return res.status(400).json({ error: "state no válido" })
        return res.status(200).json({ url: await startAuth(cfg, state, psu) })
      }
      case "session": {
        const code = String(body.code || "")
        if (!code || code.length > 500) return res.status(400).json({ error: "code no válido" })
        return res.status(200).json(await createSession(cfg, code, psu))
      }
      case "transactions": {
        const sessionId = String(body.sessionId || "")
        const dateFrom = String(body.dateFrom || "")
        const accountUids: string[] = (Array.isArray(body.accountUids) ? body.accountUids : []).map(String).slice(0, 10)
        if (!sessionId || accountUids.length === 0 || !/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
          return res.status(400).json({ error: "Faltan sessionId, accountUids o dateFrom (AAAA-MM-DD)" })
        }
        const allowed = new Set(await sessionAccounts(cfg, sessionId, psu))
        const uids = accountUids.filter((uid) => allowed.has(uid))
        if (uids.length === 0) return res.status(400).json({ error: "Esas cuentas no pertenecen a la conexión con el banco" })
        const lists = await Promise.all(uids.map((uid) => fetchTransactions(cfg, uid, dateFrom, psu)))
        const items = toExpenses(lists.flat())
        return res.status(200).json({ items, count: items.length })
      }
      case "disconnect": {
        const sessionId = String(body.sessionId || "")
        if (!sessionId) return res.status(400).json({ error: "Falta sessionId" })
        await deleteSession(cfg, sessionId)
        return res.status(200).json({ ok: true })
      }
      default:
        return res.status(400).json({ error: "action debe ser auth, session, transactions o disconnect" })
    }
  } catch (error: any) {
    console.error("Error con Enable Banking:", error)
    return res.status(502).json({ error: error?.message || "Error con el banco" })
  }
}

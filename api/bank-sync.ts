import { timingSafeEqual } from "node:crypto"
import { cert, getApps, initializeApp } from "firebase-admin/app"
import { FieldValue, getFirestore } from "firebase-admin/firestore"
import { ebConfig, fetchTransactions, sessionAccounts, toExpenses } from "./_lib/enablebanking.js"
import { planAutoImport, refKey } from "./_lib/bankSync.js"
import type { BudgetCategory, Expense } from "../src/types/budget.js"

export const config = {
  runtime: "nodejs",
}

// Cron diario (vercel.json): trae los gastos de los últimos días del banco conectado y los apunta solos.
// Solo para el dueño (FLUXI_OWNER_UID). Escribe con firebase-admin (cuenta de servicio en FIREBASE_SERVICE_ACCOUNT).
const DAYS_BACK = 10 // margen por si algún día falla el cron o el banco tarda en contabilizar
const DAY_MS = 24 * 60 * 60 * 1000
const dateKey = (ms: number) => new Date(ms).toISOString().slice(0, 10)

function db() {
  if (!getApps().length) initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)) })
  return getFirestore()
}

const sameText = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

export default async function handler(req: any, res: any) {
  // Vercel manda "Authorization: Bearer $CRON_SECRET" en las llamadas del cron
  const secret = process.env.CRON_SECRET
  if (!secret || !sameText(String(req.headers.authorization || ""), `Bearer ${secret}`)) return res.status(401).json({ error: "No autorizado" })
  const uid = process.env.FLUXI_OWNER_UID
  const cfg = ebConfig()
  if (!uid || !cfg || !process.env.FIREBASE_SERVICE_ACCOUNT) {
    return res.status(500).json({ error: "Falta FLUXI_OWNER_UID, FIREBASE_SERVICE_ACCOUNT o la configuración de Enable Banking" })
  }

  try {
    const store = db()
    const settings = (await store.doc(`budgets/${uid}`).get()).data() || {}
    const bank = settings.bank as { sessionId?: string; validUntil?: string } | undefined
    if (!bank?.sessionId || (bank.validUntil && Date.parse(bank.validUntil) <= Date.now())) {
      return res.status(200).json({ skipped: "Sin banco conectado o la conexión caducó" })
    }

    const dateFrom = dateKey(Date.now() - DAYS_BACK * DAY_MS)
    const uids = await sessionAccounts(cfg, bank.sessionId, {})
    const rows = toExpenses((await Promise.all(uids.map((a) => fetchTransactions(cfg, a, dateFrom, {})))).flat())

    // Todo en una transacción: si coinciden dos ejecuciones, la segunda se repite y ve lo que apuntó la primera.
    // bankImports/{uid} guarda los movimientos ya vistos (solo lo usa el servidor: las reglas no lo abren al cliente)
    const added = await store.runTransaction(async (tx) => {
      const ledgerRef = store.doc(`bankImports/${uid}`)
      const seen = ((await tx.get(ledgerRef)).data()?.seen || {}) as Record<string, string>
      // Gastos ya apuntados cerca de esas fechas (±3 días). La fecha se filtra aquí y no en la consulta,
      // que si no pediría un índice compuesto
      const since = dateKey(Date.now() - (DAYS_BACK + 3) * DAY_MS)
      const snap = await tx.get(store.collection("expenses").where("userId", "==", uid))
      const existing = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Expense)
        .filter((e) => typeof e.date === "string" && e.date >= since)

      const toAdd = planAutoImport(rows, existing, settings.memory || {}, (settings.categories as BudgetCategory[]) || [], seen)
      for (const e of toAdd) {
        tx.create(store.collection("expenses").doc(), { ...e, userId: uid, createdAt: FieldValue.serverTimestamp() })
      }
      // Todo lo traído queda visto (también lo omitido o ya apuntado); lo anterior a la ventana ya no hace falta
      const next: Record<string, string> = {}
      for (const [k, d] of Object.entries(seen)) if (d >= since) next[k] = d
      for (const r of rows) next[refKey(r.ref)] = r.date
      tx.set(ledgerRef, { seen: next })
      return toAdd.length
    })
    return res.status(200).json({ fetched: rows.length, added })
  } catch (error: any) {
    console.error("Error en la importación automática:", error)
    return res.status(502).json({ error: error?.message || "Error en la importación automática" })
  }
}

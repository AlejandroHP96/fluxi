import webpush from "web-push"
import type { Expense } from "../../src/types/budget.js"
import { fromFields, gfetch } from "./google.js"
import { alertMessage, pendingAlerts, type AlertBudget } from "./alerts.js"

interface PushSub {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

// Avisos en el móvil: si algún sobre del mes en curso ha llegado al 80 %, se apunta como avisado
// (budgets/{owner}.alerts) y se manda una notificación a todos los dispositivos suscritos de ese presupuesto
// (pushSubs/{uid} con budget = owner). Las suscripciones caducadas se quitan.
// Variables de Vercel: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY y VAPID_SUBJECT (URL de la app)
export async function sendBudgetAlerts(token: string, docs: string, owner: string, month: string, expenses: Expense[], budget: AlertBudget) {
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return 0
  const alerts = pendingAlerts(month, expenses, budget)
  if (!alerts.length) return 0

  // Primero se marca como avisado: si dos llamadas coinciden, como mucho se repite un aviso (nunca se pierde el registro)
  const sent = [...(budget.alerts?.[month] ?? []), ...alerts.map((a) => a.categoryId)]
  await gfetch(token, `${docs}/budgets/${encodeURIComponent(owner)}?updateMask.fieldPaths=${encodeURIComponent(`alerts.\`${month}\``)}`, {
    method: "PATCH",
    body: { fields: { alerts: { mapValue: { fields: { [month]: { arrayValue: { values: sent.map((s) => ({ stringValue: s })) } } } } } } },
  })

  const found = await gfetch<Array<{ document?: { name: string; fields?: Record<string, never> } }>>(token, `${docs}:runQuery`, {
    method: "POST",
    body: {
      structuredQuery: {
        from: [{ collectionId: "pushSubs" }],
        where: { fieldFilter: { field: { fieldPath: "budget" }, op: "EQUAL", value: { stringValue: owner } } },
      },
    },
  })

  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://finance-dashboard-drab-theta-85.vercel.app", pub, priv)
  let delivered = 0
  for (const r of found) {
    if (!r.document) continue
    const subs = (fromFields(r.document.fields).subs ?? {}) as Record<string, PushSub>
    const gone: string[] = []
    for (const [key, sub] of Object.entries(subs)) {
      for (const a of alerts) {
        try {
          await webpush.sendNotification(sub, JSON.stringify({ ...alertMessage(a), url: "/", tag: `sobre-${a.categoryId}` }), { TTL: 86400 })
          delivered++
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode
          if (status === 404 || status === 410) {
            gone.push(key)
            break
          }
          console.error("push", status, (e as Error).message)
        }
      }
    }
    // Quitar las caducadas: con la máscara y sin el campo en el cuerpo, Firestore lo borra
    if (gone.length) {
      const mask = gone.map((k) => `updateMask.fieldPaths=${encodeURIComponent(`subs.\`${k}\``)}`).join("&")
      await gfetch(token, `https://firestore.googleapis.com/v1/${r.document.name}?${mask}`, { method: "PATCH", body: { fields: {} } }).catch(() => {})
    }
  }
  return delivered
}

import { deleteField, doc, setDoc } from "firebase/firestore"
import { db } from "../lib/firebase"

// Avisos en el móvil (sobre al 80 %): suscripción push del navegador guardada en pushSubs/{uid}.subs[clave],
// con el presupuesto al que pertenece. El servidor (api/_lib/push.ts) manda los avisos.
// En iPhone solo funciona con la app instalada en la pantalla de inicio (iOS 16.4 o posterior)
const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export const pushSupported = () =>
  !!VAPID && typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window

// Clave corta y estable del dispositivo (a partir del endpoint), válida como nombre de campo de Firestore
const keyOf = (endpoint: string) => {
  let h = 5381
  for (let i = 0; i < endpoint.length; i++) h = ((h * 33) ^ endpoint.charCodeAt(i)) >>> 0
  return `d${h.toString(36)}`
}

const toKey = (b64: string) => {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"))
  return Uint8Array.from(s, (c) => c.charCodeAt(0))
}

async function current() {
  const reg = await navigator.serviceWorker.ready
  return { reg, sub: await reg.pushManager.getSubscription() }
}

// ¿Este dispositivo tiene los avisos activados?
export async function pushEnabled(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== "granted") return false
  return !!(await current()).sub
}

export async function enablePush(uid: string, budget: string): Promise<void> {
  if (!pushSupported()) throw new Error("Este navegador no admite avisos")
  if ((await Notification.requestPermission()) !== "granted") throw new Error("Sin permiso para avisos")
  const { reg, sub: old } = await current()
  const sub = old ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(VAPID!) }))
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
  await setDoc(doc(db, "pushSubs", uid), { budget, subs: { [keyOf(json.endpoint)]: { endpoint: json.endpoint, keys: json.keys } } }, { merge: true })
}

export async function disablePush(uid: string): Promise<void> {
  const { sub } = await current()
  if (!sub) return
  await setDoc(doc(db, "pushSubs", uid), { subs: { [keyOf(sub.endpoint)]: deleteField() } }, { merge: true }).catch(() => {})
  await sub.unsubscribe()
}

import { auth } from "../lib/firebase"

// El Seguimiento de Google Sheets se rehace solo cada vez que se apunta, cambia o borra un gasto.
// Se espera unos segundos para juntar varios cambios seguidos en una sola actualización por mes, y los meses
// van de uno en uno (dos a la vez sobre la misma hoja chocarían al recrear la pestaña). Si falla no se avisa:
// el cron del lunes lo vuelve a poner al día
const WAIT_MS = 4000
const pending = new Set<string>()
let timer: ReturnType<typeof setTimeout> | null = null
let running = false

async function refresh(month: string) {
  const user = auth.currentUser
  if (!user) return
  const r = await fetch(`/api/seguimiento?month=${encodeURIComponent(month)}`, {
    headers: { Authorization: `Bearer ${await user.getIdToken()}` },
  })
  if (!r.ok) throw new Error(`Error ${r.status}`)
}

async function flush() {
  timer = null
  if (running) return void (timer = setTimeout(flush, WAIT_MS))
  running = true
  try {
    while (pending.size) {
      const month = pending.values().next().value as string
      pending.delete(month)
      await refresh(month).catch((e) => console.warn("Seguimiento sin actualizar:", month, e))
    }
  } finally {
    running = false
  }
}

// Meses (YYYY-MM) de los gastos que acaban de cambiar
export function queueSeguimiento(...months: Array<string | undefined>) {
  for (const m of months) if (m && /^\d{4}-\d{2}$/.test(m)) pending.add(m)
  if (!pending.size) return
  if (timer) clearTimeout(timer)
  timer = setTimeout(flush, WAIT_MS)
}

import {
  collection, query, where, getDocs, writeBatch, doc,
} from "firebase/firestore"
import { db } from "./firebase"
import { DEMO_UID } from "../constants/demo"
import type { NewTransaction } from "../types"

const pad = (n: number) => String(n).padStart(2, "0")

/** Datos de ejemplo de mayo a noviembre de 2026 (importes deterministas). */
export const buildDemoTransactions = (): NewTransaction[] => {
  const today = new Date("2026-11-04T12:00:00Z")
  let seed = 7
  const rnd = (min: number, max: number) => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return Math.round((min + (seed / 0x7fffffff) * (max - min)) * 100) / 100
  }
  const out: NewTransaction[] = []
  const add = (m: number, d: number, description: string, category: string, type: NewTransaction["type"], amount: number) => {
    const date = `2026-${pad(m)}-${pad(d)}`
    if (new Date(`${date}T12:00:00Z`) > today) return
    out.push({ description, category, type, amount, date })
  }

  for (let m = 5; m <= 11; m++) {
    add(m, 1, "Alquiler", "Vivienda", "expense", 680)
    add(m, 2, "Gimnasio", "Salud", "expense", 35)
    add(m, 3, "Netflix", "Suscripciones", "expense", 13.99)
    add(m, 3, "Spotify", "Suscripciones", "expense", 10.99)
    add(m, 5, "Internet", "Suministros", "expense", 39.9)
    add(m, 8, "Factura de luz", "Suministros", "expense", rnd(52, 88))
    add(m, 10, "Agua", "Suministros", "expense", rnd(18, 30))
    add(m, 6, "Mercadona", "Alimentación", "expense", rnd(58, 92))
    add(m, 13, "Mercadona", "Alimentación", "expense", rnd(45, 85))
    add(m, 20, "Mercadona", "Alimentación", "expense", rnd(50, 90))
    add(m, 27, "Mercadona", "Alimentación", "expense", rnd(55, 95))
    add(m, 9, "Gasolina", "Transporte", "expense", rnd(42, 62))
    add(m, 23, "Gasolina", "Transporte", "expense", rnd(40, 60))
    add(m, 15, "Cena con amigos", "Ocio", "expense", rnd(24, 48))
    add(m, 22, "Cine", "Ocio", "expense", rnd(12, 22))
    add(m, 18, "Ropa", "Compras", "expense", rnd(35, 75))
    add(m, 25, "Nómina empresa", "Ingresos", "income", 2350)
  }
  add(5, 12, "Proyecto freelance web", "Ingresos", "income", 600)
  add(7, 12, "Proyecto freelance web", "Ingresos", "income", 850)
  add(10, 12, "Proyecto freelance web", "Ingresos", "income", 720)
  add(6, 30, "Regalo de cumpleaños", "Otro", "expense", 40)
  add(7, 14, "Concierto", "Ocio", "expense", 58)
  add(8, 8, "Vacaciones: billetes", "Transporte", "expense", 189)
  add(9, 20, "Amazon", "Compras", "expense", 24.99)
  add(10, 30, "Farmacia", "Salud", "expense", 17.4)
  return out
}

/** Borra los datos de la cuenta de demostración y los vuelve a crear. Solo lo usa la cuenta admin. */
export const resetDemoData = async (): Promise<void> => {
  const snap = await getDocs(query(collection(db, "transactions"), where("userId", "==", DEMO_UID)))
  const ops: Array<(b: ReturnType<typeof writeBatch>) => void> = []
  snap.docs.forEach((d) => ops.push((b) => b.delete(d.ref)))
  buildDemoTransactions().forEach((t) => {
    const ref = doc(collection(db, "transactions"))
    ops.push((b) => b.set(ref, { ...t, userId: DEMO_UID, createdAt: new Date() }))
  })

  // Firestore admite hasta 500 operaciones por lote
  for (let i = 0; i < ops.length; i += 450) {
    const batch = writeBatch(db)
    ops.slice(i, i + 450).forEach((op) => op(batch))
    await batch.commit()
  }
}

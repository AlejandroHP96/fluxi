import { useEffect, useRef, useState } from "react"
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from "firebase/firestore"
import { db } from "../lib/firebase"
import { DEMO_UID } from "../constants/demo"
import { toDateKey, toMonthKey } from "../utils/month"
import type { BudgetHistory, Expense, NewExpense } from "../types/budget"
import type { CategoryMemory } from "../utils/importQueue"

// Gastos del usuario (colección "expenses") y su presupuesto mensual (documento budgets/{uid})
export const useBudget = (userId: string | undefined) => {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [history, setHistory] = useState<BudgetHistory>({})
  const [memory, setMemory] = useState<CategoryMemory>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const demoSeeded = useRef(false)

  useEffect(() => {
    if (!userId) return
    let pending = 2
    const done = () => {
      pending -= 1
      if (pending <= 0) setLoading(false)
    }
    const onErr = (e: Error) => {
      setError(e.message)
      done()
    }

    const unsubExpenses = onSnapshot(query(collection(db, "expenses"), where("userId", "==", userId)), (s) => {
      const list = s.docs
        .map((d) => {
          const data = d.data()
          return {
            id: d.id,
            userId: data.userId,
            amount: Number(data.amount),
            concept: data.concept,
            category: data.category,
            date: data.date,
            _created: data.createdAt?.seconds ?? Number.MAX_SAFE_INTEGER, // recién creado (pendiente) = el más nuevo
          }
        })
        // Más recientes primero; dentro del mismo día, el último que se apuntó arriba
        .sort((a, b) => b.date.localeCompare(a.date) || b._created - a._created)
        .map(({ _created: _, ...e }) => e as Expense)
      setExpenses(list)
      done()
      // La cuenta demo («Entrar como Tester») se rellena con gastos de ejemplo si está vacía
      if (userId === DEMO_UID && list.length === 0 && !s.metadata.fromCache && !demoSeeded.current) {
        demoSeeded.current = true
        void seedDemo(userId)
      }
    }, onErr)

    const unsubBudget = onSnapshot(doc(db, "budgets", userId), (s) => {
      setHistory((s.data()?.history as BudgetHistory | undefined) ?? {})
      setMemory((s.data()?.memory as CategoryMemory | undefined) ?? {})
      done()
    }, onErr)

    return () => {
      unsubExpenses()
      unsubBudget()
    }
  }, [userId])

  const run = async (fn: () => Promise<unknown>): Promise<boolean> => {
    try {
      await fn()
      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    }
  }

  // Devuelve el id del gasto creado (o null si falla), para poder deshacerlo
  const addExpense = async (e: NewExpense): Promise<string | null> => {
    try {
      const ref = await addDoc(collection(db, "expenses"), { ...e, amount: Math.abs(Number(e.amount)), userId, createdAt: serverTimestamp() })
      return ref.id
    } catch (err) {
      setError((err as Error).message)
      return null
    }
  }

  const updateExpense = (id: string, e: NewExpense) =>
    run(() => updateDoc(doc(db, "expenses", id), { ...e, amount: Math.abs(Number(e.amount)) }))

  const deleteExpense = (id: string) => run(() => deleteDoc(doc(db, "expenses", id)))

  // Fija el presupuesto desde `month` (incluido) hasta el siguiente cambio; los meses anteriores no cambian
  const setBudget = (month: string, amount: number) =>
    run(() => setDoc(doc(db, "budgets", userId!), { userId, history: { ...history, [month]: amount } }, { mergeFields: ["userId", "history"] }))

  // Recuerda la categoría (o SKIP) elegida para un concepto al importar. merge: true fusiona el mapa,
  // así varias elecciones seguidas no se pisan aunque el estado local aún no se haya actualizado
  const remember = (key: string, choice: string) =>
    run(() => setDoc(doc(db, "budgets", userId!), { userId, memory: { [key]: choice } }, { merge: true }))

  return { expenses, history, memory, loading, error, addExpense, updateExpense, deleteExpense, setBudget, remember }
}

export type BudgetApi = ReturnType<typeof useBudget>

// Datos de ejemplo de la demo: presupuesto de 1.200 € y gastos repartidos en lo que va de mes
async function seedDemo(userId: string) {
  const today = new Date()
  const day = today.getDate()
  const sample: Array<[number, string, string, number]> = [
    [1, "Alquiler (parte)", "Vivienda", 450],
    [2, "Mercadona", "Alimentación", 62.4],
    [3, "Gasolina", "Transporte", 40],
    [5, "Spotify", "Suscripciones", 10.99],
    [6, "Cena con amigos", "Ocio", 28.5],
    [8, "Mercadona", "Alimentación", 48.15],
    [10, "Farmacia", "Salud", 12.3],
    [12, "Luz", "Suministros", 54.2],
    [14, "Cine", "Ocio", 18],
    [16, "Lidl", "Alimentación", 35.6],
    [19, "Zapatillas", "Compras", 59.99],
    [21, "Gasolina", "Transporte", 38],
    [24, "Mercadona", "Alimentación", 51.8],
    [27, "Café y desayuno", "Ocio", 7.5],
  ]
  const batch = writeBatch(db)
  for (const [d, concept, category, amount] of sample) {
    if (d > day) continue
    const date = toDateKey(new Date(today.getFullYear(), today.getMonth(), d))
    batch.set(doc(collection(db, "expenses")), { userId, concept, category, amount, date, createdAt: serverTimestamp() })
  }
  batch.set(doc(db, "budgets", userId), { userId, history: { [toMonthKey(today)]: 1200 } }, { merge: true })
  await batch.commit().catch(() => {})
}

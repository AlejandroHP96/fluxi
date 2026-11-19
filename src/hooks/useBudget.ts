import { useEffect, useRef, useState } from "react"
import {
  addDoc, collection, deleteDoc, deleteField, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from "firebase/firestore"
import { db } from "../lib/firebase"
import { DEMO_UID } from "../constants/demo"
import { newCategoryId, toDateKey, toMonthKey } from "../utils/month"
import type { BudgetCategory, Expense, NewExpense } from "../types/budget"
import type { CategoryMemory } from "../utils/importQueue"

// Gastos (colección "expenses") y ajustes del usuario en budgets/{uid}: categorías con %, nómina de cada
// mes y la memoria de categorías elegidas al importar
export const useBudget = (userId: string | undefined) => {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<BudgetCategory[]>([])
  const [income, setIncomeMap] = useState<Record<string, number>>({})
  const [memory, setMemory] = useState<CategoryMemory>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const demoSeeded = useRef(false)

  useEffect(() => {
    if (!userId) return
    // "Cargando" termina con la primera lectura de cada fuente (aunque venga de la caché local);
    // la demo solo se rellena cuando el servidor confirma que está vacía
    const loaded = { expenses: false, settings: false }
    const server: { expenses: boolean | null; settings: boolean | null } = { expenses: null, settings: null } // ¿vacío?
    const markLoaded = (k: "expenses" | "settings") => {
      loaded[k] = true
      if (loaded.expenses && loaded.settings) setLoading(false)
    }
    const maybeSeedDemo = () => {
      if (userId === DEMO_UID && server.expenses && server.settings && !demoSeeded.current) {
        demoSeeded.current = true
        void seedDemo(userId)
      }
    }
    const onErr = (k: "expenses" | "settings") => (e: Error) => {
      setError(e.message)
      markLoaded(k)
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
      markLoaded("expenses")
      if (server.expenses === null && !s.metadata.fromCache) {
        server.expenses = list.length === 0
        maybeSeedDemo()
      }
    }, onErr("expenses"))

    const unsubSettings = onSnapshot(doc(db, "budgets", userId), (s) => {
      const data = s.data()
      setCategories((data?.categories as BudgetCategory[] | undefined) ?? [])
      setIncomeMap((data?.income as Record<string, number> | undefined) ?? {})
      setMemory((data?.memory as CategoryMemory | undefined) ?? {})
      markLoaded("settings")
      if (server.settings === null && !s.metadata.fromCache) {
        server.settings = !data?.categories?.length
        maybeSeedDemo()
      }
    }, onErr("settings"))

    return () => {
      unsubExpenses()
      unsubSettings()
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
  const settingsRef = () => doc(db, "budgets", userId!)

  // ── Gastos ──
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

  // Mover gastos a otra categoría (p. ej. al borrar una categoría)
  const reassignExpenses = (ids: string[], categoryId: string) =>
    run(async () => {
      for (let i = 0; i < ids.length; i += 400) {
        const batch = writeBatch(db)
        for (const id of ids.slice(i, i + 400)) batch.update(doc(db, "expenses", id), { category: categoryId })
        await batch.commit()
      }
    })

  // ── Nómina y categorías ──
  // Nómina de un mes; null la quita
  const setIncome = (month: string, amount: number | null) =>
    run(() => setDoc(settingsRef(), { userId, income: { [month]: amount === null ? deleteField() : amount } }, { merge: true }))

  // Guarda la lista completa de categorías (orden, nombres, % y ahorro). Un único reparto para todos los meses
  const saveCategories = (list: BudgetCategory[]) =>
    run(() => setDoc(settingsRef(), {
      userId,
      categories: list.map((c) => ({ id: c.id || newCategoryId(), name: c.name.trim(), pct: Number(c.pct) || 0, savings: Boolean(c.savings) })),
    }, { merge: true }))

  // Recuerda la categoría (id) o SKIP elegida para un concepto al importar. merge: true fusiona el mapa,
  // así varias elecciones seguidas no se pisan aunque el estado local aún no se haya actualizado
  const remember = (key: string, choice: string) =>
    run(() => setDoc(settingsRef(), { userId, memory: { [key]: choice } }, { merge: true }))

  return {
    expenses, categories, income, memory, loading, error,
    addExpense, updateExpense, deleteExpense, reassignExpenses,
    setIncome, saveCategories, remember,
  }
}

export type BudgetApi = ReturnType<typeof useBudget>

// Plantilla que se propone al crear las categorías por primera vez
export const CATEGORY_TEMPLATE: Array<Omit<BudgetCategory, "id">> = [
  { name: "Ahorro", pct: 20, savings: true },
  { name: "Vivienda", pct: 30, savings: false },
  { name: "Alimentación", pct: 20, savings: false },
  { name: "Transporte", pct: 10, savings: false },
  { name: "Ocio", pct: 10, savings: false },
  { name: "Otros", pct: 10, savings: false },
]

// Datos de ejemplo de la demo: nómina de 1.800 €, la plantilla de categorías y gastos en lo que va de mes
async function seedDemo(userId: string) {
  const today = new Date()
  const day = today.getDate()
  const cats = CATEGORY_TEMPLATE.map((c) => ({ ...c, id: newCategoryId() }))
  const idOf = (name: string) => cats.find((c) => c.name === name)!.id
  const sample: Array<[number, string, string, number]> = [
    [1, "Alquiler (parte)", "Vivienda", 450],
    [2, "Mercadona", "Alimentación", 62.4],
    [3, "Gasolina", "Transporte", 40],
    [5, "Spotify", "Ocio", 10.99],
    [6, "Cena con amigos", "Ocio", 28.5],
    [8, "Mercadona", "Alimentación", 48.15],
    [10, "Farmacia", "Otros", 12.3],
    [12, "Luz", "Vivienda", 54.2],
    [14, "Cine", "Ocio", 18],
    [16, "Lidl", "Alimentación", 35.6],
    [19, "Zapatillas", "Otros", 59.99],
    [21, "Gasolina", "Transporte", 38],
    [24, "Mercadona", "Alimentación", 51.8],
    [27, "Café y desayuno", "Ocio", 7.5],
  ]
  const batch = writeBatch(db)
  for (const [d, concept, category, amount] of sample) {
    if (d > day) continue
    const date = toDateKey(new Date(today.getFullYear(), today.getMonth(), d))
    batch.set(doc(collection(db, "expenses")), { userId, concept, category: idOf(category), amount, date, createdAt: serverTimestamp() })
  }
  batch.set(doc(db, "budgets", userId), { userId, categories: cats, income: { [toMonthKey(today)]: 1800 } }, { merge: true })
  await batch.commit().catch(() => {})
}

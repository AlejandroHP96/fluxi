import { useEffect, useState } from "react"
import {
  addDoc, collection, deleteField, doc, getDoc, getDocsFromServer, onSnapshot, query, runTransaction, serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from "firebase/firestore"
import type { Transaction } from "firebase/firestore"
import { db } from "../lib/firebase"
import { DEMO_UID } from "../constants/demo"
import { newCategoryId, toDateKey, toMonthKey } from "../utils/month"
import type { BudgetCategory, Carry, Expense, FixedExpense, Members, NewExpense, Refund, SavingsGoal, Themes, Wallet } from "../types/budget"
import { syncRefundMoves } from "../utils/wallet"
import { queueSeguimiento } from "../utils/seguimientoClient"

// Categoría lista para guardar: los sobres en € llevan amount (y pct 0); los de % no llevan la clave
// (Firestore no admite campos undefined)
const cleanCategory = (c: BudgetCategory): BudgetCategory => {
  const base = { id: c.id || newCategoryId(), name: c.name.trim(), pct: Number(c.pct) || 0, savings: Boolean(c.savings) }
  return typeof c.amount === "number" ? { ...base, pct: 0, amount: Math.max(0, Math.round(c.amount * 100) / 100) } : base
}

// Gastos (colección "expenses") y ajustes del presupuesto en budgets/{uid}: categorías, nómina de cada mes,
// gastos fijos y cartera. authUid es quien ha iniciado sesión; el presupuesto
// es el suyo o, si su cuenta está enlazada a otra (links/{uid}), el de esa otra cuenta
const useFirestoreBudget = (authUid: string | undefined) => {
  // Qué presupuesto se carga: nunca el propio por descarte. Solo el que confirma el servidor (links/{uid}) o el
  // que se resolvió la última vez en este dispositivo; mientras tanto se espera (si no, una miembro con mala
  // conexión veía su presupuesto vacío y la bienvenida en vez del compartido)
  // confirmed: lo ha dicho el servidor (no la caché ni lo recordado)
  const [link, setLink] = useState<{ uid: string; budget: string | null; confirmed: boolean } | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)
  useEffect(() => {
    setLink(null)
    setLinkError(null)
    if (!authUid) return
    const key = `fluxi:budget:${authUid}`
    let remembered: string | null = null
    try { remembered = localStorage.getItem(key) } catch { /* sin almacenamiento */ }
    const use = (budget: string | null, confirmed: boolean) =>
      setLink({ uid: authUid, budget: budget === authUid ? null : budget, confirmed })
    return onSnapshot(
      doc(db, "links", authUid),
      { includeMetadataChanges: true },
      (s) => {
        // «No hay enlace» sacado de la caché no vale (puede estar desfasado): lo recordado o esperar al servidor
        if (!s.exists() && s.metadata.fromCache) {
          if (remembered) use(remembered, false)
          return
        }
        const budget = (s.data()?.budget as string | undefined) ?? null
        try { localStorage.setItem(key, budget ?? authUid) } catch { /* sin almacenamiento */ }
        use(budget, !s.metadata.fromCache)
      },
      (e) => setLinkError(`No se ha podido saber qué presupuesto cargar (${e.message}). Recarga la app.`)
    )
  }, [authUid])
  // uid del presupuesto (el dueño); undefined mientras se resuelve el enlace
  const userId = authUid && link?.uid === authUid ? (link.budget ?? authUid) : undefined

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<BudgetCategory[]>([])
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([])
  const [income, setIncomeMap] = useState<Record<string, number>>({})
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [members, setMembers] = useState<Members>({})
  const [themes, setThemes] = useState<Themes>({})
  const [carry, setCarry] = useState<Carry>({})
  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Al cambiar de usuario (o salir) no se enseñan los datos del anterior
    setExpenses([])
    setCategories([])
    setFixedExpenses([])
    setIncomeMap({})
    setWallet(null)
    setMembers({})
    setThemes({})
    setCarry({})
    setGoals([])
    setError(null)
    setLoading(true)
    if (!userId) return
    // "Cargando" termina con la primera lectura de cada fuente (aunque venga de la caché local)
    const loaded = { expenses: false, settings: false }
    const markLoaded = (k: "expenses" | "settings") => {
      loaded[k] = true
      if (loaded.expenses && loaded.settings) setLoading(false)
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
            ...(Array.isArray(data.refunds) && data.refunds.length ? { refunds: data.refunds as Refund[] } : {}),
            ...(typeof data.createdBy === "string" ? { createdBy: data.createdBy } : {}),
            ...(typeof data.updatedBy === "string" ? { updatedBy: data.updatedBy } : {}),
            ...(data.receipt === true ? { receipt: true } : {}),
            _created: data.createdAt?.seconds ?? Number.MAX_SAFE_INTEGER, // recién creado (pendiente) = el más nuevo
          }
        })
        // Más recientes primero; dentro del mismo día, el último que se apuntó arriba
        .sort((a, b) => b.date.localeCompare(a.date) || b._created - a._created)
        .map(({ _created: _, ...e }) => e as Expense)
      setExpenses(list)
      markLoaded("expenses")
    }, onErr("expenses"))

    const unsubSettings = onSnapshot(doc(db, "budgets", userId), (s) => {
      const data = s.data()
      setCategories((data?.categories as BudgetCategory[] | undefined) ?? [])
      setFixedExpenses((data?.fixedExpenses as FixedExpense[] | undefined) ?? [])
      setIncomeMap((data?.income as Record<string, number> | undefined) ?? {})
      setWallet((data?.wallet as Wallet | undefined) ?? null)
      setMembers((data?.members as Members | undefined) ?? {})
      setThemes((data?.themes as Themes | undefined) ?? {})
      setCarry((data?.carry as Carry | undefined) ?? {})
      setGoals((data?.goals as SavingsGoal[] | undefined) ?? [])
      markLoaded("settings")
    }, onErr("settings"))

    return () => {
      unsubExpenses()
      unsubSettings()
    }
  }, [userId])

  // Sin presupuesto resuelto todavía no se escribe nada (se ignora en vez de fallar)
  const run = async (fn: () => Promise<unknown>): Promise<boolean> => {
    if (!userId) return false
    try {
      await fn()
      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    }
  }
  const settingsRef = () => doc(db, "budgets", userId!)
  // Tras cambiar gastos, el Seguimiento de Google Sheets de su mes (o meses) se pone al día solo
  const monthOf = (id: string) => expenses.find((x) => x.id === id)?.date.slice(0, 7)
  const synced = async (ok: Promise<boolean>, ...months: Array<string | undefined>) => {
    if (await ok) queueSeguimiento(...months)
    return ok
  }

  // ── Gastos ──
  // Devuelve el id del gasto creado (o null si falla), para poder deshacerlo
  const addExpense = async (e: NewExpense): Promise<string | null> => {
    if (!userId) return null
    try {
      const ref = await addDoc(collection(db, "expenses"), { ...e, amount: Math.abs(Number(e.amount)), userId, createdBy: authUid, updatedBy: authUid, createdAt: serverTimestamp() })
      queueSeguimiento(e.date.slice(0, 7))
      return ref.id
    } catch (err) {
      setError((err as Error).message)
      return null
    }
  }

  const updateExpense = (id: string, e: NewExpense) =>
    synced(run(() => updateDoc(doc(db, "expenses", id), { ...e, amount: Math.abs(Number(e.amount)), updatedBy: authUid })), monthOf(id), e.date.slice(0, 7))

  // Gasto y cartera en una transacción: se leen del servidor en ese momento, así la cartera no se calcula
  // con un estado desfasado (ni se pisa el saldo si los ajustes aún no habían cargado)
  const withWallet = (expenseId: string, change: (tx: Transaction, e: Expense, w: Wallet | null) => Wallet | null) =>
    run(() =>
      runTransaction(db, async (tx) => {
        const snap = await tx.get(doc(db, "expenses", expenseId))
        const settings = await tx.get(settingsRef())
        if (!snap.exists()) throw new Error("Ese gasto ya no existe")
        const e = { id: snap.id, ...snap.data() } as Expense
        const next = change(tx, e, (settings.data()?.wallet as Wallet | undefined) ?? null)
        if (next) tx.set(settingsRef(), { userId, wallet: next }, { merge: true })
      })
    )

  // Al borrar un gasto se quitan también de la cartera los movimientos de sus devoluciones
  const deleteExpense = (id: string) => {
    const e = expenses.find((x) => x.id === id)
    if (!e?.refunds?.some((r) => r.toWallet)) {
      return synced(run(async () => {
        const batch = writeBatch(db)
        batch.delete(doc(db, "expenses", id))
        if (e?.receipt) batch.delete(doc(db, "receipts", id))
        await batch.commit()
      }), monthOf(id))
    }
    return synced(withWallet(id, (tx, fresh, w) => {
      tx.delete(doc(db, "expenses", id))
      if (fresh.receipt) tx.delete(doc(db, "receipts", id))
      return fresh.refunds?.some((r) => r.toWallet) ? syncRefundMoves(w, fresh.refunds, [], fresh.concept) : null
    }), monthOf(id))
  }

  // Devoluciones de un gasto (lista completa). Las que van a la cartera se reflejan en ella en la misma transacción
  const saveRefunds = (e: Expense, refunds: Refund[]) =>
    synced(withWallet(e.id, (tx, fresh, w) => {
      tx.update(doc(db, "expenses", e.id), { refunds, updatedBy: authUid })
      const old = fresh.refunds ?? []
      return [...old, ...refunds].some((r) => r.toWallet) ? syncRefundMoves(w, old, refunds, fresh.concept) : null
    }), e.date.slice(0, 7))

  // Foto del ticket de un gasto (JPEG en data URL, ya reducida) en receipts/{id}; null la quita
  const saveReceipt = (id: string, data: string | null) =>
    run(async () => {
      const batch = writeBatch(db)
      if (data) batch.set(doc(db, "receipts", id), { userId, data, createdBy: authUid })
      else batch.delete(doc(db, "receipts", id))
      batch.update(doc(db, "expenses", id), { receipt: data ? true : deleteField(), updatedBy: authUid })
      await batch.commit()
    })
  const loadReceipt = async (id: string): Promise<string | null> => {
    try {
      const s = await getDoc(doc(db, "receipts", id))
      return (s.data()?.data as string | undefined) ?? null
    } catch {
      return null
    }
  }

  // Pasar lo que sobró de un sobre al mes siguiente (month = el que lo recibe); null lo deshace
  const saveCarry = (month: string, categoryId: string, amount: number | null) =>
    run(() => setDoc(settingsRef(), {
      userId,
      carry: { [month]: { [categoryId]: amount === null ? deleteField() : Math.round(amount * 100) / 100 } },
    }, { merge: true }))

  // Metas de ahorro (lista completa)
  const saveGoals = (list: SavingsGoal[]) =>
    run(() => setDoc(settingsRef(), {
      userId,
      goals: list.map((g) => ({
        id: g.id || newCategoryId(), name: g.name.trim().slice(0, 60),
        target: Math.max(0, Math.round(Number(g.target) * 100) / 100) || 0,
        saved: Math.max(0, Math.round(Number(g.saved) * 100) / 100) || 0,
        ...(g.month ? { month: g.month } : {}),
      })),
    }, { merge: true }))

  // Cartera de ahorros completa (saldo inicial y movimientos)
  const saveWallet = (w: Wallet) => run(() => setDoc(settingsRef(), { userId, wallet: w }, { merge: true }))

  // Mover gastos a otra categoría (p. ej. al borrar una categoría)
  const reassignExpenses = (ids: string[], categoryId: string) =>
    synced(run(async () => {
      for (let i = 0; i < ids.length; i += 400) {
        const batch = writeBatch(db)
        for (const id of ids.slice(i, i + 400)) batch.update(doc(db, "expenses", id), { category: categoryId, updatedBy: authUid })
        await batch.commit()
      }
    }), ...ids.map(monthOf))

  // ── Nómina y categorías ──
  // Nómina de un mes; null la quita
  const setIncome = (month: string, amount: number | null) =>
    run(() => setDoc(settingsRef(), { userId, income: { [month]: amount === null ? deleteField() : amount } }, { merge: true }))

  // Guarda la lista completa de categorías (orden, nombres, % y ahorro). Un único reparto para todos los meses
  const saveCategories = (list: BudgetCategory[]) =>
    run(() => setDoc(settingsRef(), {
      userId,
      categories: list.map(cleanCategory),
    }, { merge: true }))

  // Guarda la lista completa de gastos fijos mensuales (nombre e importe en €)
  const saveFixedExpenses = (list: FixedExpense[]) =>
    run(() => setDoc(settingsRef(), {
      userId,
      fixedExpenses: list.map((f) => ({ id: f.id || newCategoryId(), name: f.name.trim(), amount: Math.abs(Number(f.amount)) || 0 })),
    }, { merge: true }))

  // Tema de color de quien ha iniciado sesión (solo el suyo: las reglas no dejan tocar el de otro)
  const saveTheme = (id: string) =>
    run(() => setDoc(settingsRef(), { userId, themes: { [authUid!]: id } }, { merge: true }))

  // Empezar de cero: borra todos los gastos y vacía los ajustes (categorías, nóminas, fijos y cartera).
  // Los gastos se piden al servidor (también los que otro miembro acaba de apuntar) y los ajustes se vacían en
  // el primer lote: si eso falla, no se ha borrado nada. members no se toca (solo lo escribe el script)
  const resetAll = () =>
    run(async () => {
      const snap = await getDocsFromServer(query(collection(db, "expenses"), where("userId", "==", userId)))
      // Fotos de tickets incluidas (se borran después de los gastos: sin el gasto ya no se ven)
      const refs = [
        ...snap.docs.map((d) => d.ref),
        ...snap.docs.filter((d) => d.data().receipt === true).map((d) => doc(db, "receipts", d.id)),
      ]
      const batch = writeBatch(db)
      batch.set(settingsRef(), {
        userId, categories: deleteField(), income: deleteField(), fixedExpenses: deleteField(), wallet: deleteField(),
        carry: deleteField(), goals: deleteField(),
      }, { merge: true })
      for (const r of refs.slice(0, 399)) batch.delete(r)
      await batch.commit()
      for (let i = 399; i < refs.length; i += 400) {
        const rest = writeBatch(db)
        for (const r of refs.slice(i, i + 400)) rest.delete(r)
        await rest.commit()
      }
    })

  return {
    expenses, categories, fixedExpenses, income, wallet, loading, error: error ?? linkError,
    // El servidor ha confirmado qué presupuesto es: hasta entonces no se ofrece crear uno (bienvenida)
    budgetConfirmed: !!authUid && link?.uid === authUid && link.confirmed,
    // Presupuesto compartido: miembros (uid -> nombre), quién ha iniciado sesión y si es el dueño
    members, currentUid: authUid ?? null, budgetUid: userId ?? null, isOwner: !!userId && userId === authUid,
    themes, saveTheme, carry, saveCarry, goals, saveGoals, saveReceipt, loadReceipt,
    addExpense, updateExpense, deleteExpense, reassignExpenses, saveRefunds, saveWallet,
    setIncome, saveCategories, saveFixedExpenses, resetAll,
  }
}

export type BudgetApi = ReturnType<typeof useFirestoreBudget>

// Plantilla que se propone al crear las categorías por primera vez
export const CATEGORY_TEMPLATE: Array<Omit<BudgetCategory, "id">> = [
  // Sin sobre de ahorro: el ahorro va en la cartera (tarjeta «Ahorro»), que se lleva a mano
  { name: "Vivienda", pct: 35, savings: false },
  { name: "Alimentación", pct: 25, savings: false },
  { name: "Transporte", pct: 15, savings: false },
  { name: "Ocio", pct: 15, savings: false },
  { name: "Otros", pct: 10, savings: false },
]

// Datos de ejemplo de la demo: nómina de 1.800 €, la plantilla de categorías y gastos en lo que va de mes.
// Se generan cada vez con el mes actual, así la demo nunca sale vacía.
const DEMO_SAMPLE: Array<[number, string, string, number]> = [
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

// Variación del gasto en los 5 meses anteriores (del más antiguo al último), para que el historial no sea plano
const DEMO_PAST_FACTORS = [0.82, 1.08, 0.93, 1.17, 0.88]

function demoData() {
  const today = new Date()
  const categories: BudgetCategory[] = CATEGORY_TEMPLATE.map((c) => ({ ...c, id: newCategoryId() }))
  const idOf = (name: string) => categories.find((c) => c.name === name)!.id
  const expenses: Expense[] = []
  const income: Record<string, number> = {}
  // 5 meses completos anteriores y el mes actual hasta hoy
  for (let back = 5; back >= 0; back--) {
    const first = new Date(today.getFullYear(), today.getMonth() - back, 1)
    const lastDay = back === 0 ? today.getDate() : new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
    const factor = back === 0 ? 1 : DEMO_PAST_FACTORS[5 - back]
    income[toMonthKey(first)] = 1800
    for (const [d, concept, category, amount] of DEMO_SAMPLE) {
      if (d > lastDay) continue
      // Alquiler y suscripciones no cambian; el resto varía con el mes
      const fixed = concept === "Alquiler (parte)" || concept === "Spotify"
      expenses.push({
        id: newCategoryId(),
        userId: DEMO_UID,
        concept,
        category: idOf(category),
        amount: fixed ? amount : Math.round(amount * factor * 100) / 100,
        date: toDateKey(new Date(first.getFullYear(), first.getMonth(), d)),
      })
    }
  }
  expenses.sort((x, y) => y.date.localeCompare(x.date)) // más recientes primero, como la lista real
  return { categories, expenses, income }
}

// Cuenta demo: todo vive en memoria. Se puede probar la app entera, pero nada se guarda en Firestore
// (las reglas además le niegan cualquier escritura) y al recargar vuelve al estado inicial.
const useDemoBudget = (active: boolean): BudgetApi => {
  const [initial] = useState(demoData)
  const [expenses, setExpenses] = useState<Expense[]>(initial.expenses)
  const [categories, setCategories] = useState<BudgetCategory[]>(initial.categories)
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([])
  const [income, setIncomeMap] = useState<Record<string, number>>(initial.income)
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [themes, setThemes] = useState<Themes>({})
  const [carry, setCarry] = useState<Carry>({})
  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [receipts, setReceipts] = useState<Record<string, string>>({})

  // Al entrar de nuevo en la demo se parte de los datos de ejemplo (durante el render, sin un fotograma con lo anterior)
  const [wasActive, setWasActive] = useState(active)
  if (active !== wasActive) {
    setWasActive(active)
    if (active) {
      const d = demoData()
      setExpenses(d.expenses)
      setCategories(d.categories)
      setFixedExpenses([])
      setIncomeMap(d.income)
      setWallet(null)
      setCarry({})
      setGoals([])
      setReceipts({})
    }
  }

  const sortList = (list: Expense[]) => [...list].sort((a, b) => b.date.localeCompare(a.date))
  const ok = async () => true

  return {
    expenses, categories, fixedExpenses, income, wallet, loading: false, error: null,
    members: {}, currentUid: DEMO_UID, budgetUid: DEMO_UID as string | null, isOwner: true, budgetConfirmed: true,
    themes,
    saveTheme: (id: string) => {
      setThemes({ [DEMO_UID]: id })
      return ok()
    },
    carry,
    saveCarry: (month: string, categoryId: string, amount: number | null) => {
      setCarry((c) => {
        const m = { ...(c[month] ?? {}) }
        if (amount === null) delete m[categoryId]
        else m[categoryId] = Math.round(amount * 100) / 100
        return { ...c, [month]: m }
      })
      return ok()
    },
    goals,
    saveGoals: (list: SavingsGoal[]) => {
      setGoals(list.map((g) => ({ ...g, id: g.id || newCategoryId() })))
      return ok()
    },
    saveReceipt: (id: string, data: string | null) => {
      setReceipts((r) => {
        const next = { ...r }
        if (data) next[id] = data
        else delete next[id]
        return next
      })
      setExpenses((l) => l.map((x) => (x.id === id ? { ...x, receipt: data ? true : undefined } : x)))
      return ok()
    },
    loadReceipt: async (id: string) => receipts[id] ?? null,
    addExpense: async (e: NewExpense) => {
      const id = newCategoryId()
      setExpenses((l) => sortList([{ ...e, amount: Math.abs(Number(e.amount)), id, userId: DEMO_UID }, ...l]))
      return id
    },
    updateExpense: (id: string, e: NewExpense) => {
      setExpenses((l) => sortList(l.map((x) => (x.id === id ? { ...x, ...e, amount: Math.abs(Number(e.amount)) } : x))))
      return ok()
    },
    deleteExpense: (id: string) => {
      const e = expenses.find((x) => x.id === id)
      if (e?.refunds?.some((r) => r.toWallet)) setWallet(syncRefundMoves(wallet, e.refunds, [], e.concept))
      setExpenses((l) => l.filter((x) => x.id !== id))
      return ok()
    },
    saveRefunds: (stale: Expense, refunds: Refund[]) => {
      const e = expenses.find((x) => x.id === stale.id) ?? stale // el actual, no la copia de cuando se abrió
      if ([...(e.refunds ?? []), ...refunds].some((r) => r.toWallet)) setWallet(syncRefundMoves(wallet, e.refunds ?? [], refunds, e.concept))
      setExpenses((l) => l.map((x) => (x.id === e.id ? { ...x, refunds } : x)))
      return ok()
    },
    saveWallet: (w: Wallet) => {
      setWallet(w)
      return ok()
    },
    reassignExpenses: (ids: string[], categoryId: string) => {
      const set = new Set(ids)
      setExpenses((l) => l.map((x) => (set.has(x.id) ? { ...x, category: categoryId } : x)))
      return ok()
    },
    setIncome: (month: string, amount: number | null) => {
      setIncomeMap((m) => {
        const next = { ...m }
        if (amount === null) delete next[month]
        else next[month] = amount
        return next
      })
      return ok()
    },
    saveCategories: (list: BudgetCategory[]) => {
      setCategories(list.map(cleanCategory))
      return ok()
    },
    saveFixedExpenses: (list: FixedExpense[]) => {
      setFixedExpenses(list.map((f) => ({ id: f.id || newCategoryId(), name: f.name.trim(), amount: Math.abs(Number(f.amount)) || 0 })))
      return ok()
    },
    resetAll: () => {
      setExpenses([])
      setCategories([])
      setFixedExpenses([])
      setIncomeMap({})
      setWallet(null)
      setCarry({})
      setGoals([])
      setReceipts({})
      return ok()
    },
  }
}

export const useBudget = (userId: string | undefined): BudgetApi => {
  const isDemo = userId === DEMO_UID
  const remote = useFirestoreBudget(isDemo ? undefined : userId)
  const demo = useDemoBudget(isDemo)
  return isDemo ? demo : remote
}

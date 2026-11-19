import { useEffect, useState } from "react"
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, query, setDoc, updateDoc, where, writeBatch,
} from "firebase/firestore"
import { db } from "../lib/firebase"
import type {
  Account, AccountKind, FinanceSettings, Goal, NewGoal, NewTransfer, Transaction, Transfer, TransferKind,
} from "../types"

const DEFAULT_SETTINGS: FinanceSettings = { budgets: {}, ownTransferNames: [], categoryRules: {} }
const REVOLUT_NAMES: Record<Exclude<AccountKind, "manual">, string> = {
  revolut_current: "Conjunta",
  revolut_savings: "Ahorros",
}
// Firestore limita los batches a 500 operaciones
const CHUNK = 400

// Cuentas, traspasos, objetivos y ajustes (presupuestos y nombres de traspaso) del usuario
export const useFinance = (userId: string | undefined) => {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [settings, setSettings] = useState<FinanceSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    let pending = 4
    const done = () => {
      pending -= 1
      if (pending <= 0) setLoading(false)
    }
    const onErr = (e: Error) => {
      setError(e.message)
      done()
    }
    const byUser = (name: string) => query(collection(db, name), where("userId", "==", userId))

    const unsubs = [
      onSnapshot(byUser("accounts"), (s) => {
        setAccounts(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Account).sort((a, b) => a.name.localeCompare(b.name)))
        done()
      }, onErr),
      onSnapshot(byUser("transfers"), (s) => {
        setTransfers(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Transfer).sort((a, b) => b.date.localeCompare(a.date)))
        done()
      }, onErr),
      onSnapshot(byUser("goals"), (s) => {
        setGoals(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Goal))
        done()
      }, onErr),
      onSnapshot(doc(db, "finance", userId), (s) => {
        setSettings({ ...DEFAULT_SETTINGS, ...(s.data() as Partial<FinanceSettings> | undefined) })
        done()
      }, onErr),
    ]
    return () => unsubs.forEach((u) => u())
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

  // ── Cuentas ──
  const addManualAccount = (name: string, balance: number) =>
    run(() => addDoc(collection(db, "accounts"), {
      userId, name, kind: "manual", balance, balanceDate: new Date().toISOString().slice(0, 16).replace("T", " "),
    }))

  // Nombre de cualquier cuenta; saldo solo de las manuales (las de Revolut las fija el CSV)
  const updateAccount = (id: string, changes: { name?: string; balance?: number }) =>
    run(() => updateDoc(doc(db, "accounts", id), {
      ...changes,
      ...(changes.balance !== undefined ? { balanceDate: new Date().toISOString().slice(0, 16).replace("T", " ") } : {}),
    }))

  const deleteAccount = (id: string) => run(() => deleteDoc(doc(db, "accounts", id)))

  // Saldo de Revolut desde el CSV; no se pisa con un CSV más antiguo que el último importado
  const upsertRevolutBalance = async (kind: Exclude<AccountKind, "manual">, balance: number, balanceDate: string) => {
    if (!userId) return false
    const id = `${userId}_${kind}`
    const current = accounts.find((a) => a.id === id)
    if (current && current.balanceDate > balanceDate) return true
    return run(() => setDoc(doc(db, "accounts", id), {
      userId, kind, balance, balanceDate, name: current?.name || REVOLUT_NAMES[kind],
    }))
  }

  // ── Traspasos ──
  const addTransfers = async (items: NewTransfer[]): Promise<number> => {
    if (!userId || items.length === 0) return 0
    let added = 0
    const ok = await run(async () => {
      for (let i = 0; i < items.length; i += CHUNK) {
        const batch = writeBatch(db)
        for (const t of items.slice(i, i + CHUNK)) batch.set(doc(collection(db, "transfers")), { ...t, userId })
        await batch.commit()
        added += Math.min(CHUNK, items.length - i)
      }
    })
    return ok ? added : 0
  }

  // Saca movimientos de Transacciones y los guarda como traspasos (en el mismo batch: o todo o nada)
  const moveTransactionsToTransfers = async (items: Array<{ tx: Transaction; kind: TransferKind }>): Promise<number> => {
    if (!userId || items.length === 0) return 0
    let moved = 0
    const ok = await run(async () => {
      for (let i = 0; i < items.length; i += CHUNK / 2) {
        const batch = writeBatch(db)
        for (const { tx, kind } of items.slice(i, i + CHUNK / 2)) {
          batch.set(doc(collection(db, "transfers")), {
            userId, date: tx.date, amount: Number(tx.amount), kind, description: tx.description,
          })
          batch.delete(doc(db, "transactions", tx.id))
        }
        await batch.commit()
        moved += Math.min(CHUNK / 2, items.length - i)
      }
    })
    return ok ? moved : 0
  }

  // ── Ajustes (finance/{uid}) ──
  const saveSettings = (changes: Partial<FinanceSettings>) =>
    run(() => setDoc(doc(db, "finance", userId!), { userId, ...changes }, { mergeFields: ["userId", ...Object.keys(changes)] }))

  // limit null o 0 = quitar el presupuesto de esa categoría
  const setBudget = (category: string, limit: number | null) => {
    const budgets = { ...settings.budgets }
    if (limit && limit > 0) budgets[category] = limit
    else delete budgets[category]
    return saveSettings({ budgets })
  }

  // Regla propia: los movimientos con este concepto (conceptKey) van a esta categoría; null = quitarla
  const setCategoryRule = (key: string, category: string | null) => {
    const categoryRules = { ...settings.categoryRules }
    if (category) categoryRules[key] = category
    else delete categoryRules[key]
    return saveSettings({ categoryRules })
  }

  const setOwnTransferNames = (names: string[]) =>
    saveSettings({ ownTransferNames: [...new Set(names.map((n) => n.trim()).filter(Boolean))] })

  // ── Objetivos ──
  const addGoal = (goal: NewGoal) => run(() => addDoc(collection(db, "goals"), { ...goal, userId }))
  const updateGoal = (id: string, changes: Partial<NewGoal>) => run(() => updateDoc(doc(db, "goals", id), changes))
  const deleteGoal = (id: string) => run(() => deleteDoc(doc(db, "goals", id)))

  return {
    accounts, transfers, goals, settings, loading, error,
    addManualAccount, updateAccount, deleteAccount, upsertRevolutBalance,
    addTransfers, moveTransactionsToTransfers,
    setBudget, setOwnTransferNames, setCategoryRule,
    addGoal, updateGoal, deleteGoal,
  }
}

export type FinanceApi = ReturnType<typeof useFinance>

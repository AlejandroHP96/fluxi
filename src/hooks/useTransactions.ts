import { useState, useEffect } from "react"
import {
  collection, query, where,
  onSnapshot, addDoc, deleteDoc, updateDoc, doc, serverTimestamp,
} from "firebase/firestore"
import { db } from "../lib/firebase"
import type { Transaction, NewTransaction, Totals } from "../types"

export const useTransactions = (userId: string | undefined) => {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return

    const q = query(
      collection(db, "transactions"),
      where("userId", "==", userId)
    )

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Transaction))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setTransactions(data)
      setLoading(false)
    }, (err) => {
      setError(err.message)
      setLoading(false)
    })

    return () => unsub()
  }, [userId])

  const addTransaction = async (tx: NewTransaction): Promise<boolean> => {
    try {
      await addDoc(collection(db, "transactions"), {
        ...tx,
        userId,
        createdAt: serverTimestamp(),
      })
      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    }
  }

  const addBatchTransactions = async (txs: NewTransaction[]): Promise<number> => {
    if (!userId || txs.length === 0) return 0
    try {
      const { writeBatch } = await import("firebase/firestore")
      // Firebase limita los batches a 500 operaciones
      const chunkSize = 400
      let totalAdded = 0

      for (let i = 0; i < txs.length; i += chunkSize) {
        const chunk = txs.slice(i, i + chunkSize)
        const batch = writeBatch(db)

        for (const tx of chunk) {
          const docRef = doc(collection(db, "transactions"))
          batch.set(docRef, {
            ...tx,
            userId,
            createdAt: serverTimestamp(),
          })
        }
        await batch.commit()
        totalAdded += chunk.length
      }

      return totalAdded
    } catch (e) {
      setError((e as Error).message)
      return 0
    }
  }

  const updateTransaction = async (id: string, tx: NewTransaction): Promise<boolean> => {
    try {
      const { description, amount, category, type, date } = tx
      await updateDoc(doc(db, "transactions", id), { description, amount, category, type, date })
      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    }
  }

  const deleteTransaction = async (id: string): Promise<boolean> => {
    try {
      await deleteDoc(doc(db, "transactions", id))
      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    }
  }

  const deleteAllTransactions = async (): Promise<boolean> => {
    if (!userId || transactions.length === 0) return true
    try {
      const { writeBatch } = await import("firebase/firestore")
      const chunkSize = 400

      for (let i = 0; i < transactions.length; i += chunkSize) {
        const chunk = transactions.slice(i, i + chunkSize)
        const batch = writeBatch(db)

        for (const tx of chunk) {
          batch.delete(doc(db, "transactions", tx.id))
        }
        await batch.commit()
      }

      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    }
  }

  const updateBatchTransactions = async (
    updates: Array<{ id: string; description: string; category: string }>
  ): Promise<number> => {
    if (!userId || updates.length === 0) return 0
    try {
      const { writeBatch } = await import("firebase/firestore")
      const chunkSize = 400
      let totalUpdated = 0

      for (let i = 0; i < updates.length; i += chunkSize) {
        const chunk = updates.slice(i, i + chunkSize)
        const batch = writeBatch(db)

        for (const item of chunk) {
          const docRef = doc(db, "transactions", item.id)
          batch.update(docRef, {
            description: item.description,
            category: item.category,
          })
        }
        await batch.commit()
        totalUpdated += chunk.length
      }

      return totalUpdated
    } catch (e) {
      setError((e as Error).message)
      return 0
    }
  }

  const acc = transactions.reduce(
    (a, t) => {
      if (t.type === "income")  a.income  += Number(t.amount)
      if (t.type === "expense") a.expense += Math.abs(Number(t.amount))
      return a
    },
    { income: 0, expense: 0 }
  )

  const balance = acc.income - acc.expense
  const totals: Totals = {
    ...acc,
    balance,
    savingsRate: acc.income > 0
      ? ((balance / acc.income) * 100).toFixed(1)
      : "0.0",
  }

  return { transactions, loading, error, addTransaction, addBatchTransactions, updateTransaction, updateBatchTransactions, deleteTransaction, deleteAllTransactions, totals }
}

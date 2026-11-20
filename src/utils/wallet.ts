import type { Refund, Wallet } from "../types/budget"

export const EMPTY_WALLET: Wallet = { initial: 0, movements: [] }

/**
 * Cartera tras cambiar las devoluciones de un gasto: quita los movimientos de las devoluciones
 * anteriores de ese gasto y añade uno por cada devolución nueva que vaya a la cartera.
 */
export function syncRefundMoves(wallet: Wallet | null, oldRefunds: Refund[], newRefunds: Refund[], concept: string): Wallet {
  const w = wallet ?? EMPTY_WALLET
  // También los de las nuevas: si la lista anterior llega desfasada, no se duplican
  const old = new Set([...oldRefunds, ...newRefunds].map((r) => r.id))
  const movements = w.movements.filter((m) => !m.refundId || !old.has(m.refundId))
  for (const r of newRefunds) {
    if (!r.toWallet) continue
    const note = `Devolución: ${concept}${r.note ? ` (${r.note})` : ""}`.slice(0, 120)
    movements.push({ id: `r-${r.id}`, amount: r.amount, note, date: r.date, refundId: r.id })
  }
  return { initial: w.initial, movements: movements.sort((a, b) => b.date.localeCompare(a.date)) }
}

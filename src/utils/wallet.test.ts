import { describe, expect, it } from "vitest"
import { syncRefundMoves } from "./wallet"
import { netAmount, walletBalance, type Refund } from "../types/budget"

const r = (id: string, amount: number, toWallet: boolean): Refund => ({ id, amount, note: "Ana", date: "2026-11-20", toWallet })

describe("devoluciones y cartera", () => {
  it("netAmount resta solo lo que vuelve al mes", () => {
    expect(netAmount({ amount: 60, refunds: [r("a", 30, false), r("b", 10, true)] })).toBe(30)
    expect(netAmount({ amount: 20, refunds: [r("a", 50, false)] })).toBe(0)
    expect(netAmount({ amount: 20 })).toBe(20)
  })

  it("syncRefundMoves añade, cambia y quita los movimientos de un gasto sin tocar el resto", () => {
    const base = { initial: 100, movements: [{ id: "m1", amount: -20, note: "Retirada", date: "2026-11-01" }] }
    const w1 = syncRefundMoves(base, [], [r("a", 30, true), r("b", 5, false)], "Mercadona")
    expect(w1.movements).toHaveLength(2)
    expect(walletBalance(w1)).toBe(110)
    const w2 = syncRefundMoves(w1, [r("a", 30, true), r("b", 5, false)], [r("a", 40, true)], "Mercadona")
    expect(walletBalance(w2)).toBe(120)
    const w3 = syncRefundMoves(w2, [r("a", 40, true)], [], "Mercadona")
    expect(w3.movements.map((m) => m.id)).toEqual(["m1"])
    expect(walletBalance(null)).toBe(0)
  })
})

import { describe, expect, it } from "vitest"
import type { Expense } from "../../src/types/budget"
import { alertMessage, pendingAlerts } from "./alerts"

const budget = {
  categories: [
    { id: "a", name: "Comida", pct: 50, savings: false },
    { id: "b", name: "Ocio", pct: 50, savings: false },
  ],
  income: { "2026-11": 1000 },
}
const e = (category: string, amount: number): Expense => ({ id: category + amount, userId: "u", concept: "x", category, amount, date: "2026-11-10" })
const today = new Date(2026, 10, 20)

describe("pendingAlerts", () => {
  it("avisa de los sobres al 80 % o más", () => {
    const r = pendingAlerts("2026-11", [e("a", 400), e("b", 100)], budget, today)
    expect(r).toEqual([{ categoryId: "a", name: "Comida", pct: 80, remaining: 100 }])
  })
  it("no repite un aviso ya enviado", () => {
    expect(pendingAlerts("2026-11", [e("a", 450)], { ...budget, alerts: { "2026-11": ["a"] } }, today)).toEqual([])
  })
  it("solo el mes en curso y con nómina", () => {
    expect(pendingAlerts("2026-10", [e("a", 450)], budget, today)).toEqual([])
    expect(pendingAlerts("2026-11", [e("a", 450)], { ...budget, income: {} }, today)).toEqual([])
  })
  it("mensaje cuando te pasas", () => {
    expect(alertMessage({ categoryId: "a", name: "Comida", pct: 110, remaining: -50 }).title).toBe("Comida: te has pasado")
  })
})

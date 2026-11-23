import { describe, expect, it } from "vitest"
import type { BudgetCategory, Expense } from "../types/budget"
import { biggestChange, compareWithPast } from "./compare"

const cats: BudgetCategory[] = [
  { id: "comida", name: "Comida", pct: 50, savings: false },
  { id: "ocio", name: "Ocio", pct: 40, savings: false },
  { id: "hucha", name: "Hucha", pct: 10, savings: true },
]
let n = 0
const e = (date: string, category: string, amount: number): Expense => ({ id: String(n++), userId: "u", concept: "x", date, category, amount })

describe("compareWithPast", () => {
  it("compara con la media de los meses anteriores con gastos y se salta los vacíos", () => {
    const list = [
      e("2026-08-10", "comida", 100),
      // septiembre sin gastos: no cuenta
      e("2026-10-05", "comida", 200), e("2026-10-06", "ocio", 50),
      e("2026-11-02", "comida", 300), e("2026-11-03", "hucha", 999),
    ]
    const c = compareWithPast(list, "2026-11", cats, new Date(2026, 11, 15))
    expect(c.months).toBe(2)
    expect(c.upToDay).toBeNull()
    expect(c.rows.map((r) => [r.category.id, r.spent, r.average])).toEqual([["comida", 300, 150], ["ocio", 0, 25]])
    expect(c.rows[0].diffPct).toBe(100)
    expect(biggestChange(c)?.category.id).toBe("comida")
  })

  it("en el mes en curso compara hasta el mismo día", () => {
    const list = [e("2026-10-05", "comida", 40), e("2026-10-25", "comida", 400), e("2026-11-04", "comida", 50)]
    const c = compareWithPast(list, "2026-11", cats, new Date(2026, 10, 10))
    expect(c.upToDay).toBe(10)
    expect(c.rows[0].average).toBe(40)
  })

  it("sin meses anteriores no hay comparación", () => {
    expect(compareWithPast([e("2026-11-01", "comida", 5)], "2026-11", cats, new Date(2026, 10, 10)).months).toBe(0)
  })
})

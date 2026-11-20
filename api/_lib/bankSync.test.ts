import { describe, expect, it } from "vitest"
import { planAutoImport, refKey } from "./bankSync"
import { SKIP } from "../../src/utils/importQueue"
import { conceptKey } from "../../src/utils/categorize"
import type { BudgetCategory, Expense } from "../../src/types/budget"

const categories: BudgetCategory[] = [
  { id: "ahorro", name: "Ahorro", pct: 20, savings: true },
  { id: "comida", name: "Alimentación", pct: 30, savings: false },
  { id: "ocio", name: "Ocio", pct: 20, savings: false },
  { id: "otros", name: "Otros", pct: 30, savings: false },
]
const row = (date: string, concept: string, amount: number) => ({ date, time: "", concept, amount, ref: `${date}|${concept}|${amount}` })

describe("planAutoImport", () => {
  it("salta los ya apuntados (mismo importe a ±3 días)", () => {
    const existing: Expense[] = [{ id: "e1", userId: "u", amount: 12.5, concept: "Bar", category: "ocio", date: "2026-11-10" }]
    const out = planAutoImport([row("2026-11-12", "Bar Pepe", 12.5), row("2026-11-12", "Bar Pepe", 9)], existing, {}, categories)
    expect(out).toHaveLength(1)
    expect(out[0].amount).toBe(9)
  })

  it("usa la memoria, respeta los omitidos y cae en Otros si no conoce el concepto", () => {
    const memory = { [conceptKey("Netflix")]: "ocio", [conceptKey("Traspaso")]: SKIP }
    const out = planAutoImport(
      [row("2026-11-01", "Netflix", 13), row("2026-11-02", "Traspaso", 100), row("2026-11-03", "Tienda rara XYZ", 7)],
      [],
      memory,
      categories
    )
    expect(out).toEqual([
      { amount: 13, concept: "Netflix", category: "ocio", date: "2026-11-01" },
      { amount: 7, concept: "Tienda rara XYZ", category: "otros", date: "2026-11-03" },
    ])
  })

  it("no importa nada si no hay categorías de gasto", () => {
    expect(planAutoImport([row("2026-11-01", "Bar", 5)], [], {}, [categories[0]])).toEqual([])
  })
})

describe("planAutoImport con movimientos ya vistos", () => {
  it("no vuelve a apuntar uno ya importado aunque se borrara el gasto", () => {
    const r = { date: "2026-11-05", time: "", concept: "Bar", amount: 4, ref: "tx-1" }
    const seen = { [refKey("tx-1")]: "2026-11-05" }
    expect(planAutoImport([r], [], {}, categories, seen)).toEqual([])
    expect(planAutoImport([{ ...r, ref: "tx-2" }], [], {}, categories, seen)).toHaveLength(1)
  })
})

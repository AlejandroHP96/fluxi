import { describe, expect, it } from "vitest"
import { buildMonthSheet, previousMonth } from "./seguimiento"
import type { Expense } from "../../src/types/budget"

const categories = [
  { id: "c1", name: "Comida", pct: 60, savings: false },
  { id: "c2", name: "Copima", pct: 0, amount: 200, savings: false },
]
const exp = (id: string, date: string, amount: number, category = "c1", extra: Partial<Expense> = {}): Expense =>
  ({ id, userId: "u1", concept: `Gasto ${id}`, category, date, amount, ...extra })

describe("buildMonthSheet", () => {
  const expenses = [
    exp("b", "2026-11-20", 30),
    exp("a", "2026-11-03", 50, "c2", { refunds: [{ id: "r", amount: 20, note: "Ana", date: "2026-11-04", toWallet: false }] }),
    exp("x", "2026-10-30", 99), // otro mes
    exp("z", "2026-11-10", 5, "borrada"),
  ]
  const budget = { categories, income: { "2026-11": 1000 }, fixedExpenses: [{ id: "f", name: "Alquiler", amount: 400 }] }
  const s = buildMonthSheet("2026-11", expenses, budget, new Date(2026, 11, 1))
  const find = (label: string) => s.rows.find((r) => r[0] === label)

  it("resumen del mes", () => {
    expect(s.rows[0][0]).toBe("Fluxi · Noviembre de 2026")
    expect(find("Nómina")).toEqual(["Nómina", 1000])
    expect(find("Gastos fijos")).toEqual(["Gastos fijos", 400])
    expect(find("Gastado")).toEqual(["Gastado", 65]) // 30 + (50 − 20) + 5
    expect(find("Sobrante")).toEqual(["Sobrante", 535])
  })

  it("sobres en € y %, y sin categoría", () => {
    expect(find("Copima")).toEqual(["Copima", 200, 30, 170])
    expect(find("Comida")).toEqual(["Comida", 240, 30, 210]) // 60 % de (1000 − 400 − 200)
    expect(find("Sin categoría")).toEqual(["Sin categoría", 0, 5, -5])
  })

  it("gastos del mes en orden, con lo devuelto y el neto", () => {
    const start = s.rows.findIndex((r) => r[0] === "Fecha")
    expect(s.rows[start]).toEqual(["Fecha", "Concepto", "Categoría", "Importe", "Devuelto", "Neto"])
    expect(s.rows.slice(start + 1)).toEqual([
      ["2026-11-03", "Gasto a", "Copima", 50, 20, 30],
      ["2026-11-10", "Gasto z", "Sin categoría", 5, 0, 5],
      ["2026-11-20", "Gasto b", "Comida", 30, 0, 30],
    ])
  })

  it("con miembros añade quién lo apuntó", () => {
    const shared = buildMonthSheet("2026-11", [exp("m", "2026-11-05", 10, "c1", { createdBy: "m1" })], {
      ...budget, members: { u1: "Alejandro", m1: "Patricia" },
    })
    const start = shared.rows.findIndex((r) => r[0] === "Fecha")
    expect(shared.rows[start][6]).toBe("Apuntado por")
    expect(shared.rows[start + 1][6]).toBe("Patricia")
  })

  it("mes sin nómina ni gastos", () => {
    const empty = buildMonthSheet("2026-09", [], { categories })
    expect(empty.rows.find((r) => r[0] === "Nómina")).toEqual(["Nómina", "Sin apuntar"])
    expect(empty.rows[empty.rows.length - 1]).toEqual(["Sin gastos este mes"])
  })
})

describe("previousMonth", () => {
  it("el mes anterior, también en enero", () => {
    expect(previousMonth(new Date(Date.UTC(2026, 11, 1, 6)))).toBe("2026-11")
    expect(previousMonth(new Date(Date.UTC(2027, 0, 1, 6)))).toBe("2026-12")
  })
})

import { describe, expect, it } from "vitest"
import { buildMonthSheet, monthsOfLastWeek, tabTitle, weeksOfMonth, type MonthSheet } from "./seguimiento"
import type { Expense } from "../../src/types/budget"

const categories = [
  { id: "c1", name: "Comida", pct: 60, savings: false },
  { id: "c2", name: "Copima", pct: 0, amount: 200, savings: false },
]
const exp = (id: string, date: string, amount: number, category = "c1", extra: Partial<Expense> = {}): Expense =>
  ({ id, userId: "u1", concept: `Gasto ${id}`, category, date, amount, ...extra })

// Celdas desde la que tiene `label` hacia la derecha (las tablas están lado a lado)
const at = (s: MonthSheet, label: string, n: number) => {
  for (const [r, row] of s.rows.entries()) {
    const c = row.indexOf(label)
    if (c >= 0) return { r, c, cells: row.slice(c, c + n) }
  }
  throw new Error(`No está «${label}»`)
}
const below = (s: MonthSheet, label: string, n: number, count: number) => {
  const { r, c } = at(s, label, n)
  return s.rows.slice(r + 1, r + 1 + count).map((row) => row.slice(c, c + n))
}

describe("buildMonthSheet", () => {
  const expenses = [
    exp("b", "2026-11-20", 30),
    exp("a", "2026-11-03", 50, "c2", { refunds: [{ id: "r", amount: 20, note: "Ana", date: "2026-11-04", toWallet: false }] }),
    exp("x", "2026-10-30", 99), // otro mes
    exp("z", "2026-11-10", 5, "borrada"),
  ]
  const budget = { categories, income: { "2026-11": 1000 }, fixedExpenses: [{ id: "f", name: "Alquiler", amount: 400 }] }
  const s = buildMonthSheet("2026-11", expenses, budget, new Date(2026, 11, 1))

  it("título y KPIs en fila", () => {
    expect(s.rows[0][0]).toBe("Fluxi · Noviembre de 2026")
    expect(s.rows[1][0]).toBe("Mes cerrado · actualizado el 2026-12-01 · 3 gastos")
    expect(s.rows[3].slice(0, 6)).toEqual(["Nómina", "Gastos fijos", "Para gastar", "Gastado", "Sobrante", "Estado"])
    expect(s.rows[4].slice(0, 6)).toEqual([1000, 400, 600, 65, 535, "Vas bien"]) // 65 = 30 + (50 − 20) + 5
    expect(s.tone).toBe("ok")
  })

  it("sobres en € y %, % gastado, estado y sin categoría", () => {
    expect(at(s, "Copima", 6).cells).toEqual(["Copima", 200, 30, 170, 0.15, "Bien"])
    expect(at(s, "Comida", 6).cells).toEqual(["Comida", 240, 30, 210, 0.125, "Bien"]) // 60 % de (1000 − 400 − 200)
    expect(at(s, "Sin categoría", 6).cells).toEqual(["Sin categoría", 0, 5, -5, "", "Sin sobre"])
  })

  it("semana a semana (lunes a domingo) con presupuesto proporcional", () => {
    const weeks = below(s, "Semana", 5, 6)
    expect(weeks[0]).toEqual(["1 nov", 1, 0, 20, "Bien"]) // domingo 1: 600 × 1/30
    expect(weeks[1]).toEqual(["2–8 nov", 7, 30, 140, "Bien"])
    expect(weeks[5]).toEqual(["30 nov", 1, 0, 20, "Bien"])
  })

  it("semanas por venir en el mes en curso", () => {
    const now = buildMonthSheet("2026-11", expenses, budget, new Date(2026, 10, 11))
    const weeks = below(now, "Semana", 5, 6)
    expect(weeks[2][4]).toBe("En curso · Bien") // 9–15 nov
    expect(weeks[3]).toEqual(["16–22 nov", 7, "", 140, "Por venir"])
  })

  it("gastos fijos desglosados con total", () => {
    expect(below(s, "Gasto fijo", 3, 2)).toEqual([["Alquiler", "", 400], ["Total", "", 400]])
    expect(buildMonthSheet("2026-11", [], { categories }).rows.flat()).not.toContain("Gasto fijo")
  })

  it("gastos del mes en orden, con lo devuelto y el neto", () => {
    expect(at(s, "Fecha", 7).cells).toEqual(["Fecha", "Concepto", "Categoría", "Importe", "Devuelto", "Neto", ""])
    expect(below(s, "Fecha", 6, 3)).toEqual([
      ["2026-11-03", "Gasto a", "Copima", 50, 20, 30],
      ["2026-11-10", "Gasto z", "Sin categoría", 5, 0, 5],
      ["2026-11-20", "Gasto b", "Comida", 30, 0, 30],
    ])
  })

  it("con miembros añade quién lo apuntó", () => {
    const shared = buildMonthSheet("2026-11", [exp("m", "2026-11-05", 10, "c1", { createdBy: "m1" })], {
      ...budget, members: { u1: "Alejandro", m1: "Patricia" },
    })
    expect(at(shared, "Fecha", 7).cells[6]).toBe("Apuntado por")
    expect(below(shared, "Fecha", 7, 1)[0][6]).toBe("Patricia")
  })

  it("colores de estado en sobres y semanas", () => {
    const over = buildMonthSheet("2026-11", [exp("o", "2026-11-02", 230, "c2")], budget, new Date(2026, 11, 1))
    const { r, cells } = at(over, "Copima", 6)
    expect(cells[5]).toBe("Te pasaste")
    expect(over.tones).toContainEqual({ range: { startRow: r, endRow: r + 1, startCol: 3, endCol: 6 }, tone: "pasado" })
    expect(below(over, "Semana", 5, 2)[1][4]).toBe("Te pasaste") // 230 > 140 de la semana
  })

  it("tres gráficas que apuntan a sus datos", () => {
    expect(s.charts.map((c) => c.title)).toEqual(["Gasto por semana", "Gastado en el mes frente al ritmo", "Sobres: gastado frente a asignado"])
    const daily = s.charts[1]
    expect(s.rows[daily.domain.startRow][daily.domain.startCol]).toBe("Día")
    expect(s.rows[daily.domain.startRow + 30].slice(daily.domain.startCol, daily.domain.startCol + 3)).toEqual([30, 65, 600])
  })

  it("mes sin nómina ni gastos", () => {
    const empty = buildMonthSheet("2026-09", [], { categories })
    expect(empty.rows[4][0]).toBe("Sin apuntar")
    expect(empty.rows[4][5]).toBe("Sin nómina")
    expect(empty.rows.flat()).toContain("Sin gastos este mes")
  })
})

describe("tabTitle", () => {
  it("mes con nombre y año corto", () => {
    expect(tabTitle("2026-11")).toBe("Noviembre 26")
    expect(tabTitle("2027-01")).toBe("Enero 27")
  })
})

describe("weeksOfMonth", () => {
  it("de lunes a domingo, recortadas al mes", () => {
    expect(weeksOfMonth("2026-11")).toEqual([[1, 1], [2, 8], [9, 15], [16, 22], [23, 29], [30, 30]])
    expect(weeksOfMonth("2027-02")).toEqual([[1, 7], [8, 14], [15, 21], [22, 28]])
  })
})

describe("monthsOfLastWeek", () => {
  it("una semana dentro del mes", () => {
    expect(monthsOfLastWeek(new Date(Date.UTC(2026, 10, 23, 6)))).toEqual(["2026-11"])
  })
  it("semana que cruza de mes: los dos, el que cierra primero", () => {
    expect(monthsOfLastWeek(new Date(Date.UTC(2026, 11, 7, 6)))).toEqual(["2026-11", "2026-12"])
    expect(monthsOfLastWeek(new Date(Date.UTC(2027, 0, 4, 6)))).toEqual(["2026-12", "2027-01"])
  })
  it("lunes 1: solo el mes que acaba de cerrar", () => {
    expect(monthsOfLastWeek(new Date(Date.UTC(2027, 2, 1, 6)))).toEqual(["2027-02"])
  })
})

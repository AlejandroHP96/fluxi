import { describe, expect, it } from "vitest"
import {
  currentMonthKey,
  daysInMonth,
  lastIncomeBefore,
  monthLabel,
  resolveCategory,
  shiftMonth,
  summarizeMonth,
  toDateKey,
  toMonthKey,
  todayKey,
} from "./month"
import type { BudgetCategory, Expense, FixedExpense } from "../types/budget"

const cat = (id: string, name: string, pct: number, savings = false): BudgetCategory => ({ id, name, pct, savings })
const exp = (amount: number, category: string, date: string): Expense => ({
  id: category + date, userId: "u1", amount, concept: "x", category, date,
})
const fixed = (amount: number): FixedExpense => ({ id: "f" + amount, name: "Fijo", amount })

const CATS = [cat("c1", "Ocio", 50), cat("c2", "Alimentación", 30), cat("s1", "Ahorro", 20, true)]

describe("helpers de fechas", () => {
  it("toDateKey usa hora local (00:30 no cae al día anterior)", () => {
    expect(toDateKey(new Date(2026, 10, 5, 0, 30))).toBe("2026-11-05")
    expect(toDateKey(new Date(2026, 10, 5, 23, 59))).toBe("2026-11-05")
  })

  it("toMonthKey y claves de hoy/mes actual", () => {
    expect(toMonthKey(new Date(2026, 0, 15))).toBe("2026-01")
    expect(currentMonthKey()).toBe(toMonthKey(new Date()))
    expect(todayKey()).toBe(toDateKey(new Date()))
  })

  it("shiftMonth cruza años en ambos sentidos", () => {
    expect(shiftMonth("2026-11", -1)).toBe("2026-10")
    expect(shiftMonth("2026-01", -1)).toBe("2025-12")
    expect(shiftMonth("2026-12", 1)).toBe("2027-01")
    expect(shiftMonth("2025-11", 12)).toBe("2026-11")
  })

  it("daysInMonth incluye bisiestos", () => {
    expect(daysInMonth("2026-11")).toBe(30)
    expect(daysInMonth("2026-12")).toBe(31)
    expect(daysInMonth("2026-02")).toBe(28)
    expect(daysInMonth("2024-02")).toBe(29)
  })

  it("monthLabel da nombre en español", () => {
    expect(monthLabel("2026-11")).toContain("noviembre")
    expect(monthLabel("2026-11")).toContain("2026")
  })
})

describe("lastIncomeBefore", () => {
  const income = { "2026-08": 1500, "2026-10": 1800, "2026-11": 1900 }

  it("devuelve la última nómina anterior al mes", () => {
    expect(lastIncomeBefore(income, "2026-11")).toBe(1800)
    expect(lastIncomeBefore(income, "2026-12")).toBe(1900)
  })

  it("null si no hay ninguna antes", () => {
    expect(lastIncomeBefore(income, "2026-01")).toBeNull()
    expect(lastIncomeBefore({}, "2026-11")).toBeNull()
  })
})

describe("resolveCategory", () => {
  it("resuelve por id y por nombre (aunque traiga tildes)", () => {
    expect(resolveCategory("c1", CATS)).toEqual(CATS[0])
    expect(resolveCategory("Alimentacion", CATS)).toEqual(CATS[1])
    expect(resolveCategory("alimentación", CATS)).toEqual(CATS[1])
  })

  it("null si no existe", () => {
    expect(resolveCategory("inexistente", CATS)).toBeNull()
  })
})

describe("summarizeMonth", () => {
  // Mes pasado, determinista: pctElapsed = 100 y días restantes 0
  const PAST = "2026-10"

  it("mes sin nómina: status sin-nomina y nada asignado", () => {
    const s = summarizeMonth([exp(30, "c1", "2026-11-05")], "2026-11", null, CATS)
    expect(s.status).toBe("sin-nomina")
    expect(s.income).toBeNull()
    expect(s.spendable).toBe(0)
    expect(s.netIncome).toBe(0)
    expect(s.saved).toBe(0)
    // gasto sin nómina: no se puede cubrir
    expect(s.available).toBe(-30)
    expect(s.pctSpent).toBe(0)
    // sobres a 0 € de base; lo gastado en ellos queda como pasado
    expect(s.envelopes[0].allocated).toBe(0)
    expect(s.envelopes[0].status).toBe("pasado")
    expect(s.dailyAllowance).toBeNull()
  })

  it("mes pasado con nómina y sin pasarse: bien", () => {
    // 1800 - 200 fijos = 1600 de base; ahorro 20% = 320; gasto = 1200
    const s = summarizeMonth(
      [exp(700, "c1", "2026-10-03"), exp(500, "c2", "2026-10-20")],
      PAST, 1800, CATS, [fixed(200)],
    )
    expect(s.totalFixed).toBe(200)
    expect(s.netIncome).toBe(1600)
    expect(s.saved).toBe(320)
    expect(s.spendable).toBe(1280)
    expect(s.spent).toBe(1200)
    expect(s.available).toBe(80)
    expect(s.pctSpent).toBeCloseTo((1200 / 1280) * 100)
    expect(s.status).toBe("bien")
    expect(s.pctElapsed).toBe(100)
    expect(s.daysLeft).toBe(0)
    expect(s.dailyAllowance).toBeNull()
  })

  it("sobres: reparto por %, consumo y estados ok/casi/pasado", () => {
    // base 1600: c1 = 800, c2 = 480
    const gastos = [
      exp(400, "c1", "2026-10-03"), // 50 % de c1 -> ok
      exp(360, "c2", "2026-10-04"), // 75 % de c2 -> ok
    ]
    const s = summarizeMonth(gastos, PAST, 1800, CATS, [fixed(200)])
    const [ocio, alimento] = s.envelopes
    expect(ocio.category.id).toBe("c1")
    expect(ocio.allocated).toBeCloseTo(800)
    expect(ocio.spent).toBe(400)
    expect(ocio.remaining).toBe(400)
    expect(ocio.status).toBe("ok")
    expect(alimento.allocated).toBeCloseTo(480)
    expect(alimento.pctSpent).toBeCloseTo(75)
    expect(alimento.status).toBe("ok")

    const casi = summarizeMonth([exp(440, "c2", "2026-10-04")], PAST, 1800, CATS, [fixed(200)])
    expect(casi.envelopes[1].status).toBe("casi") // 440/480 > 90 %

    const pasado = summarizeMonth([exp(500, "c2", "2026-10-04")], PAST, 1800, CATS, [fixed(200)])
    expect(pasado.envelopes[1].status).toBe("pasado") // 500 > 480
  })

  it("categoría de ahorro se aparta del dinero para gastar", () => {
    // sin ahorro: spendable 1600; con ahorro 20 %: 1600 - 320 = 1280
    const sinAhorro = summarizeMonth([], PAST, 1800, [cat("c1", "Ocio", 100)], [fixed(200)])
    const conAhorro = summarizeMonth([], PAST, 1800, CATS, [fixed(200)])
    expect(sinAhorro.spendable).toBe(1600)
    expect(conAhorro.spendable).toBe(1280)
    expect(conAhorro.saved).toBe(320)
    expect(conAhorro.savings[0].category.id).toBe("s1")
  })

  it("mes pasado pasándose del presupuesto: status pasado y available negativo", () => {
    const s = summarizeMonth([exp(1400, "c1", "2026-10-03")], PAST, 1800, CATS, [fixed(200)])
    // spendable 1280, gasto 1400
    expect(s.available).toBe(-120)
    expect(s.status).toBe("pasado")
  })

  it("nómina menor que los fijos: pasado", () => {
    const s = summarizeMonth([], PAST, 100, CATS, [fixed(200)])
    expect(s.netIncome).toBe(0)
    expect(s.spendable).toBe(-100)
    expect(s.status).toBe("pasado")
  })

  it("mes actual: ritmo-alto si va por encima del % transcurrido", () => {
    const today = new Date(2026, 10, 20) // día 20 de 30
    // nómina 1000, ahorro s1 (20 %) aparta 200 -> spendable 800
    const ok = summarizeMonth([exp(500, "c1", "2026-11-01")], "2026-11", 1000, CATS, [], today)
    const alto = summarizeMonth([exp(600, "c1", "2026-11-01")], "2026-11", 1000, CATS, [], today)
    expect(ok.pctElapsed).toBeCloseTo((20 / 30) * 100, 2)
    expect(ok.spendable).toBe(800)
    expect(ok.status).toBe("bien") // 500/800 = 62,5 % < 66,7 %
    expect(alto.status).toBe("ritmo-alto") // 600/800 = 75 % > 66,7 %
    expect(alto.daysLeft).toBe(11)
  })

  it("mes futuro: pctElapsed 0, días completos, siempre bien", () => {
    const s = summarizeMonth([], "2026-12", 1800, CATS, [fixed(200)], new Date(2026, 10, 20))
    expect(s.pctElapsed).toBe(0)
    expect(s.daysLeft).toBe(31)
    expect(s.isPast).toBe(false)
    expect(s.isCurrent).toBe(false)
    expect(s.status).toBe("bien")
  })

  it("dailyAllowance solo en mes actual con nómina", () => {
    const s = summarizeMonth([exp(300, "c1", "2026-11-05")], "2026-11", 1000, CATS, [], new Date(2026, 10, 20))
    // spendable 800, spent 300 -> 500 € en 11 días
    expect(s.dailyAllowance).not.toBeNull()
    expect(s.dailyAllowance!).toBeCloseTo(500 / 11, 4)
  })

  it("gastos en categorías inexistentes van a uncategorized", () => {
    const s = summarizeMonth(
      [exp(30, "c1", "2026-10-01"), exp(25, "vieja-cat", "2026-10-02")],
      PAST, 1800, CATS,
    )
    expect(s.uncategorized).toBe(25)
    expect(s.spent).toBe(55)
    expect(s.count).toBe(2)
  })

  it("gasto antiguo guardado con nombre de categoría se resuelve", () => {
    const s = summarizeMonth([exp(40, "Ocio", "2026-10-01")], PAST, 1800, CATS)
    expect(s.uncategorized).toBe(0)
    expect(s.envelopes[0].spent).toBe(40)
  })

  it("totalPct y unassignedPct", () => {
    expect(summarizeMonth([], PAST, 1800, CATS).totalPct).toBe(100)
    expect(summarizeMonth([], PAST, 1800, CATS).unassignedPct).toBe(0)
    const s = summarizeMonth([], PAST, 1800, [cat("c1", "Ocio", 60)])
    expect(s.totalPct).toBe(60)
    expect(s.unassignedPct).toBe(40)
    expect(s.unassigned).toBeCloseTo(1800 * 0.4)
  })
})

describe("summarizeMonth: sobres en € y en %", () => {
  const cats: BudgetCategory[] = [
    { id: "comida", name: "Comida", pct: 0, amount: 300, savings: false },
    cat("ocio", "Ocio", 40),
    cat("otros", "Otros", 30),
    cat("ahorro", "Ahorro", 30, true),
  ]

  it("los € salen primero y los % se reparten sobre el resto", () => {
    const s = summarizeMonth([], "2026-11", 2000, cats, [fixed(700)], new Date(2026, 10, 15))
    const by = (id: string) => [...s.envelopes, ...s.savings].find((e) => e.category.id === id)!.allocated
    expect(s.totalAmount).toBe(300)
    expect(s.pctBase).toBe(1000)
    expect(by("comida")).toBe(300)
    expect(by("ocio")).toBe(400)
    expect(by("otros")).toBe(300)
    expect(by("ahorro")).toBe(300)
    expect(s.totalPct).toBe(100)
    expect(s.unassigned).toBe(0)
    expect(s.amountOver).toBe(0)
  })

  it("si los € no caben, avisa y los % se quedan a 0", () => {
    const s = summarizeMonth([], "2026-11", 900, cats, [fixed(700)], new Date(2026, 10, 15))
    expect(s.amountOver).toBe(100)
    expect(s.pctBase).toBe(0)
    expect(s.envelopes.find((e) => e.category.id === "ocio")!.allocated).toBe(0)
  })

  it("solo sobres en €: lo que sobra queda sin asignar", () => {
    const s = summarizeMonth([], "2026-11", 1000, [cats[0]], [], new Date(2026, 10, 15))
    expect(s.unassigned).toBe(700)
  })
})

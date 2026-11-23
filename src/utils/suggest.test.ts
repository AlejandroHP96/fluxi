import { describe, expect, it } from "vitest"
import type { Expense } from "../types/budget"
import { conceptSuggestions } from "./suggest"

const e = (concept: string, category: string, amount: number, date: string): Expense =>
  ({ id: `${concept}-${date}`, concept, category, amount, date, userId: "u" }) as Expense

const list = [
  e("Mercadona", "comida", 40, "2026-10-02"),
  e("mercadona", "comida", 55.3, "2026-11-10"),
  e("Gasolina", "coche", 60, "2026-11-01"),
  e("Super Mercadona centro", "comida", 12, "2026-11-05"),
  e("Panadería", "comida", 3, "2026-11-03"),
]

describe("conceptSuggestions", () => {
  it("no sugiere con menos de 2 letras", () => {
    expect(conceptSuggestions(list, "m")).toEqual([])
  })

  it("usa el último sobre e importe y pone primero lo que empieza por el texto", () => {
    expect(conceptSuggestions(list, "merca")).toEqual([
      { concept: "mercadona", category: "comida", amount: 55.3 },
      { concept: "Super Mercadona centro", category: "comida", amount: 12 },
    ])
  })

  it("ignora tildes y mayúsculas", () => {
    expect(conceptSuggestions(list, "PANADE")[0].concept).toBe("Panadería")
  })

  it("no sugiere nada si el texto ya es un concepto entero", () => {
    expect(conceptSuggestions(list, "gasolina")).toEqual([])
  })
})

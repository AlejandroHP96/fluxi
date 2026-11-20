import { describe, expect, it } from "vitest"
import { suggestFor, SKIP } from "./importQueue"
import { conceptKey } from "./categorize"
import type { BudgetCategory } from "../types/budget"

const cats: BudgetCategory[] = [
  { id: "ali", name: "Alimentación", pct: 50, savings: false },
  { id: "multi", name: "Multitienda", pct: 20, savings: false },
  { id: "ocio", name: "Ocio", pct: 30, savings: false },
]

describe("suggestFor", () => {
  it("una categoría tuya cuyo nombre sale en el concepto gana a las reglas de serie", () => {
    // MULTITIENDA está en las reglas de serie como Alimentación
    expect(suggestFor("Multitienda Diana", {}, cats)).toBe("multi")
    expect(suggestFor("MULTITIENDA SOL 123", {}, cats)).toBe("multi")
    expect(suggestFor("Multitienda Diana", {}, cats.filter((c) => c.id !== "multi"))).toBe("ali")
  })

  it("lo que elegiste antes para ese concepto manda sobre todo", () => {
    expect(suggestFor("Multitienda Diana", { [conceptKey("Multitienda Diana")]: "ocio" }, cats)).toBe("ocio")
    expect(suggestFor("Multitienda Diana", { [conceptKey("Multitienda Diana")]: SKIP }, cats)).toBe(SKIP)
  })

  it("solo palabras completas: «Ocio» no casa con «Sociedad»", () => {
    expect(suggestFor("Sociedad Anonima XYZ", {}, cats)).toBe(null)
  })
})

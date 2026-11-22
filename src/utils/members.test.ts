import { describe, expect, it } from "vitest"
import { authorName, authorshipLabel, isShared } from "./members"

const members = { u1: "Alejandro", m1: "Ana" }
const base = { userId: "u1" }

describe("members", () => {
  it("compartido solo con más de un miembro", () => {
    expect(isShared({})).toBe(false)
    expect(isShared({ u1: "Alejandro" })).toBe(false)
    expect(isShared(members)).toBe(true)
  })
  it("gasto antiguo sin createdBy es del dueño", () => {
    expect(authorName(base, members)).toBe("Alejandro")
  })
  it("autor por createdBy", () => {
    expect(authorName({ ...base, createdBy: "m1" }, members)).toBe("Ana")
    expect(authorName({ ...base, createdBy: "zz" }, members)).toBeNull()
  })
  it("etiqueta con editor distinto", () => {
    expect(authorshipLabel({ ...base, createdBy: "m1", updatedBy: "u1" }, members)).toBe("Apuntado por Ana · editado por Alejandro")
  })
  it("etiqueta sin editor o editor = autor", () => {
    expect(authorshipLabel({ ...base, createdBy: "m1", updatedBy: "m1" }, members)).toBe("Apuntado por Ana")
    expect(authorshipLabel(base, members)).toBe("Apuntado por Alejandro")
  })
  it("sin compartir no hay etiqueta", () => {
    expect(authorshipLabel(base, { u1: "Alejandro" })).toBeNull()
  })
})

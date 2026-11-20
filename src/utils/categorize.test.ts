import { describe, expect, it } from "vitest"
import { categorize, conceptKey } from "./categorize"

describe("conceptKey", () => {
  it("mayúsculas, sin tildes ni signos", () => {
    expect(conceptKey("Cafetería Rte. nº 12")).toBe("CAFETERIA RTE N")
  })

  it("sin números sueltos", () => {
    expect(conceptKey("Lidl 1234")).toBe("LIDL")
  })

  it("tildes rotas de Ventajón quedan como espacio", () => {
    expect(conceptKey("Ca￱on Cosmo Store")).toBe("CA ON COSMO STORE")
  })

  it("nombres propios con y sin tilde dan la misma clave", () => {
    expect(conceptKey("To Veronica Concepción Perez")).toBe(conceptKey("To Veronica Concepcion Perez"))
  })
})

describe("categorize", () => {
  it("ingresos tienen su categoría propia", () => {
    expect(categorize("Transferencia recibida", true)).toBe("Ingresos")
  })

  it("reglas del usuario van primero", () => {
    expect(categorize("Lidl 1234", false, { LIDL: "Mi super" })).toBe("Mi super")
  })

  it("categorías de comercios conocidos", () => {
    expect(categorize("Mercadona Calle Falsa 3", false)).toBe("Alimentación")
    expect(categorize("LIDL", false)).toBe("Alimentación")
    expect(categorize("Carrefour Express", false)).toBe("Alimentación")
    expect(categorize("Uber Eats", false)).toBe("Alimentación") // a domicilio: antes que Transporte
    expect(categorize("Uber", false)).toBe("Transporte")
    expect(categorize("Gasolinera Repsol", false)).toBe("Transporte")
    expect(categorize("Netflix", false)).toBe("Suscripciones")
    expect(categorize("Xbox Game Pass", false)).toBe("Suscripciones")
    expect(categorize("Endesa", false)).toBe("Suministros")
    expect(categorize("Movistar Fibra", false)).toBe("Suministros")
    expect(categorize("Amazon", false)).toBe("Compras")
    expect(categorize("H&M", false)).toBe("Compras")
    expect(categorize("Farmacia Guanarteme", false)).toBe("Salud")
    expect(categorize("Alquiler Noviembre", false)).toBe("Vivienda")
    expect(categorize("Ikea mesa", false)).toBe("Vivienda")
    expect(categorize("Yelmo Cines", false)).toBe("Ocio")
    expect(categorize("Steam", false)).toBe("Ocio")
  })

  it("la restauración va antes que las tiendas: Restaurante IKEA", () => {
    expect(categorize("Restaurante IKEA", false)).toBe("Ocio")
    expect(categorize("IKEA TENERIFE TS", false)).toBe("Ocio")
  })

  it("resiste tildes y mayúsculas del CSV", () => {
    expect(categorize("cafetería la espuma", false)).toBe("Ocio")
    expect(categorize("Mercatenerife", false)).toBe("Alimentación")
  })

  it("desconocidos van a Otro", () => {
    expect(categorize("Cosa rara sin pista", false)).toBe("Otro")
    expect(categorize("", false)).toBe("Otro")
  })
})

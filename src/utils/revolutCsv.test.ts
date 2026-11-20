import { describe, expect, it } from "vitest"
import { monthsInCsv, parseCsvAmount, parseRevolutExpenses } from "./revolutCsv"

const CSV_ES = [
  "Fecha de inicio;Descripción;Importe;Estado;Producto",
  "19/11/2026 10:40;Lidl;-45.30;COMPLETED;Principal",
  "2026-11-20 08:05;Carrefour;-12.99;COMPLETED;Principal",
  "18/11/2026 14:22;Reembolso Amazon;25.00;COMPLETED;Principal",
  "17/11/2026 12:00;Uber Eats;-18.75;PENDING;Principal",
  "16/11/2026 21:30;Desde Ahorros a Principal;-100.00;COMPLETED;Principal",
  "15/11/2026 09:00;Interés depósito;-2.50;COMPLETED;Depósito",
].join("\n")

const CSV_EN = [
  "Started Date;Description;Amount;State;Product",
  "19/11/2026 10:40;Lidl;-45.30;COMPLETED;Current",
  "18/11/2026 14:22;Refund Amazon;25.00;COMPLETED;Current",
].join("\n")

describe("parseRevolutExpenses", () => {
  it("extrae solo gastos completados en negativo", () => {
    const out = parseRevolutExpenses(CSV_ES)
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({ date: "2026-11-19", time: "10:40", concept: "Lidl", amount: 45.3 })
    expect(out[1]).toMatchObject({ date: "2026-11-20", time: "08:05", concept: "Carrefour", amount: 12.99 })
  })

  it("ignora reembolsos, pendientes, traspasos y depósito", () => {
    const out = parseRevolutExpenses(CSV_ES)
    expect(out.map((r) => r.concept).sort()).toEqual(["Carrefour", "Lidl"])
  })

  it("soporta cabeceras y formato en inglés", () => {
    const out = parseRevolutExpenses(CSV_EN)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ date: "2026-11-19", concept: "Lidl", amount: 45.3 })
  })

  it("entiende coma decimal y separadores de miles", () => {
    expect(parseCsvAmount("-45,30")).toBe(-45.3)
    expect(parseCsvAmount("-45.30")).toBe(-45.3)
    expect(parseCsvAmount("-1.234,56 €")).toBe(-1234.56)
    expect(parseCsvAmount("-1,234.56")).toBe(-1234.56)
    expect(parseCsvAmount("-10")).toBe(-10)
    expect(parseCsvAmount("-1,234,567")).toBe(-1234567)
    expect(parseCsvAmount("-1.234.567")).toBe(-1234567)
    expect(parseCsvAmount("-1.234.567,89")).toBe(-1234567.89)
    expect(parseCsvAmount("-1.234")).toBe(-1234)
    expect(parseCsvAmount("-0,5")).toBe(-0.5)
    expect(parseCsvAmount("-12.5")).toBe(-12.5)
    const out = parseRevolutExpenses([
      "Fecha de inicio;Descripción;Importe;Estado;Producto",
      "19/11/2026 10:00;Mercadona;-45,30;COMPLETED;Actual",
    ].join("\n"))
    expect(out[0].amount).toBe(45.3)
  })

  it("parsea los dos formatos de fecha (ISO y DD/MM/YYYY)", () => {
    const out = parseRevolutExpenses([
      "Fecha de inicio;Descripción;Importe;Estado;Producto",
      "19/11/2026 9:05;Tienda A;-10;COMPLETED;X",
      "2026-11-20 08:05:50;Tienda B;-5;COMPLETED;X",
    ].join("\n"))
    expect(out.map((r) => [r.date, r.time])).toEqual([
      ["2026-11-19", "09:05"],
      ["2026-11-20", "08:05"],
    ])
  })

  it("concepto vacío queda como Gasto", () => {
    const out = parseRevolutExpenses([
      "Fecha de inicio;Descripción;Importe;Estado;Producto",
      "19/11/2026 10:00;;-10;COMPLETED;X",
    ].join("\n"))
    expect(out[0].concept).toBe("Gasto")
  })

  it("sin fecha válida se descarta la fila", () => {
    const out = parseRevolutExpenses([
      "Fecha de inicio;Descripción;Importe;Estado;Producto",
      "ayer;Cosa;-10;COMPLETED;X",
    ].join("\n"))
    expect(out).toHaveLength(0)
  })

  it("devuelve los gastos ordenados por fecha y hora", () => {
    const out = parseRevolutExpenses([
      "Fecha de inicio;Descripción;Importe;Estado;Producto",
      "20/11/2026 10:00;B;-20;COMPLETED;X",
      "19/11/2026 22:00;A;-10;COMPLETED;X",
      "20/11/2026 09:00;C;-5;COMPLETED;X",
    ].join("\n"))
    expect(out.map((r) => r.concept)).toEqual(["A", "C", "B"])
  })

  it("varias filas reales: compras, reembolsos y a ignorar", () => {
    const out = parseRevolutExpenses([
      "Fecha de inicio;Descripción;Importe;Estado;Producto",
      "2026-11-01 10:00:00;Mercadona Calle Falsa 3;-52.4;COMPLETED;Principal",
      "2026-11-02 18:30:00;Restaurante Chido;-34.2;COMPLETED;Principal",
      "2026-11-02 18:35:00;Reembolso Restaurante Chido;34.2;COMPLETED;Principal",
      "2026-11-03 08:00:00;Gasolinera Repsol;-60;COMPLETED;Principal",
      "2026-11-03 08:01:00;Desde Mi Cuenta Ahorros;-150;COMPLETED;Principal",
      "2026-11-04 00:00:00;To Savings Vault;-150;COMPLETED;Principal",
      "2026-11-05 12:00:00;Cine Yelmo;-12.99;REVERTED;Principal",
      "2026-11-06 12:00:00;Netflix;-13.99;COMPLETED;Principal",
    ].join("\n"))
    expect(out.map((r) => r.concept)).toEqual(["Mercadona Calle Falsa 3", "Restaurante Chido", "Gasolinera Repsol", "Netflix"])
    expect(out[0]).toMatchObject({ amount: 52.4, date: "2026-11-01" })
    expect(out[3]).toMatchObject({ amount: 13.99 })
  })
})

describe("monthsInCsv", () => {
  it("agrupa por mes, del más reciente al más antiguo", () => {
    const rows = parseRevolutExpenses([
      "Fecha de inicio;Descripción;Importe;Estado;Producto",
      "2026-11-01 10:00:00;A;-10;COMPLETED;X",
      "2026-11-15 10:00:00;B;-5.5;COMPLETED;X",
      "2026-10-20 10:00:00;C;-30;COMPLETED;X",
      "2026-10-21 10:00:00;D;-2;COMPLETED;X",
      "2026-09-30 10:00:00;E;-1;COMPLETED;X",
    ].join("\n"))
    const months = monthsInCsv(rows)
    expect(months.map((m) => m.month)).toEqual(["2026-11", "2026-10", "2026-09"])
    expect(months[0]).toMatchObject({ count: 2, total: 15.5 })
    expect(months[1]).toMatchObject({ count: 2, total: 32 })
  })

  it("lista vacía", () => {
    expect(monthsInCsv([])).toEqual([])
  })
})

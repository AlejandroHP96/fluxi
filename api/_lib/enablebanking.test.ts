import { generateKeyPairSync, createVerify } from "node:crypto"
import { describe, expect, it } from "vitest"
import { makeJwt, toExpenses, type EbTransaction } from "./enablebanking"

describe("makeJwt", () => {
  it("firma un JWT RS256 con kid = app id y las claims que pide Enable Banking", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 })
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString()
    const jwt = makeJwt("app-123", pem, 1_000_000)
    const [h, p, sig] = jwt.split(".")
    expect(JSON.parse(Buffer.from(h, "base64url").toString())).toEqual({ typ: "JWT", alg: "RS256", kid: "app-123" })
    expect(JSON.parse(Buffer.from(p, "base64url").toString())).toEqual({
      iss: "enablebanking.com",
      aud: "api.enablebanking.com",
      iat: 1_000_000,
      exp: 1_003_600,
    })
    const v = createVerify("RSA-SHA256")
    v.update(`${h}.${p}`)
    expect(v.verify(publicKey, Buffer.from(sig, "base64url"))).toBe(true)
  })
})

describe("toExpenses", () => {
  const tx = (o: Partial<EbTransaction>): EbTransaction => ({
    transaction_amount: { amount: "12.30", currency: "EUR" },
    credit_debit_indicator: "DBIT",
    status: "BOOK",
    booking_date: "2026-11-19",
    creditor: { name: "Mercadona" },
    ...o,
  })

  it("convierte cargos contabilizados al formato del CSV", () => {
    expect(toExpenses([tx({})])).toEqual([{ date: "2026-11-19", time: "", concept: "Mercadona", amount: 12.3, ref: "2026-11-19|12.3|Mercadona" }])
  })

  it("usa el id del banco como ref y distingue movimientos iguales sin id", () => {
    expect(toExpenses([tx({ entry_reference: "abc" })])[0].ref).toBe("abc")
    expect(toExpenses([tx({}), tx({})]).map((e) => e.ref)).toEqual(["2026-11-19|12.3|Mercadona", "2026-11-19|12.3|Mercadona#2"])
  })

  it("ignora abonos, pendientes y otras monedas", () => {
    expect(
      toExpenses([
        tx({ credit_debit_indicator: "CRDT" }),
        tx({ status: "PDNG" }),
        tx({ transaction_amount: { amount: "5", currency: "USD" } }),
      ])
    ).toEqual([])
  })

  it("usa el texto de la transferencia si no hay acreedor y ordena por fecha", () => {
    const out = toExpenses([
      tx({ booking_date: "2026-11-20", creditor: undefined, remittance_information: ["Pago", "  Gimnasio "] }),
      tx({ booking_date: "2026-11-01", transaction_amount: { amount: "-7.5", currency: "EUR" } }),
    ])
    expect(out.map((e) => [e.date, e.concept, e.amount])).toEqual([
      ["2026-11-01", "Mercadona", 7.5],
      ["2026-11-20", "Pago Gimnasio", 12.3],
    ])
  })
})

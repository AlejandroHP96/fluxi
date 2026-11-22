import { describe, expect, it } from "vitest"
import { fromB64url, LOCK_AFTER_MS, shouldLock, toB64url } from "./biometricLock"

describe("biometricLock", () => {
  it("bloquea solo tras más de 5 minutos fuera", () => {
    expect(shouldLock(null, 10_000_000)).toBe(false)
    expect(shouldLock(1_000, 1_000 + LOCK_AFTER_MS)).toBe(false)
    expect(shouldLock(1_000, 1_000 + LOCK_AFTER_MS + 1)).toBe(true)
  })
  it("base64url ida y vuelta", () => {
    const bytes = new Uint8Array([0, 1, 250, 251, 252, 253, 254, 255, 62, 63])
    const s = toB64url(bytes)
    expect(s).not.toMatch(/[+/=]/)
    expect(Array.from(fromB64url(s))).toEqual(Array.from(bytes))
  })
})

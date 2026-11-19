import Papa from "papaparse"
import type { NewTransaction, NewTransfer } from "../types"
import { isOwnTransfer, ownTransferKind } from "./finance"
import { categorize } from "./categorize"

/**
 * Deduce la categoría (reglas de serie de src/utils/categorize.ts y, si se pasan, las tuyas)
 */
export function guessCategory(description: string, isIncome: boolean, userRules: Record<string, string> = {}): string {
  return categorize(description, isIncome, userRules)
}

/**
 * Parsea fechas y horas de extractos bancarios a formato YYYY-MM-DD HH:mm (o YYYY-MM-DD si no hay hora)
 */
export function normalizeDate(str: string): string {
  if (!str) return new Date().toISOString().slice(0, 16).replace("T", " ")

  const trimmed = str.trim()

  // 1. Formato YYYY-MM-DD HH:mm(:ss)?
  const mIsoTime = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})\s+(\d{1,2}):(\d{2})/)
  if (mIsoTime) {
    return `${mIsoTime[1]}-${mIsoTime[2].padStart(2, "0")}-${mIsoTime[3].padStart(2, "0")} ${mIsoTime[4].padStart(2, "0")}:${mIsoTime[5]}`
  }

  // 2. Formato DD/MM/YYYY HH:mm(:ss)?
  const mEuTime = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})\s+(\d{1,2}):(\d{2})/)
  if (mEuTime) {
    return `${mEuTime[3]}-${mEuTime[2].padStart(2, "0")}-${mEuTime[1].padStart(2, "0")} ${mEuTime[4].padStart(2, "0")}:${mEuTime[5]}`
  }

  // 3. Formato solo fecha YYYY-MM-DD
  const mIso = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (mIso) {
    return `${mIso[1]}-${mIso[2].padStart(2, "0")}-${mIso[3].padStart(2, "0")}`
  }

  // 4. Formato solo fecha DD/MM/YYYY
  const mEu = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/)
  if (mEu) {
    return `${mEu[3]}-${mEu[2].padStart(2, "0")}-${mEu[1].padStart(2, "0")}`
  }

  // 5. Fallback con Date constructor
  const parsed = new Date(trimmed)
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 16).replace("T", " ")
  }

  return new Date().toISOString().slice(0, 16).replace("T", " ")
}

export interface RevolutBalance {
  balance: number
  date: string // "YYYY-MM-DD HH:mm" del último movimiento completado de esa cuenta
}

export interface RevolutStatement {
  transactions: NewTransaction[] // gastos e ingresos (salen en Transacciones)
  transfers: NewTransfer[] // ahorro, intereses y traspasos con tus otras cuentas (solo en Finanzas)
  balances: { current?: RevolutBalance; savings?: RevolutBalance } // saldo final de cada cuenta
}

/**
 * Parsea un CSV de Revolut exportado desde la app o web.
 * - Filas de la cuenta de Ahorros (Producto "Depósito"): aportaciones, retiradas e intereses -> transfers.
 * - Filas de la cuenta (Producto "Actual"): las transferencias a/desde Ahorros se descartan (ya están
 *   en las filas de Ahorros); las transferencias con tus otras cuentas (ownNames) -> transfers;
 *   el resto -> transactions.
 */
export function parseRevolutStatement(
  csvText: string,
  ownNames: string[] = [],
  categoryRules: Record<string, string> = {}
): RevolutStatement {
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  const rows = result.data as Record<string, string>[]
  const out: RevolutStatement = { transactions: [], transfers: [], balances: {} }

  for (const row of rows) {
    const state = row["State"] || row["Estado"] || "COMPLETED"
    if (state && !/COMPLETED|COMPLETADO/i.test(state)) {
      continue
    }

    const rawDesc = row["Description"] || row["Descripción"] || row["Concepto"] || ""
    const rawAmount = row["Amount"] || row["Importe"] || "0"
    const rawDate = row["Started Date"] || row["Fecha de inicio"] || row["Completed Date"] || row["Fecha de finalización"] || row["Date"] || row["Fecha"] || ""
    const product = row["Producto"] || row["Product"] || ""
    const isSavingsAccount = /dep[oó]sito|deposit|savings|ahorro/i.test(product)

    // Saldo final de cada cuenta: el del último movimiento completado (por fecha de finalización)
    const rawBalance = row["Saldo"] || row["Balance"] || ""
    const completedDate = normalizeDate(row["Completed Date"] || row["Fecha de finalización"] || rawDate)
    const balance = parseFloat(rawBalance.replace(/[^0-9.-]/g, ""))
    if (rawBalance && !isNaN(balance)) {
      const key = isSavingsAccount ? "savings" : "current"
      const prev = out.balances[key]
      if (!prev || completedDate >= prev.date) out.balances[key] = { balance, date: completedDate }
    }

    const cleanAmount = parseFloat(rawAmount.replace(/[^0-9.-]/g, ""))
    if (isNaN(cleanAmount) || cleanAmount === 0) continue
    const formattedDate = normalizeDate(rawDate)

    if (isSavingsAccount) {
      const isInterest = /inter[eé]s|interest/i.test(`${row["Tipo"] || row["Type"] || ""} ${rawDesc}`)
      out.transfers.push({
        date: formattedDate,
        amount: cleanAmount,
        kind: isInterest ? "interest" : cleanAmount > 0 ? "savings_in" : "savings_out",
        description: rawDesc.trim(),
      })
      continue
    }

    // Traspasos internos a/desde la cuenta de ahorro de Revolut e intereses diarios
    // Ejemplos: "A EUR Ahorros", "Desde EUR Ahorros", "To EUR Savings", "Interés neto pagado a Ahorros", "Vault", etc.
    const isSavingTransfer =
      /^(A|Desde|To|From)\s+.*(Ahorros|Savings|Vault|Pocket|Bolsillo)/i.test(rawDesc) ||
      /\b(Ahorros|Vault|Pocket)\b/i.test(rawDesc) && /^(A|Desde|To|From)\s+/i.test(rawDesc) ||
      /inter[eé]s.*(ahorros|savings|vault)/i.test(rawDesc)
    if (isSavingTransfer) {
      continue
    }

    if (isOwnTransfer(rawDesc, ownNames)) {
      out.transfers.push({
        date: formattedDate,
        amount: cleanAmount,
        kind: ownTransferKind(cleanAmount),
        description: rawDesc.trim(),
      })
      continue
    }

    const isIncome = cleanAmount > 0
    const type = isIncome ? "income" : "expense"
    const category = guessCategory(rawDesc, isIncome, categoryRules)

    out.transactions.push({
      description: rawDesc.trim() || (isIncome ? "Ingreso" : "Gasto"),
      amount: cleanAmount,
      date: formattedDate,
      type,
      category,
    })
  }

  return out
}

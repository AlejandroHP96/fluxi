import Papa from "papaparse"
import type { NewTransaction } from "../types"

/**
 * Deduce automáticamente una categoría en base a palabras clave comunes
 */
export function guessCategory(description: string, isIncome: boolean): string {
  if (isIncome) return "Ingresos"

  const desc = description.toLowerCase()

  if (/mercadona|carrefour|lidl|dia|aldi|eroski|alcampo|supermercado|fruteria|panaderia|consum|hipercor/i.test(desc)) {
    return "Alimentación"
  }
  if (/uber|cabify|bolt|metro|renfe|repsol|cepsa|bp|gasolinera|peaje|autobus|alvia|parking|emt/i.test(desc)) {
    return "Transporte"
  }
  if (/netflix|spotify|disney|apple|google|amazon prime|hbo|youtube|dazn|icloud/i.test(desc)) {
    return "Suscripciones"
  }
  if (/bar|restaurante|cafe|burger|mcdonald|kfc|pizza|telepizza|glovo|just eat|starbucks|tapas|cerveceria/i.test(desc)) {
    return "Ocio"
  }
  if (/cine|teatro|concierto|steam|playstation|nintendo|game|entradas/i.test(desc)) {
    return "Ocio"
  }
  if (/farmacia|clinica|hospital|dentista|optica|sanitas|asisa|medico/i.test(desc)) {
    return "Salud"
  }
  if (/alquiler|hipoteca|comunidad|hogar|ikea|leroy|bricomart/i.test(desc)) {
    return "Vivienda"
  }
  if (/luz|agua|gas|endesa|iberdrola|naturgy|vodafone|movistar|orange|digi|yoigo/i.test(desc)) {
    return "Suministros"
  }
  if (/zara|stradivarius|pull|bershka|mango|amazon|corte ingles|shein|aliexpress|primark/i.test(desc)) {
    return "Compras"
  }

  return "Otro"
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

/**
 * Parsea un CSV de Revolut exportado desde la app o web
 */
export function parseRevolutCsv(csvText: string, ignoreSavingsTransfers = true): NewTransaction[] {
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  const rows = result.data as Record<string, string>[]
  const transactions: NewTransaction[] = []

  for (const row of rows) {
    const state = row["State"] || row["Estado"] || "COMPLETED"
    if (state && !/COMPLETED|COMPLETADO/i.test(state)) {
      continue
    }

    const rawDesc = row["Description"] || row["Descripción"] || row["Concepto"] || ""
    const rawAmount = row["Amount"] || row["Importe"] || "0"
    const rawDate = row["Started Date"] || row["Fecha de inicio"] || row["Completed Date"] || row["Fecha de finalización"] || row["Date"] || row["Fecha"] || ""

    // Filtrar traspasos internos a/desde la cuenta de ahorro de Revolut e intereses diarios
    // Ejemplos: "A EUR Ahorros", "Desde EUR Ahorros", "To EUR Savings", "Interés neto pagado a Ahorros", "Vault", etc.
    if (ignoreSavingsTransfers) {
      const isSavingTransfer =
        /^(A|Desde|To|From)\s+.*(Ahorros|Savings|Vault|Pocket|Bolsillo)/i.test(rawDesc) ||
        /\b(Ahorros|Vault|Pocket)\b/i.test(rawDesc) && /^(A|Desde|To|From)\s+/i.test(rawDesc) ||
        /inter[eé]s.*(ahorros|savings|vault)/i.test(rawDesc)
      if (isSavingTransfer) {
        continue
      }
    }

    const cleanAmount = parseFloat(rawAmount.replace(/[^0-9.-]/g, ""))
    if (isNaN(cleanAmount) || cleanAmount === 0) continue

    const formattedDate = normalizeDate(rawDate)
    const isIncome = cleanAmount > 0
    const type = isIncome ? "income" : "expense"
    const category = guessCategory(rawDesc, isIncome)

    transactions.push({
      description: rawDesc.trim() || (isIncome ? "Ingreso" : "Gasto"),
      amount: cleanAmount,
      date: formattedDate,
      type,
      category,
    })
  }

  return transactions
}

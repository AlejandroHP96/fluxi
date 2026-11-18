import Papa from "papaparse"
import { CATEGORIES } from "../constants/categories"
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
 * Parsea un CSV de Revolut exportado desde la app o web
 */
export function parseRevolutCsv(csvText: string): NewTransaction[] {
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  const rows = result.data as Record<string, string>[]
  const transactions: NewTransaction[] = []

  for (const row of rows) {
    // Columnas típicas de Revolut en ES o EN:
    // Description | Descripción
    // Amount | Importe
    // Started Date | Completed Date | Fecha de inicio | Fecha de finalización
    // State | Estado: COMPLETED | COMPLETADO
    const state = row["State"] || row["Estado"] || "COMPLETED"
    if (state && !/COMPLETED|COMPLETADO/i.test(state)) {
      continue
    }

    const rawDesc = row["Description"] || row["Descripción"] || row["Concepto"] || ""
    const rawAmount = row["Amount"] || row["Importe"] || "0"
    const rawDate = row["Completed Date"] || row["Started Date"] || row["Fecha de finalización"] || row["Fecha de inicio"] || row["Date"] || row["Fecha"] || ""

    const cleanAmount = parseFloat(rawAmount.replace(/[^0-9.-]/g, ""))
    if (isNaN(cleanAmount) || cleanAmount === 0) continue

    // Normalizar fecha a YYYY-MM-DD
    let formattedDate = new Date().toISOString().split("T")[0]
    if (rawDate) {
      const parsedDate = new Date(rawDate)
      if (!isNaN(parsedDate.getTime())) {
        formattedDate = parsedDate.toISOString().split("T")[0]
      }
    }

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

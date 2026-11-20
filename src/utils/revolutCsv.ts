import Papa from "papaparse"

// Gasto leído del CSV de Revolut (aún sin categoría ni guardar)
export interface CsvExpense {
  date: string // "YYYY-MM-DD" (fecha de inicio: cuando se hizo la compra)
  time: string // "HH:mm" o ""
  concept: string
  amount: number // positivo
}

const pad = (n: string | number) => String(n).padStart(2, "0")

// "2026-11-19 10:40:50" o "19/11/2026 10:40" -> ["2026-11-19", "10:40"]
function splitDate(raw: string): [string, string] {
  const s = raw.trim()
  const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/)
  if (iso) return [`${iso[1]}-${pad(iso[2])}-${pad(iso[3])}`, iso[4] ? `${pad(iso[4])}:${iso[5]}` : ""]
  const eu = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:[ T](\d{1,2}):(\d{2}))?/)
  if (eu) return [`${eu[3]}-${pad(eu[2])}-${pad(eu[1])}`, eu[4] ? `${pad(eu[4])}:${eu[5]}` : ""]
  return ["", ""]
}

// Traspasos con la cuenta de Ahorros e intereses: no son gastos
const SAVINGS_TRANSFER = /^(A|Desde|To|From)\s+.*(Ahorros|Savings|Vault|Pocket|Bolsillo)|inter[eé]s.*(ahorros|savings|vault)/i

/**
 * Gastos del CSV de Revolut: movimientos completados, en negativo, de la cuenta principal
 * (no de Ahorros/Depósito) y que no sean traspasos a/desde Ahorros. Ingresos y reembolsos se ignoran.
 */
// Importe con punto o coma decimal y separador de miles opcional: "-45.30", "-45,30", "-1.234,56", "-1,234.56".
// El separador decimal es el último que aparece, salvo que se repita o lleve justo 3 cifras detrás (entonces es de miles)
export function parseCsvAmount(raw: string): number {
  const t = raw.replace(/[^0-9.,-]/g, "")
  const last = Math.max(t.lastIndexOf("."), t.lastIndexOf(","))
  if (last === -1) return parseFloat(t)
  const sep = t[last]
  const isThousands = t.split(sep).length > 2 || (t.length - last - 1 === 3 && !/[.,]/.test(t.slice(0, last)))
  if (isThousands) return parseFloat(t.replace(/[.,]/g, ""))
  return parseFloat(t.slice(0, last).replace(/[.,]/g, "") + "." + t.slice(last + 1))
}

export function parseRevolutExpenses(csvText: string): CsvExpense[] {
  const rows = Papa.parse(csvText, { header: true, skipEmptyLines: true }).data as Record<string, string>[]
  const out: CsvExpense[] = []
  for (const row of rows) {
    const state = row["State"] || row["Estado"] || "COMPLETED"
    if (!/COMPLETED|COMPLETADO/i.test(state)) continue
    if (/dep[oó]sito|deposit|savings|ahorro/i.test(row["Producto"] || row["Product"] || "")) continue
    const concept = (row["Descripción"] || row["Description"] || row["Concepto"] || "").trim()
    if (SAVINGS_TRANSFER.test(concept)) continue
    const amount = parseCsvAmount(String(row["Importe"] || row["Amount"] || "0"))
    if (isNaN(amount) || amount >= 0) continue
    const [date, time] = splitDate(row["Fecha de inicio"] || row["Started Date"] || row["Fecha de finalización"] || row["Completed Date"] || "")
    if (!date) continue
    out.push({ date, time, concept: concept || "Gasto", amount: Math.round(-amount * 100) / 100 })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
}

// Meses con gastos en el CSV, del más reciente al más antiguo
export function monthsInCsv(rows: CsvExpense[]): Array<{ month: string; count: number; total: number }> {
  const map = new Map<string, { month: string; count: number; total: number }>()
  for (const r of rows) {
    const month = r.date.slice(0, 7)
    const m = map.get(month) || { month, count: 0, total: 0 }
    m.count += 1
    m.total += r.amount
    map.set(month, m)
  }
  return [...map.values()].sort((a, b) => b.month.localeCompare(a.month))
}

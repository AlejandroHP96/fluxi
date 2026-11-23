import { timingSafeEqual } from "node:crypto"
import { accessToken, fromFields, gfetch, serviceAccount } from "./_lib/google.js"
import { buildMonthSheet, monthsOfLastWeek, type BudgetDoc, type CellRange, type Tone } from "./_lib/seguimiento.js"
import type { Expense } from "../src/types/budget.js"

// Cron de Vercel (cada lunes, ver vercel.json): pone al día en el «Seguimiento» de Google Sheets la pestaña
// de cada mes de la semana que acaba de terminar (uno, o dos si la semana cruza de mes; así el mes que
// cierra queda completo). ?month=YYYY-MM rehace (o crea) la de ese mes. Si la pestaña ya existe se
// sobrescribe, así que repetirlo no duplica nada.
//
// Variables de Vercel: CRON_SECRET (Vercel lo manda como «Authorization: Bearer …»), FIREBASE_SERVICE_ACCOUNT
// (JSON de la cuenta de servicio; la hoja tiene que estar compartida con su client_email como editor),
// SEGUIMIENTO_SHEET_ID y FLUXI_OWNER_UID (uid del dueño del presupuesto).

const authorized = (header: string | null) => {
  const secret = process.env.CRON_SECRET
  if (!secret || !header) return false
  const a = Buffer.from(header)
  const b = Buffer.from(`Bearer ${secret}`)
  return a.length === b.length && timingSafeEqual(a, b)
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

// Fondo claro y texto oscuro del mismo tono, como los avisos de la app
const rgb = (hex: string) => ({
  red: parseInt(hex.slice(1, 3), 16) / 255,
  green: parseInt(hex.slice(3, 5), 16) / 255,
  blue: parseInt(hex.slice(5, 7), 16) / 255,
})
const TONES: Record<Tone, { bg: string; fg: string }> = {
  ok: { bg: "#d9f2e3", fg: "#137333" },
  casi: { bg: "#fdf0c7", fg: "#8a5a00" },
  pasado: { bg: "#fbe0dd", fg: "#b3261e" },
}

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request.headers.get("authorization"))) return json(401, { error: "No autorizado" })
  const sheetId = process.env.SEGUIMIENTO_SHEET_ID
  const owner = process.env.FLUXI_OWNER_UID
  if (!sheetId || !owner) return json(500, { error: "Faltan SEGUIMIENTO_SHEET_ID o FLUXI_OWNER_UID" })

  const asked = new URL(request.url).searchParams.get("month")
  if (asked && !/^\d{4}-(0[1-9]|1[0-2])$/.test(asked)) return json(400, { error: "month tiene que ser YYYY-MM" })
  const months = asked ? [asked] : monthsOfLastWeek()

  try {
    const sa = serviceAccount()
    const token = await accessToken(sa, ["https://www.googleapis.com/auth/datastore", "https://www.googleapis.com/auth/spreadsheets"])

    // Datos del presupuesto (la cuenta de servicio no pasa por las reglas de Firestore)
    const docs = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`
    const budgetDoc = await gfetch<{ fields?: Record<string, never> }>(token, `${docs}/budgets/${encodeURIComponent(owner)}`)
    const budget = fromFields(budgetDoc.fields) as BudgetDoc
    const found = await gfetch<Array<{ document?: { name: string; fields?: Record<string, never> } }>>(token, `${docs}:runQuery`, {
      method: "POST",
      body: {
        structuredQuery: {
          from: [{ collectionId: "expenses" }],
          where: { fieldFilter: { field: { fieldPath: "userId" }, op: "EQUAL", value: { stringValue: owner } } },
        },
      },
    })
    const expenses = found
      .filter((r) => r.document)
      .map((r) => ({ id: r.document!.name.split("/").pop()!, ...fromFields(r.document!.fields) }) as Expense)

    const api = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}`
    const done = []
    for (const month of months) {
      const sheet = buildMonthSheet(month, expenses, budget)

      // Pestaña del mes: se crea (delante de las demás) o se vacía si ya estaba
      const meta = await gfetch<{ sheets: Array<{ properties: { sheetId: number; title: string } }> }>(token, `${api}?fields=sheets.properties`)
      let tabId = meta.sheets.find((s) => s.properties.title === month)?.properties.sheetId
      if (tabId === undefined) {
        const added = await gfetch<{ replies: Array<{ addSheet: { properties: { sheetId: number } } }> }>(token, `${api}:batchUpdate`, {
          method: "POST",
          body: { requests: [{ addSheet: { properties: { title: month, index: 0 } } }] },
        })
        tabId = added.replies[0].addSheet.properties.sheetId
        // La hoja vacía con la que nace el archivo («Hoja 1») sobra en cuanto hay un mes
        const blank = meta.sheets.find((s) => /^(Hoja ?1|Sheet1)$/.test(s.properties.title))
        if (blank) await gfetch(token, `${api}:batchUpdate`, { method: "POST", body: { requests: [{ deleteSheet: { sheetId: blank.properties.sheetId } }] } })
      } else {
        await gfetch(token, `${api}/values/${encodeURIComponent(`'${month}'`)}:clear`, { method: "POST", body: {} })
      }

      await gfetch(token, `${api}/values/${encodeURIComponent(`'${month}'!A1`)}?valueInputOption=USER_ENTERED`, {
        method: "PUT",
        body: { values: sheet.rows },
      })

      const range = (r: CellRange) => ({
        sheetId: tabId, startRowIndex: r.startRow, endRowIndex: r.endRow, startColumnIndex: r.startCol, endColumnIndex: r.endCol,
      })
      await gfetch(token, `${api}:batchUpdate`, {
        method: "POST",
        body: {
          requests: [
            // Sin el formato de la vez anterior (las filas pueden haber cambiado de sitio)
            { repeatCell: { range: { sheetId: tabId }, cell: {}, fields: "userEnteredFormat" } },
            ...sheet.bold.map((r) => ({
              repeatCell: { range: range(r), cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: "userEnteredFormat.textFormat.bold" },
            })),
            ...sheet.money.map((r) => ({
              repeatCell: {
                range: range(r),
                cell: { userEnteredFormat: { numberFormat: { type: "CURRENCY", pattern: "#,##0.00 \"€\"" } } },
                fields: "userEnteredFormat.numberFormat",
              },
            })),
            ...sheet.tones.map(({ range: r, tone }) => ({
              repeatCell: {
                range: range(r),
                cell: {
                  userEnteredFormat: {
                    backgroundColor: rgb(TONES[tone].bg),
                    textFormat: { foregroundColor: rgb(TONES[tone].fg), bold: true },
                  },
                },
                fields: "userEnteredFormat.backgroundColor,userEnteredFormat.textFormat.foregroundColor,userEnteredFormat.textFormat.bold",
              },
            })),
            { autoResizeDimensions: { dimensions: { sheetId: tabId, dimension: "COLUMNS", startIndex: 0, endIndex: 7 } } },
          ],
        },
      })
      done.push({ month, expenses: expenses.filter((e) => e.date.startsWith(month)).length })
    }

    return json(200, { months: done, sheet: `https://docs.google.com/spreadsheets/d/${sheetId}` })
  } catch (e) {
    console.error(e)
    return json(500, { error: (e as Error).message })
  }
}

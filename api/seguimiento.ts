import { timingSafeEqual } from "node:crypto"
import { accessToken, fromFields, gfetch, serviceAccount } from "./_lib/google.js"
import { buildMonthSheet, monthsOfLastWeek, tabTitle, type BudgetDoc, type CellRange, type MonthSheet, type Style, type Tone } from "./_lib/seguimiento.js"
import type { Expense } from "../src/types/budget.js"

// Cron de Vercel (cada lunes, ver vercel.json): pone al día en el «Seguimiento» de Google Sheets la pestaña
// de cada mes de la semana que acaba de terminar (uno, o dos si la semana cruza de mes; así el mes que
// cierra queda completo). ?month=YYYY-MM rehace (o crea) la de ese mes. La pestaña se crea de nuevo cada
// vez (con sus gráficas), en el mismo sitio, así que repetirlo no duplica nada.
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

const rgb = (hex: string) => ({
  red: parseInt(hex.slice(1, 3), 16) / 255,
  green: parseInt(hex.slice(3, 5), 16) / 255,
  blue: parseInt(hex.slice(5, 7), 16) / 255,
})
// Fondo claro y texto oscuro del mismo tono, como los avisos de la app
const TONES: Record<Tone, { bg: string; fg: string }> = {
  ok: { bg: "#d9f2e3", fg: "#137333" },
  casi: { bg: "#fdf0c7", fg: "#8a5a00" },
  pasado: { bg: "#fbe0dd", fg: "#b3261e" },
}
const STYLES: Record<Style, { bg?: string; fg?: string; bold?: boolean; size?: number; italic?: boolean; align?: string; padTop?: boolean }> = {
  title: { bg: "#0f172a", fg: "#ffffff", bold: true, size: 18 },
  subtitle: { bg: "#0f172a", fg: "#94a3b8", italic: true, size: 10 },
  kpiLabel: { bg: "#f1f5f9", fg: "#64748b", size: 9 },
  kpiValue: { bg: "#f1f5f9", fg: "#0f172a", bold: true, size: 14 },
  section: { fg: "#0e7490", bold: true, size: 12 },
  header: { bg: "#e2e8f0", fg: "#334155", bold: true },
  total: { bg: "#f8fafc", fg: "#0f172a", bold: true },
}

// Peticiones de formato, combinaciones y gráficas para una pestaña ya escrita
function formatRequests(tabId: number, sheet: MonthSheet) {
  const range = (r: CellRange) => ({
    sheetId: tabId, startRowIndex: r.startRow, endRowIndex: r.endRow, startColumnIndex: r.startCol, endColumnIndex: r.endCol,
  })
  const numberFormat = (r: CellRange, type: string, pattern: string) => ({
    repeatCell: { range: range(r), cell: { userEnteredFormat: { numberFormat: { type, pattern } } }, fields: "userEnteredFormat.numberFormat" },
  })
  return [
    {
      updateSheetProperties: {
        properties: {
          sheetId: tabId,
          gridProperties: { hideGridlines: true },
          ...(sheet.tone ? { tabColorStyle: { rgbColor: rgb(TONES[sheet.tone].fg) } } : {}),
        },
        fields: sheet.tone ? "gridProperties.hideGridlines,tabColorStyle" : "gridProperties.hideGridlines",
      },
    },
    // Fuente y alineación de toda la pestaña
    {
      repeatCell: {
        range: { sheetId: tabId },
        cell: { userEnteredFormat: { textFormat: { fontFamily: "Arial", fontSize: 10, foregroundColor: rgb("#1e293b") }, verticalAlignment: "MIDDLE" } },
        fields: "userEnteredFormat.textFormat,userEnteredFormat.verticalAlignment",
      },
    },
    ...sheet.widths.map((px, i) => ({
      updateDimensionProperties: {
        range: { sheetId: tabId, dimension: "COLUMNS", startIndex: i, endIndex: i + 1 },
        properties: { pixelSize: px },
        fields: "pixelSize",
      },
    })),
    { updateDimensionProperties: { range: { sheetId: tabId, dimension: "ROWS", startIndex: 0, endIndex: 1 }, properties: { pixelSize: 44 }, fields: "pixelSize" } },
    { updateDimensionProperties: { range: { sheetId: tabId, dimension: "ROWS", startIndex: 4, endIndex: 5 }, properties: { pixelSize: 34 }, fields: "pixelSize" } },
    ...sheet.merges.map((r) => ({ mergeCells: { range: range(r), mergeType: "MERGE_ALL" } })),
    ...sheet.styles.map(({ range: r, style }) => {
      const st = STYLES[style]
      return {
        repeatCell: {
          range: range(r),
          cell: {
            userEnteredFormat: {
              ...(st.bg ? { backgroundColor: rgb(st.bg) } : {}),
              textFormat: {
                fontFamily: "Arial",
                fontSize: st.size ?? 10,
                bold: !!st.bold,
                italic: !!st.italic,
                foregroundColor: rgb(st.fg ?? "#1e293b"),
              },
              verticalAlignment: "MIDDLE",
            },
          },
          fields: `userEnteredFormat.textFormat,userEnteredFormat.verticalAlignment${st.bg ? ",userEnteredFormat.backgroundColor" : ""}`,
        },
      }
    }),
    // Línea bajo las cabeceras de las tablas
    ...sheet.styles.filter((x) => x.style === "header").map(({ range: r }) => ({
      updateBorders: { range: range(r), bottom: { style: "SOLID", width: 1, colorStyle: { rgbColor: rgb("#94a3b8") } } },
    })),
    ...sheet.money.map((r) => numberFormat(r, "CURRENCY", "#,##0.00 \"€\"")),
    ...sheet.percent.map((r) => numberFormat(r, "PERCENT", "0%")),
    ...sheet.tones.map(({ range: r, tone }) => ({
      repeatCell: {
        range: range(r),
        cell: { userEnteredFormat: { backgroundColor: rgb(TONES[tone].bg), textFormat: { foregroundColor: rgb(TONES[tone].fg), bold: true } } },
        fields: "userEnteredFormat.backgroundColor,userEnteredFormat.textFormat.foregroundColor,userEnteredFormat.textFormat.bold",
      },
    })),
    // Datos de las gráficas, ocultos
    {
      updateDimensionProperties: {
        range: { sheetId: tabId, dimension: "COLUMNS", startIndex: sheet.hidden.startCol, endIndex: sheet.hidden.endCol },
        properties: { hiddenByUser: true },
        fields: "hiddenByUser",
      },
    },
    ...sheet.charts.map((c) => ({
      addChart: {
        chart: {
          spec: {
            title: c.title,
            titleTextFormat: { bold: true, fontSize: 12, foregroundColor: rgb("#0f172a") },
            fontName: "Arial",
            hiddenDimensionStrategy: "SHOW_ALL",
            basicChart: {
              chartType: c.type,
              legendPosition: "BOTTOM_LEGEND",
              headerCount: 1,
              axis: [{ position: "BOTTOM_AXIS" }, { position: "LEFT_AXIS" }],
              domains: [{ domain: { sourceRange: { sources: [range(c.domain)] } } }],
              series: c.series.map((x) => ({
                series: { sourceRange: { sources: [range(x.range)] } },
                targetAxis: c.type === "BAR" ? "BOTTOM_AXIS" : "LEFT_AXIS",
                colorStyle: { rgbColor: rgb(x.color) },
                ...(c.type === "LINE" ? { lineStyle: { width: 3 } } : {}),
              })),
            },
          },
          position: {
            overlayPosition: { anchorCell: { sheetId: tabId, rowIndex: c.anchor.row, columnIndex: c.anchor.col }, widthPixels: c.width, heightPixels: c.height },
          },
        },
      },
    })),
  ]
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
      const title = tabTitle(month)

      // Pestaña nueva en el sitio de la anterior (si la había): así no quedan gráficas, combinaciones ni
      // formatos viejos. Se crea con otro nombre, se borra la vieja y se renombra (no se puede borrar la única)
      const meta = await gfetch<{ sheets: Array<{ properties: { sheetId: number; title: string; index: number } }> }>(
        token, `${api}?fields=sheets.properties`,
      )
      // Las pestañas antiguas se llamaban «2026-11»: también se sustituyen
      const old = meta.sheets.find((s) => s.properties.title === title || s.properties.title === month)?.properties
      const blank = meta.sheets.find((s) => /^(Hoja ?1|Sheet1)$/.test(s.properties.title))?.properties
      const added = await gfetch<{ replies: Array<{ addSheet?: { properties: { sheetId: number } } }> }>(token, `${api}:batchUpdate`, {
        method: "POST",
        body: {
          requests: [
            { addSheet: { properties: { title: `${title} (nueva)`, index: old ? old.index : 0, gridProperties: { rowCount: Math.max(200, sheet.rows.length + 60), columnCount: 20 } } } },
            ...(old ? [{ deleteSheet: { sheetId: old.sheetId } }] : []),
            // La hoja vacía con la que nace el archivo («Hoja 1») sobra en cuanto hay un mes
            ...(blank ? [{ deleteSheet: { sheetId: blank.sheetId } }] : []),
          ],
        },
      })
      const tabId = added.replies[0].addSheet!.properties.sheetId
      await gfetch(token, `${api}:batchUpdate`, {
        method: "POST",
        body: { requests: [{ updateSheetProperties: { properties: { sheetId: tabId, title }, fields: "title" } }] },
      })

      await gfetch(token, `${api}/values/${encodeURIComponent(`'${title}'!A1`)}?valueInputOption=RAW`, {
        method: "PUT",
        body: { values: sheet.rows },
      })
      await gfetch(token, `${api}:batchUpdate`, { method: "POST", body: { requests: formatRequests(tabId, sheet) } })
      done.push({ month, tab: title, expenses: expenses.filter((e) => e.date.startsWith(month)).length })
    }

    return json(200, { months: done, sheet: `https://docs.google.com/spreadsheets/d/${sheetId}` })
  } catch (e) {
    console.error(e)
    return json(500, { error: (e as Error).message })
  }
}

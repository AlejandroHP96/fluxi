// Cargar pdf-parse dinámicamente evitando el archivo de test con require()
const getPdfParser = async () => {
  const mod = await import("pdf-parse/lib/pdf-parse.js")
  return mod.default || mod
}

export const config = {
  runtime: "nodejs",
}

function cleanVentajonConcept(raw: string): string {
  let s = raw.trim()
  s = s.replace(/\s+(ES|NL|FR|DE)$/i, "")
  s = s.replace(/\s+PINPAD\b/i, "")
  // Sin \b final: el PDF pega el país a la localidad ("SANTA CRUZ DEES", "SAN CRISTOBALES")
  s = s.replace(/\b(SANTA CRUZ DE|SANATA CRUZ|SAN CRISTOBAL|LA LAGUNA|SAN CRISTOBLA).*/i, "").trim()
  s = s.replace(/FINCA ESPA#?A/i, "Finca España")
  s = s.replace(/RTE\b/i, "Restaurante")

  if (/MERCADONA/i.test(s)) {
    s = s.replace(/TENERIFE.*/i, "").trim()
  }
  if (/MCDONALD/i.test(s)) {
    s = s.replace(/72400041/g, "").trim()
  }

  return s
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

function categorizeVentajonItem(concept: string): string {
  const up = concept.toUpperCase()
  if (
    /MERCADONA|CARREFOUR|ALCAMPO|COVIRAN|SUPERMERCADO|MULTITIENDA|A24|CRIS-CLA|SD RAMBLAS|ALIMENTACION/i.test(
      up
    )
  ) {
    return "Alimentación"
  }
  if (/MCDONALD|BAR|RESTAURANTE|BURGER|KFC|PIZZA|CAFETERIA/i.test(up)) {
    return "Ocio"
  }
  if (/GASOLINERA|PARKING|CHUMBERAS|REPSOL|CEPSA|BP\b|DISA/i.test(up)) {
    return "Transporte"
  }
  if (/HOSPITAL|FARMACIA|OFRA|CLINICA|SALUD|MEDIC/i.test(up)) {
    return "Salud"
  }
  if (
    /IKEA|GAME|G2A|SAVE STORE|SOL EN CANARIAS|CAON|EXCLUSIVAS LIFER|MAS COSITAS|ZARA|PRIMARK|AMAZON/i.test(
      up
    )
  ) {
    return "Compras"
  }
  return "Otro"
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    const { pdfBase64, fileName } = req.body || {}
    if (!pdfBase64) {
      return res.status(400).json({ error: "Falta el documento PDF" })
    }

    const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, "")
    const buffer = Buffer.from(cleanBase64, "base64")

    const parsePdf = await getPdfParser()
    const data = await parsePdf(buffer)
    const text = data.text || ""
    const lines = text.split("\n")

    // Periodo del extracto: las fechas de las compras ("DD.MM") no llevan año, el cliente lo deduce
    // a partir de esto. 1º la cabecera del PDF ("Noviembre'26"), 2º el nombre ("2026_11_extracto_digital.pdf").
    // Si no hay ninguno se devuelve null y el cliente pregunta el mes al usuario.
    const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
    let period: { month: number; year: number; source: "cabecera" | "nombre" } | null = null
    const header = text.match(/(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s*'\s*(\d{2})/i)
    if (header) {
      period = { month: MONTHS.indexOf(header[1].toLowerCase()) + 1, year: 2000 + Number(header[2]), source: "cabecera" }
    } else {
      const fromName = String(fileName || "").match(/(20\d{2})[_\-.]?(\d{2})(?!\d)/)
      if (fromName && +fromName[2] >= 1 && +fromName[2] <= 12) {
        period = { month: +fromName[2], year: +fromName[1], source: "nombre" }
      }
    }

    const items: Array<{
      dateShort: string
      time: string
      concept: string
      amount: number
      category: string
    }> = []

    const re = /(\d{2}\.\d{2})\s*(\d{2}:\d{2})\s*(.+?)\s*(\d+,\d{2})/
    const startRe = /^\d{2}\.\d{2}\s*\d{2}:\d{2}/

    // Algunas compras con concepto largo salen partidas en varias líneas
    // ("30.1020:01" / "SAVE STORE ..." / "DEES" / "49,99--2+ 1,00"): se van juntando hasta tener importe.
    let pending = ""
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const candidate = pending && !startRe.test(trimmed) ? `${pending} ${trimmed}` : trimmed
      const match = candidate.match(re)
      pending = !match && startRe.test(candidate) && candidate.length < 200 ? candidate : ""
      if (match) {
        const [_, dateStr, timeStr, rawConcept, amtStr] = match
        if (
          !rawConcept.includes("CASH BACK") &&
          !rawConcept.includes("MiVENTAJON") &&
          !rawConcept.includes("FechaHoraConcepto")
        ) {
          const cleanConcept = cleanVentajonConcept(rawConcept)
          items.push({
            dateShort: dateStr,
            time: timeStr,
            concept: cleanConcept,
            amount: parseFloat(amtStr.replace(",", ".")),
            category: categorizeVentajonItem(cleanConcept),
          })
        }
      }
    }

    return res.status(200).json({
      items,
      count: items.length,
      period,
    })
  } catch (error: any) {
    console.error("Error al procesar PDF de Ventajón localmente:", error)
    return res.status(500).json({
      error: error?.message || "Error al procesar el PDF de Ventajón",
    })
  }
}

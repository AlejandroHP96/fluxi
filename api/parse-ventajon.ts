import { PDFParse } from "pdf-parse"
import { cleanVentajonConcept, categorizeVentajonItem } from "../src/utils/ventajonParser"

export const config = {
  runtime: "nodejs",
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    const { pdfBase64 } = req.body || {}
    if (!pdfBase64) {
      return res.status(400).json({ error: "Falta el documento PDF" })
    }

    const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, "")
    const buffer = Buffer.from(cleanBase64, "base64")

    const parser = new PDFParse(new Uint8Array(buffer))
    const parsed = await parser.getText()
    const fullText = parsed.text || ""

    const lines = fullText.split("\n")
    const items: Array<{
      dateShort: string
      time: string
      concept: string
      amount: number
      category: string
    }> = []

    const regex = /(\d{2}\.\d{2})\s+(\d{2}:\d{2})\s+(.+?)\s+(\d+,\d{2})/
    for (const line of lines) {
      const match = line.match(regex)
      if (match) {
        const [_, dateStr, timeStr, rawConcept, amtStr] = match
        if (
          !rawConcept.includes("CASH BACK") &&
          !rawConcept.includes("XTRA RESTAURANTE")
        ) {
          const cleanConcept = cleanVentajonConcept(rawConcept)
          items.push({
            dateShort: dateStr, // ej "31.10"
            time: timeStr,      // ej "13:30"
            concept: cleanConcept,
            amount: parseFloat(amtStr.replace(",", ".")),
            category: categorizeVentajonItem(cleanConcept),
          })
        }
      }
    }

    return res.status(200).json({ items, count: items.length })
  } catch (error: any) {
    console.error("Error parsing Ventajon PDF:", error)
    return res.status(500).json({ error: error?.message || "Error al procesar PDF de Ventajón" })
  }
}

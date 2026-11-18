import { GoogleGenAI, Type } from "@google/genai"

export const config = {
  runtime: "nodejs",
}

const CATEGORIES = [
  "Vivienda", "Alimentación", "Transporte", "Ocio",
  "Salud", "Suscripciones", "Compras", "Suministros", "Otro",
]

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY no configurada" })
    }

    const { pdfBase64 } = req.body || {}
    if (!pdfBase64) {
      return res.status(400).json({ error: "Falta el documento PDF" })
    }

    const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, "")
    const ai = new GoogleGenAI({ apiKey })

    const prompt = `Analiza este extracto bancario de Revolut (o similar).
Extrae TODAS las transacciones completadas como una lista JSON con:
- description: nombre limpio del comercio o concepto (ejemplo: "Mercadona", "Transferencia a Juan", "Nómina").
- amount: número positivo para ingresos y negativo para gastos (ejemplo: -14.20 o 1200.00).
- date: fecha en formato YYYY-MM-DD.
- type: "expense" si amount es negativo o "income" si amount es positivo.
- category: una de las siguientes opciones: ${CATEGORIES.join(", ")}. Si es ingreso pon "Ingresos", si no encaja pon "Otro".`

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: cleanBase64,
                mimeType: "application/pdf",
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              description: { type: Type.STRING },
              amount: { type: Type.NUMBER },
              date: { type: Type.STRING },
              type: { type: Type.STRING, enum: ["expense", "income"] },
              category: { type: Type.STRING },
            },
            required: ["description", "amount", "date", "type", "category"],
          },
        },
      },
    })

    const text = response.text
    if (!text) {
      return res.status(500).json({ error: "No se obtuvo respuesta del modelo" })
    }

    const parsed = JSON.parse(text)
    return res.status(200).json({ transactions: parsed })
  } catch (err: any) {
    console.error("Error procesando PDF:", err)
    return res.status(500).json({ error: err?.message || "Error al procesar el extracto PDF" })
  }
}

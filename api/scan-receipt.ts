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
      return res.status(500).json({ error: "GEMINI_API_KEY no configurada en Vercel" })
    }

    const { imageBase64, mimeType } = req.body || {}
    if (!imageBase64) {
      return res.status(400).json({ error: "Falta la imagen en base64" })
    }

    const ai = new GoogleGenAI({ apiKey })

    const prompt = `Analiza la imagen de este recibo o ticket de compra.
Extrae exclusivamente:
- amount: el importe TOTAL a pagar como número positivo (ejemplo: 15.50). Si no está claro, null.
- date: la fecha de la compra en formato YYYY-MM-DD. Si no aparece el año, asume el año actual. Si no está clara, null.
- description: nombre del comercio o establecimiento (ejemplo: "Mercadona", "Zara", "Gasolinera Repsol").
- category: una de las siguientes opciones según el tipo de gasto: ${CATEGORIES.join(", ")}. Si ninguna encaja, usa "Otro".`

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "")

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
                mimeType: mimeType || "image/jpeg",
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            amount: { type: Type.NUMBER, description: "Importe total del ticket" },
            date: { type: Type.STRING, description: "Fecha en formato YYYY-MM-DD" },
            description: { type: Type.STRING, description: "Nombre del comercio o concepto" },
            category: {
              type: Type.STRING,
              enum: [...CATEGORIES],
              description: "Categoría más adecuada",
            },
          },
          required: ["amount"],
        },
      },
    })

    const text = response.text
    if (!text) {
      return res.status(500).json({ error: "No se obtuvo respuesta del modelo" })
    }

    const parsed = JSON.parse(text)
    return res.status(200).json({ data: parsed })
  } catch (err: any) {
    console.error("Error procesando ticket:", err)
    return res.status(500).json({ error: err?.message || "Error al procesar el ticket" })
  }
}

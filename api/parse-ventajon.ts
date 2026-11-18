import { GoogleGenAI, Type } from "@google/genai"

export const config = {
  runtime: "nodejs",
}

const CATEGORIES = [
  "Vivienda", "Alimentación", "Transporte", "Ocio",
  "Salud", "Suscripciones", "Compras", "Suministros", "Otro",
]

const MODELS_FALLBACK = [
  "gemini-2.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-2.5-pro",
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

    const prompt = `Analiza este extracto digital de tarjeta Ventajón.
Extrae TODAS las compras realizadas en comercios como una lista JSON.
Para cada compra extrae:
- dateShort: fecha en formato DD.MM (ejemplo: "31.10", "17.11").
- time: hora en formato HH:MM (ejemplo: "13:30").
- concept: nombre limpio del comercio sin sufijos de tarjeta (ejemplo: "Mercadona Cuesta Piedra", "McDonald's Taco", "Ikea Finca España", "Carrefour").
- amount: número positivo correspondiente al importe gastado (ejemplo: 87.44 o 51.59).
- category: una de las siguientes opciones: ${CATEGORIES.join(", ")} (ejemplo: Mercadona -> Alimentación, McDonald's -> Ocio, Gasolinera -> Transporte, Ikea -> Compras).

REGLA CRÍTICA:
- IGNORA las líneas de "CASH BACK" y "Ahorros recibidos / MiVENTAJON". Extrae únicamente las compras en comercios.`

    let lastError: any = null
    let responseText: string | null = null

    // Reintentos automáticos con fallback entre modelos para esquivar el 503 High Demand
    for (const model of MODELS_FALLBACK) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const resp = await ai.models.generateContent({
            model,
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
                type: Type.OBJECT,
                properties: {
                  items: {
                    type: Type.ARRAY,
                    description: "Lista de compras en comercios del extracto de Ventajón",
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        dateShort: { type: Type.STRING },
                        time: { type: Type.STRING },
                        concept: { type: Type.STRING },
                        amount: { type: Type.NUMBER },
                        category: { type: Type.STRING },
                      },
                      required: ["dateShort", "concept", "amount", "category"],
                    },
                  },
                },
                required: ["items"],
              },
            },
          })

          if (resp.text) {
            responseText = resp.text
            break
          }
        } catch (err: any) {
          lastError = err
          // Si es 503 (High Demand) o 429, esperar 1.5s y pasar al siguiente
          console.warn(`Modelo ${model} intento ${attempt + 1} falló:`, err?.message || err)
          await new Promise((r) => setTimeout(r, 1500))
        }
      }
      if (responseText) break
    }

    if (!responseText) {
      throw lastError || new Error("Los servidores de IA están saturados en este momento. Por favor inténtalo de nuevo en unos segundos.")
    }

    const parsed = JSON.parse(responseText)
    return res.status(200).json({
      items: parsed.items || [],
      count: parsed.items?.length || 0,
    })
  } catch (error: any) {
    console.error("Error al procesar PDF de Ventajón:", error)
    return res.status(500).json({
      error: error?.message || "Error al procesar el PDF de Ventajón",
    })
  }
}

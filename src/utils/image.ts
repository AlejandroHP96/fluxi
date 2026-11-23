// Foto del ticket reducida en el navegador (JPEG en data URL) para que quepa en un documento de Firestore
// (menos de 1 MB). Se prueba con tamaños y calidades cada vez menores hasta que cabe
const MAX_CHARS = 900_000

export async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  try {
    for (const [side, quality] of [[1600, 0.75], [1280, 0.7], [1024, 0.6], [800, 0.5]] as const) {
      const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement("canvas")
      canvas.width = Math.round(bitmap.width * scale)
      canvas.height = Math.round(bitmap.height * scale)
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("No se puede procesar la imagen")
      ctx.fillStyle = "#fff" // los PNG con transparencia no salen en negro
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const url = canvas.toDataURL("image/jpeg", quality)
      if (url.length < MAX_CHARS) return url
    }
  } finally {
    bitmap.close()
  }
  throw new Error("La foto es demasiado grande")
}

import { auth } from "../lib/firebase"

// Compras reales de Ventajón de esos meses ("AAAA-MM"), vía api/ventajon-sync (login automático en el servidor;
// solo responde a la cuenta dueña, FLUXI_OWNER_UID en Vercel)
export async function fetchVentajonPurchases(months: string[]): Promise<Array<{ date: string; concept: string; amount: number }>> {
  if (months.length === 0) return []
  const idToken = await auth.currentUser?.getIdToken()
  if (!idToken) throw new Error("Inicia sesión para consultar Ventajón")
  const res = await fetch("/api/ventajon-sync", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ months }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Ventajón respondió ${res.status}`)
  }
  const { items } = await res.json()
  return (items as Array<{ date: string; concept: string; amount: number }>).map((p) => ({
    date: String(p.date).slice(0, 10),
    concept: p.concept,
    amount: Number(p.amount),
  }))
}

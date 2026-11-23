import { auth } from "../lib/firebase"

// Botón «Actualizar» (solo el dueño): rehace ya la pestaña del mes en el Seguimiento de Google Sheets.
// Devuelve el enlace a la hoja
export async function refreshSeguimiento(month: string): Promise<string> {
  const user = auth.currentUser
  if (!user) throw new Error("No hay sesión")
  const r = await fetch(`/api/seguimiento?month=${encodeURIComponent(month)}`, {
    headers: { Authorization: `Bearer ${await user.getIdToken()}` },
  })
  const d = (await r.json().catch(() => ({}))) as { sheet?: string; error?: string }
  if (!r.ok || !d.sheet) throw new Error(d.error || `Error ${r.status}`)
  return d.sheet
}

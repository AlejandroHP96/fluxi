// Solo el dueño de la app: valida el ID token de Firebase y devuelve su UID (o null si no es válido)
export async function firebaseUid(idToken: string): Promise<string | null> {
  const apiKey = process.env.VITE_FIREBASE_API_KEY
  if (!idToken || !apiKey) return null
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  })
  if (!r.ok) return null
  const d = await r.json()
  return d.users?.[0]?.localId ?? null
}

export async function isOwner(req: { headers: Record<string, unknown> }): Promise<boolean> {
  const owner = process.env.FLUXI_OWNER_UID
  const idToken = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "")
  return !!owner && (await firebaseUid(idToken)) === owner
}

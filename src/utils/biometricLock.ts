// Bloqueo con huella / Face ID (WebAuthn con el autenticador del propio dispositivo).
// Es un candado local de comodidad: la app no tiene servidor que verifique la firma, basta con que el sistema
// confirme a la persona (userVerification: "required"). La credencial se activa por dispositivo y su id se
// guarda en localStorage, por usuario.

export const LOCK_AFTER_MS = 5 * 60 * 1000 // fuera de la app más de esto, al volver se bloquea

const key = (uid: string) => `fluxi:lock:${uid}`

export const toB64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

export const fromB64url = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0))

// Se vuelve a pedir la biometría si la app ha estado oculta más de LOCK_AFTER_MS
export const shouldLock = (hiddenAt: number | null, now: number) => hiddenAt !== null && now - hiddenAt > LOCK_AFTER_MS

// El reto no se comprueba en ningún servidor, pero WebAuthn lo exige
const challenge = () => crypto.getRandomValues(new Uint8Array(32))

// Id de la credencial de este dispositivo para ese usuario (null = bloqueo desactivado)
export function lockCredential(uid: string): string | null {
  try {
    return localStorage.getItem(key(uid))
  } catch {
    return null
  }
}

// ¿Hay huella / Face ID / Windows Hello en este dispositivo? null = sí; si no, el motivo (se enseña al usuario)
export async function biometricUnavailableReason(): Promise<string | null> {
  if (!window.isSecureContext) return "la página no se ha abierto con https"
  if (!window.PublicKeyCredential) return "este navegador no admite passkeys (WebAuthn)"
  try {
    return (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
      ? null
      : "el navegador dice que el dispositivo no tiene huella / Face ID configurados"
  } catch (e) {
    return `no se ha podido comprobar (${(e as Error).message})`
  }
}

// Registra la credencial en este dispositivo (el sistema pide la biometría) y activa el bloqueo
export async function enableLock(uid: string, email: string): Promise<void> {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: challenge(),
      rp: { name: "Fluxi" },
      user: { id: new TextEncoder().encode(uid), name: email, displayName: email },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
      attestation: "none",
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null
  if (!cred) throw new Error("No se ha creado la credencial")
  localStorage.setItem(key(uid), toB64url(new Uint8Array(cred.rawId)))
}

export function disableLock(uid: string) {
  try {
    localStorage.removeItem(key(uid))
  } catch {
    /* sin almacenamiento */
  }
}

// Pide la biometría con la credencial de este dispositivo. true si el sistema la confirma
export async function unlockWithBiometrics(uid: string): Promise<boolean> {
  const id = lockCredential(uid)
  if (!id) return true
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: challenge(),
      allowCredentials: [{ type: "public-key", id: fromB64url(id) }],
      userVerification: "required",
      timeout: 60_000,
    },
  })
  return assertion !== null
}

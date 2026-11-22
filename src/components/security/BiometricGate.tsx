import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { Fingerprint } from "lucide-react"
import { ZkLogo } from "../brand/ZkLogo"
import { disableLock, lockCredential, shouldLock, unlockWithBiometrics } from "../../utils/biometricLock"

interface BiometricGateProps {
  uid: string
  startUnlocked?: boolean // recién entrado con contraseña: no se pide la huella hasta la próxima vez
  onUsePassword: () => void // cierra la sesión para entrar con email y contraseña
  children: ReactNode
}

// Si este dispositivo tiene el bloqueo activado, tapa la app al abrirla y al volver tras más de 5 minutos fuera
// hasta que el sistema confirma la huella / Face ID. La app sigue montada debajo (no pierde el mes ni lo abierto)
export const BiometricGate = ({ uid, startUnlocked = false, onUsePassword, children }: BiometricGateProps) => {
  const [locked, setLocked] = useState(() => !startUnlocked && lockCredential(uid) !== null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const overlay = useRef<HTMLDivElement>(null)
  const inFlight = useRef(false) // una sola petición de biometría a la vez

  // Mientras está bloqueada, nada de lo que hay detrás (la app y los modales, que van por portal al body)
  // recibe foco ni clics. inert no es prop de React 18: se pone a mano en los hijos del body
  useEffect(() => {
    if (!locked) return
    const others = Array.from(document.body.children).filter((el) => el !== overlay.current)
    others.forEach((el) => el.setAttribute("inert", ""))
    return () => others.forEach((el) => el.removeAttribute("inert"))
  }, [locked])

  // Vuelve a bloquear al volver tras más de 5 minutos fuera. pagehide/pageshow cubren lo que no avisa con
  // visibilitychange (páginas que salen y vuelven de la caché del navegador)
  useEffect(() => {
    let hiddenAt: number | null = null
    const leave = () => {
      hiddenAt ??= Date.now()
    }
    const back = () => {
      if (lockCredential(uid) && shouldLock(hiddenAt, Date.now())) setLocked(true)
      hiddenAt = null
    }
    const onVisibility = () => (document.visibilityState === "hidden" ? leave() : back())
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("pagehide", leave)
    window.addEventListener("pageshow", back)
    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("pagehide", leave)
      window.removeEventListener("pageshow", back)
    }
  }, [uid])

  // fromUser: el intento automático al bloquearse puede fallar porque algunos navegadores exigen un toque;
  // ese fallo no se enseña y queda el botón
  const unlock = useCallback(
    async (fromUser: boolean) => {
      if (inFlight.current) return
      inFlight.current = true
      setBusy(true)
      setError(null)
      try {
        if (await unlockWithBiometrics(uid)) setLocked(false)
      } catch {
        if (fromUser) setError("No se ha podido comprobar. Inténtalo otra vez o entra con la contraseña.")
      } finally {
        inFlight.current = false
        setBusy(false)
      }
    },
    [uid]
  )

  useEffect(() => {
    if (locked && document.visibilityState === "visible") void unlock(false)
  }, [locked, unlock])

  // Entrar con contraseña desactiva el bloqueo en este dispositivo: si la credencial ya no existe (se borró del
  // móvil), así no hay bucle. Se vuelve a activar en Reparto
  const usePassword = () => {
    disableLock(uid)
    onUsePassword()
  }

  return (
    <>
      {children}
      {locked &&
        createPortal(
          <div ref={overlay} className="fixed inset-0 z-[100] flex items-center justify-center bg-[#07090e] p-4 text-white">
            <div className="w-full max-w-xs text-center">
              <ZkLogo className="mx-auto mb-6 h-12 w-12" />
              <h1 className="text-lg font-semibold tracking-tight">Fluxi está bloqueado</h1>
              <p className="mt-1 text-sm text-white/60">Usa tu huella o Face ID para entrar.</p>
              <button
                type="button"
                onClick={() => void unlock(true)}
                disabled={busy}
                className="liquid-button mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-base font-semibold text-[#04202a] disabled:opacity-60"
              >
                <Fingerprint className="h-5 w-5" />
                {busy ? "Comprobando…" : "Desbloquear"}
              </button>
              {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
              <button type="button" onClick={usePassword} className="mt-4 text-xs text-cyan-300 hover:underline">
                Usar contraseña
              </button>
              <p className="mt-1 text-[11px] text-white/40">Desactiva el bloqueo en este dispositivo.</p>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}

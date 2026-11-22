import { useEffect, useState } from "react"
import { Fingerprint } from "lucide-react"
import { biometricAvailable, disableLock, enableLock, lockCredential } from "../../utils/biometricLock"

interface BiometricToggleProps {
  uid: string
  email: string
}

// Interruptor «Desbloquear con huella / Face ID» de este dispositivo. No aparece si no hay biometría
export const BiometricToggle = ({ uid, email }: BiometricToggleProps) => {
  const [available, setAvailable] = useState(false)
  const [enabled, setEnabled] = useState(() => lockCredential(uid) !== null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void biometricAvailable().then((ok) => alive && setAvailable(ok))
    return () => {
      alive = false
    }
  }, [])

  if (!available) return null

  const toggle = async () => {
    setError(null)
    if (enabled) {
      disableLock(uid)
      setEnabled(false)
      return
    }
    setBusy(true)
    try {
      await enableLock(uid, email)
      setEnabled(true)
    } catch {
      setError("No se ha podido activar. Comprueba que el dispositivo tiene huella o Face ID configurados.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">Este dispositivo</p>
      <label className="flex cursor-pointer items-center gap-3">
        <Fingerprint className="h-5 w-5 shrink-0 text-cyan-300" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-white/90">Desbloquear con huella / Face ID</span>
          <span className="block text-xs text-white/50">Se pide al abrir Fluxi y al volver tras 5 minutos fuera.</span>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={enabled}
          disabled={busy}
          onChange={() => void toggle()}
          className="h-5 w-5 shrink-0 accent-cyan-400"
        />
      </label>
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  )
}

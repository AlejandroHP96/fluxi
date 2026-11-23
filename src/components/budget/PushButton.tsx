import { useEffect, useState } from "react"
import { Bell, BellOff, BellRing } from "lucide-react"
import { disablePush, enablePush, pushEnabled, pushSupported } from "../../utils/push"

// Campana de la cabecera: activa o quita en este dispositivo los avisos de sobres al 80 %
export const PushButton = ({ uid, budget }: { uid: string; budget: string }) => {
  const [on, setOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    void pushEnabled().then(setOn).catch(() => setOn(false))
  }, [])
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 5000)
    return () => clearTimeout(t)
  }, [msg])
  if (!pushSupported()) return null

  const toggle = async () => {
    setBusy(true)
    try {
      if (on) {
        await disablePush(uid)
        setOn(false)
        setMsg("Avisos quitados en este dispositivo")
      } else {
        await enablePush(uid, budget)
        setOn(true)
        setMsg("Te avisaremos cuando un sobre llegue al 80 %")
      }
    } catch (e) {
      setMsg((e as Error).message)
    }
    setBusy(false)
  }

  return (
    <span className="relative">
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={busy}
        aria-pressed={on}
        aria-label={on ? "Quitar avisos" : "Activar avisos"}
        title={on ? "Avisos activados: un sobre al 80 %" : "Avisarme cuando un sobre llegue al 80 %"}
        className={`flex shrink-0 items-center rounded-lg border p-1.5 transition-colors disabled:opacity-60 ${
          on ? "border-cyan-400/40 text-cyan-200" : "border-white/10 text-white/70 hover:border-cyan-400/40 hover:text-white"
        }`}
      >
        {busy ? <BellRing className="h-4 w-4 animate-pulse" /> : on ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
      </button>
      {msg && (
        <span role="status" className="absolute right-0 top-full z-40 mt-2 w-56 rounded-xl border border-white/10 bg-ink-2 px-3 py-2 text-xs text-white/85 shadow-xl">
          {msg}
        </span>
      )}
    </span>
  )
}

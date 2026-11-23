import { useEffect, useState } from "react"
import { Check, ExternalLink, LogOut, Palette, RefreshCw, SlidersHorizontal } from "lucide-react"
import { ZkLogo } from "../brand/ZkLogo"

interface AppHeaderProps {
  email: string | null
  onSignOut: () => void
  onCategories: () => void
  onTheme: () => void
  onRefresh?: () => Promise<string> // solo el dueño: actualiza el Seguimiento de Google Sheets; devuelve su enlace
}

// «Actualizar»: rehace ya la pestaña del mes en el Excel del Seguimiento y deja un enlace para abrirlo
const RefreshButton = ({ onRefresh }: { onRefresh: () => Promise<string> }) => {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle")
  const [link, setLink] = useState<string | null>(null)
  const [error, setError] = useState("")
  useEffect(() => {
    if (state !== "done" && state !== "error") return
    const t = setTimeout(() => setState("idle"), state === "done" ? 15000 : 6000)
    return () => clearTimeout(t)
  }, [state])

  const run = async () => {
    setState("busy")
    try {
      setLink(await onRefresh())
      setState("done")
    } catch (e) {
      setError((e as Error).message)
      setState("error")
    }
  }

  return (
    <>
      <button
        onClick={() => void run()}
        disabled={state === "busy"}
        aria-label="Actualizar el Excel del seguimiento"
        title={state === "error" ? `No se pudo actualizar: ${error}` : "Actualizar el Excel del seguimiento con lo de ahora"}
        className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-70 ${
          state === "error"
            ? "border-red-400/40 text-red-300"
            : state === "done"
              ? "border-emerald-400/40 text-emerald-300"
              : "border-white/10 text-white/70 hover:border-cyan-400/40 hover:text-white"
        }`}
      >
        {state === "done" ? <Check className="h-3.5 w-3.5" /> : <RefreshCw className={`h-3.5 w-3.5 ${state === "busy" ? "animate-spin" : ""}`} />}
        <span className="hidden sm:inline">{state === "busy" ? "Actualizando…" : state === "done" ? "Actualizado" : state === "error" ? "Error" : "Actualizar"}</span>
      </button>
      {state === "done" && link && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Abrir el Excel del seguimiento"
          title="Abrir el Excel"
          className="flex shrink-0 items-center rounded-lg border border-white/10 p-1.5 text-white/70 transition-colors hover:border-cyan-400/40 hover:text-white"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      )}
    </>
  )
}

export const AppHeader = ({ email, onSignOut, onCategories, onTheme, onRefresh }: AppHeaderProps) => (
  <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#07090e]/80 backdrop-blur-xl">
    <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-3 sm:px-6">
      <div className="flex items-center gap-2.5">
        <ZkLogo id="navbar-brand-logo" className="h-8 w-8 shrink-0" />
        <span className="text-[17px] font-semibold tracking-tight">Fluxi</span>
      </div>
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
        {email && <span className="hidden min-w-0 max-w-[9rem] truncate text-xs text-white/60 min-[400px]:block sm:max-w-[16rem]">{email}</span>}
        <button
          onClick={onCategories}
          aria-label="Categorías y reparto"
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-medium text-white/70 transition-colors hover:border-cyan-400/40 hover:text-white"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Reparto</span>
        </button>
        {onRefresh && <RefreshButton onRefresh={onRefresh} />}
        <button
          onClick={onTheme}
          aria-label="Tema de color"
          title="Tema de color"
          className="flex shrink-0 items-center rounded-lg border border-white/10 p-1.5 text-white/70 transition-colors hover:border-cyan-400/40 hover:text-white"
        >
          <Palette className="h-4 w-4" />
        </button>
        <button
          onClick={onSignOut}
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
          className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Cerrar sesión</span>
        </button>
      </div>
    </div>
  </header>
)

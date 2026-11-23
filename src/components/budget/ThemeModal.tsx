import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Check, X } from "lucide-react"
import { THEMES, themeById } from "../../constants/themes"

// Elegir el tema de color de la app. Es de cada persona: también colorea su inicial en la lista de gastos
export const ThemeModal = ({ current, onSave, onClose }: { current: string | null; onSave: (id: string) => Promise<boolean>; onClose: () => void }) => {
  const [error, setError] = useState<string | null>(null)
  const selected = themeById(current).id

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const pick = async (id: string) => {
    setError(null)
    if (!(await onSave(id))) setError("No se pudo guardar el tema. Inténtalo de nuevo.")
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-label="Tema de color"
        className="glass-panel fade-up w-full max-w-md rounded-t-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl sm:p-6"
      >
        <div className="mb-1 flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Tema de color</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/[0.07] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-sm text-white/60">Solo cambia tu app. Tu inicial en la lista de gastos sale con este color.</p>

        <div className="grid grid-cols-3 gap-2.5" role="radiogroup" aria-label="Temas">
          {THEMES.map((t) => {
            const on = t.id === selected
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => void pick(t.id)}
                className={`flex flex-col items-center gap-2 rounded-2xl border px-2 py-3 text-sm transition-colors ${
                  on ? "border-white/40 bg-white/[0.08] text-white" : "border-white/10 text-white/70 hover:border-white/25 hover:text-white"
                }`}
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={{ background: `linear-gradient(135deg, rgb(${t.acc[400]}), rgb(${t.alt[500]}))` }}
                >
                  {on && <Check className="h-4 w-4" style={{ color: `rgb(${t.acc[950]})` }} />}
                </span>
                {t.name}
              </button>
            )
          })}
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
      </div>
    </div>,
    document.body
  )
}

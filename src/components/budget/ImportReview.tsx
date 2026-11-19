import { useEffect, useRef, useState } from "react"
import { Undo2, Check, SkipForward, AlertTriangle } from "lucide-react"
import { CATEGORIES } from "../../constants/categories"
import { conceptKey } from "../../utils/categorize"
import { fmt } from "../../utils/formatters"
import { SKIP, type ImportItem } from "../../utils/importQueue"
import type { BudgetApi } from "../../hooks/useBudget"
import { catColor, longDate, shortDate } from "./helpers"

export interface Decision {
  choice: string // categoría o SKIP
  concept: string // el concepto que se guardó (editado) o el original
  amount: number
  date: string
  expenseId?: string // id del gasto guardado (para deshacer)
}

interface ImportReviewProps {
  queue: ImportItem[]
  warning: string | null
  budget: BudgetApi
  onFinish: (decisions: Decision[]) => void
  onExit: (decisions: Decision[]) => void
}

export const ImportReview = ({ queue, warning, budget, onFinish, onExit }: ImportReviewProps) => {
  const { addExpense, deleteExpense, remember } = budget
  const [index, setIndex] = useState(0)
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [concept, setConcept] = useState(queue[0].concept)
  const [choice, setChoice] = useState(queue[0].suggestion)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const item = queue[index]

  const load = (i: number, c: string, ch: string) => {
    setIndex(i)
    setConcept(c)
    setChoice(ch)
    setError(null)
  }

  const confirm = async () => {
    if (saving) return
    const isSkip = choice === SKIP
    const finalConcept = concept.trim()
    if (!isSkip && !finalConcept) return setError("Pon un concepto antes de guardar.")
    setError(null)
    let expenseId: string | undefined
    if (!isSkip) {
      setSaving(true)
      const id = await addExpense({ amount: item.amount, concept: finalConcept, category: choice, date: item.date })
      setSaving(false)
      if (!id) return setError("No se pudo guardar este gasto. Inténtalo de nuevo.")
      expenseId = id
    }
    // La clave es el concepto sin editar: es el que traerán los próximos CSV
    void remember(conceptKey(item.concept), choice)
    const next = [
      ...decisions,
      { choice, concept: isSkip ? item.concept : finalConcept, amount: item.amount, date: item.date, expenseId },
    ]
    setDecisions(next)
    if (index + 1 >= queue.length) return onFinish(next)
    const n = queue[index + 1]
    load(index + 1, n.concept, n.suggestion)
    ;(document.activeElement as HTMLElement | null)?.blur?.()
  }

  const undo = async () => {
    if (saving || decisions.length === 0) return
    const last = decisions[decisions.length - 1]
    setError(null)
    if (last.choice !== SKIP && last.expenseId) {
      setSaving(true)
      const ok = await deleteExpense(last.expenseId)
      setSaving(false)
      if (!ok) return setError("No se pudo deshacer. Inténtalo de nuevo.")
    }
    setDecisions(decisions.slice(0, -1))
    load(index - 1, last.concept, last.choice)
    // Sin esto, el foco se queda en «Deshacer» y el siguiente Enter desharía otra vez en vez de confirmar
    ;(document.activeElement as HTMLElement | null)?.blur?.()
  }

  // Teclado: Enter confirma, 1-9 categoría, 0 omitir, Esc cierra (siempre con la versión más reciente del estado)
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {})
  keyRef.current = (e) => {
    if (e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return
    if (e.key === "Escape") return onExit(decisions)
    const target = e.target as HTMLElement | null
    const tag = target?.tagName
    if (e.key === "Enter") {
      // Con el foco en «Deshacer», «Terminar luego» o el botón principal, Enter hace lo suyo
      if (tag === "BUTTON" && target?.getAttribute("role") !== "radio") return
      e.preventDefault()
      return void confirm()
    }
    if (tag === "INPUT" || tag === "TEXTAREA") return
    if (e.key === "0") setChoice(SKIP)
    else if (/^[1-9]$/.test(e.key) && CATEGORIES[Number(e.key) - 1]) setChoice(CATEGORIES[Number(e.key) - 1])
  }
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyRef.current(e)
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [])

  const isSkip = choice === SKIP
  const dup = item.duplicateOf
  const chip = "flex items-center gap-1.5 rounded-full border px-3.5 py-2.5 text-sm font-medium transition-all active:scale-95"

  return (
    <>
      {/* Progreso y salida */}
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold tabular-nums">
            {index + 1} <span className="text-white/60">/ {queue.length}</span>
          </span>
          <button
            type="button"
            onClick={() => onExit(decisions)}
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-white/55 transition-colors hover:bg-white/[0.07] hover:text-white"
          >
            Terminar luego
          </button>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-white/[0.08]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-300"
            style={{ width: `${(index / queue.length) * 100}%` }}
          />
        </div>
      </div>

      {warning && (
        <p className="mb-3 flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-400/[0.08] px-3 py-2 text-xs text-amber-100">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {warning}
        </p>
      )}

      {/* Gasto */}
      <div>
        <p className="block text-sm text-white/50 first-letter:uppercase">
          {longDate(item.date)}
          {item.time && <span className="text-white/60"> · {item.time}</span>}
        </p>
        <p className="mt-0.5 text-5xl font-bold tabular-nums tracking-tight">{fmt(item.amount)}</p>
      </div>

      <input
        value={concept}
        onChange={(e) => {
          setConcept(e.target.value)
          setError(null)
        }}
        aria-label="Concepto"
        maxLength={80}
        className="glass-input mt-4 w-full rounded-xl px-4 py-3 text-base"
      />

      {(item.isVentajon || dup) && (
        <div className="mt-2.5 flex flex-wrap gap-2 text-xs">
          {item.isVentajon && item.ventajonFound && (
            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 text-cyan-100">
              Ventajón <span className="text-white/60">· CSV: «{item.originalConcept}»</span>
            </span>
          )}
          {item.isVentajon && !item.ventajonFound && (
            <span className="rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-1 text-white/55">
              Ventajón · comercio no encontrado
            </span>
          )}
          {dup && (
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-amber-100">
              Ya apuntado: «{dup.concept}» el {shortDate(dup.date)}
            </span>
          )}
        </div>
      )}

      {/* Categoría */}
      <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Categoría">
        {CATEGORIES.map((c, i) => {
          const active = c === choice
          return (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setChoice(c)}
              className={`${chip} ${
                active
                  ? "border-cyan-300 bg-cyan-400/30 text-white shadow-[0_0_0_3px_rgba(34,211,238,0.22)]"
                  : "border-white/10 bg-white/[0.03] text-white/65 hover:border-white/25 hover:text-white"
              }`}
            >
              {active ? (
                <Check className="h-3.5 w-3.5 text-cyan-200" strokeWidth={3} />
              ) : (
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: catColor(c) }} />
              )}
              {c}
              <kbd className="hidden text-[10px] font-normal text-white/50 md:inline">{i + 1}</kbd>
            </button>
          )
        })}
        <button
          type="button"
          role="radio"
          aria-checked={isSkip}
          onClick={() => setChoice(SKIP)}
          className={`${chip} ${
            isSkip
              ? "border-amber-300 bg-amber-400/30 text-amber-50 shadow-[0_0_0_3px_rgba(251,191,36,0.22)]"
              : "border-dashed border-white/25 text-white/65 hover:border-white/45 hover:text-white"
          }`}
        >
          {isSkip ? <Check className="h-3.5 w-3.5 text-amber-200" strokeWidth={3} /> : <SkipForward className="h-3.5 w-3.5" />}
          Omitir
          <kbd className="hidden text-[10px] font-normal text-white/50 md:inline">0</kbd>
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

      {/* Acciones */}
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:gap-3">
        <button
          type="button"
          onClick={undo}
          disabled={saving || decisions.length === 0}
          className="flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-3 text-sm font-medium text-white/75 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <Undo2 className="h-4 w-4" />
          Deshacer
        </button>
        <button
          type="button"
          onClick={() => void confirm()}
          disabled={saving}
          className={`flex items-center justify-center gap-2 rounded-xl px-5 py-4 text-base font-semibold disabled:opacity-60 sm:ml-auto sm:min-w-[15rem] ${
            isSkip
              ? "border border-white/25 bg-white/[0.08] text-white transition-colors hover:bg-white/[0.14]"
              : "liquid-button text-[#04202a]"
          }`}
        >
          {isSkip ? <SkipForward className="h-4 w-4" /> : <Check className="h-4 w-4" strokeWidth={2.5} />}
          {saving ? "Guardando…" : isSkip ? "Omitir este gasto" : `Guardar en ${choice}`}
        </button>
      </div>
      <p className="mt-3 hidden text-center text-xs text-white/55 md:block">Enter confirma · 1-9 elige categoría · 0 omite</p>
    </>
  )
}

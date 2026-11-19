import { useState, type FormEvent } from "react"
import { monthLabel } from "../../utils/month"
import type { BudgetCategory } from "../../types/budget"
import { CategoryEditor } from "./CategoryEditor"
import { fromDraft, templateDraft, validateDraft, type DraftCat } from "./categoryDraft"
import { parseAmount } from "./helpers"

interface FirstSetupProps {
  month: string
  onSubmit: (categories: BudgetCategory[], income: number) => Promise<boolean>
}

// Primera vez: nómina del mes + reparto propuesto (editable) y listo
export const FirstSetup = ({ month, onSubmit }: FirstSetupProps) => {
  const [income, setIncome] = useState("")
  const [draft, setDraft] = useState<DraftCat[]>(templateDraft)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const n = parseAmount(income)
    if (!(n > 0)) return setError("Escribe cuánto has cobrado (un importe mayor que 0).")
    const problem = validateDraft(draft)
    if (problem) return setError(problem)
    setError(null)
    setBusy(true)
    const ok = await onSubmit(fromDraft(draft), Math.round(n * 100) / 100)
    if (!ok) {
      setBusy(false)
      setError("No se pudo guardar. Inténtalo de nuevo.")
    }
  }

  return (
    <form onSubmit={submit} className="glass-panel mx-auto max-w-xl space-y-6 rounded-3xl p-5 sm:p-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">Bienvenido a Fluxi</p>
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight">Reparte tu nómina en sobres</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-white/65">
          Dime cuánto has cobrado y cuánto quieres destinar a cada cosa. Después solo apuntas tus gastos y yo te digo cuánto te queda en cada sobre.
        </p>
      </div>

      <div>
        <label htmlFor="first-income" className="mb-1.5 block text-sm font-medium text-white/80">
          1. ¿Cuánto has cobrado en {monthLabel(month)}?
        </label>
        <div className="relative">
          <input
            id="first-income"
            autoFocus
            inputMode="decimal"
            value={income}
            onChange={(e) => {
              setIncome(e.target.value)
              setError(null)
            }}
            placeholder="0,00"
            className="glass-input w-full rounded-2xl py-3.5 pl-4 pr-10 text-2xl font-bold tabular-nums"
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xl text-white/60">€</span>
        </div>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium text-white/80">2. ¿Cómo lo repartes?</p>
        <p className="mb-3 text-xs text-white/60">
          Te propongo un reparto: cambia nombres y porcentajes, añade o borra. Marca «Ahorro» en lo que quieras apartar sin gastarlo.
        </p>
        <CategoryEditor draft={draft} onChange={setDraft} onDelete={(row) => setDraft((d) => d.filter((x) => x.id !== row.id))} />
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="liquid-button w-full rounded-xl px-5 py-4 text-base font-semibold text-[#04202a] disabled:opacity-60"
      >
        {busy ? "Guardando…" : "Empezar"}
      </button>
    </form>
  )
}

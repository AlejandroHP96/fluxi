import { useState } from "react"
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react"
import { fmt } from "../../utils/formatters"
import { blankFixedDraft, draftFixedTotal, type DraftFixed } from "./fixedDraft"

interface FixedExpenseEditorProps {
  draft: DraftFixed[]
  onChange: (draft: DraftFixed[]) => void
  onDelete: (row: DraftFixed) => void
  sticky?: boolean
}

export const FixedTotal = ({ draft }: { draft: DraftFixed[] }) => {
  const total = draftFixedTotal(draft)
  return (
    <div className="rounded-2xl border border-white/12 bg-white/[0.04] px-4 py-3 text-sm">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold tabular-nums text-white">Total gastos fijos: {fmt(total)}</span>
        <span className="text-xs text-white/60">
          {draft.length} {draft.length === 1 ? "fijo" : "fijos"} al mes
        </span>
      </div>
      <p className="mt-1 text-xs text-white/60">
        Este dinero se descuenta de tu nómina antes de repartir los porcentajes entre tus sobres.
      </p>
    </div>
  )
}

const iconBtn =
  "flex h-9 w-9 items-center justify-center rounded-lg text-white/65 transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-25 disabled:hover:bg-transparent"

export const FixedExpenseEditor = ({ draft, onChange, onDelete, sticky = false }: FixedExpenseEditorProps) => {
  const [justAdded, setJustAdded] = useState<string | null>(null)

  const patch = (id: string, p: Partial<DraftFixed>) =>
    onChange(draft.map((d) => (d.id === id ? { ...d, ...p } : d)))

  const move = (i: number, delta: number) => {
    const next = [...draft]
    ;[next[i], next[i + delta]] = [next[i + delta], next[i]]
    onChange(next)
  }

  const add = () => {
    const row = blankFixedDraft()
    setJustAdded(row.id)
    onChange([...draft, row])
  }

  return (
    <div className="space-y-3">
      <div className={sticky ? "sticky top-0 z-10 -mx-1 bg-[#0a1020] px-1 pb-1 pt-1" : ""}>
        <FixedTotal draft={draft} />
      </div>

      {draft.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-white/60">
          No tienes ningún gasto fijo configurado. Pulsa el botón abajo para añadir uno (ej. Alquiler, Internet, etc.).
        </div>
      ) : (
        <ul className="space-y-2.5">
          {draft.map((d, i) => (
            <li key={d.id} className="rounded-2xl border border-white/[0.09] bg-white/[0.03] p-3">
              <div className="flex items-center gap-2">
                <input
                  value={d.name}
                  onChange={(e) => patch(d.id, { name: e.target.value })}
                  autoFocus={d.id === justAdded}
                  placeholder="Concepto (Alquiler, Internet…)"
                  aria-label="Nombre del gasto fijo"
                  maxLength={40}
                  className="glass-input min-w-0 flex-1 rounded-xl px-3.5 py-2.5 text-base"
                />
                <div className="relative w-28 shrink-0">
                  <input
                    value={d.amount}
                    onChange={(e) => patch(d.id, { amount: e.target.value })}
                    onFocus={(e) => e.target.select()}
                    inputMode="decimal"
                    placeholder="0,00"
                    aria-label={`Importe de ${d.name || "gasto fijo"}`}
                    className="glass-input w-full rounded-xl py-2.5 pl-3 pr-7 text-right text-base font-semibold tabular-nums"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-white/60">€</span>
                </div>
                <div className="flex items-center">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir" className={iconBtn}>
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === draft.length - 1} aria-label="Bajar" className={iconBtn}>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(d)}
                    aria-label={`Borrar ${d.name || "gasto fijo"}`}
                    className={`${iconBtn} hover:!bg-red-500/10 hover:!text-red-300`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className={sticky ? "sticky bottom-0 z-10 -mx-1 bg-[#0a1020] px-1 pb-1 pt-2" : ""}>
        <button
          type="button"
          onClick={add}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-cyan-400/40 bg-cyan-400/[0.06] px-4 py-3 text-sm font-medium text-cyan-100 transition-colors hover:border-cyan-300 hover:text-white"
        >
          <Plus className="h-4 w-4" />
          Añadir gasto fijo
        </button>
      </div>
    </div>
  )
}

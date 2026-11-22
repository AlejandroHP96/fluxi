import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { fmt } from "../../utils/formatters"
import { resolveCategory } from "../../utils/month"
import type { BudgetCategory, Expense, FixedExpense } from "../../types/budget"
import { CategoryEditor } from "./CategoryEditor"
import { fromDraft, toDraft, validateDraft, type DraftCat } from "./categoryDraft"
import { FixedExpenseEditor } from "./FixedExpenseEditor"
import { draftFixedTotal, fromFixedDraft, toFixedDraft, validateFixedDraft, type DraftFixed } from "./fixedDraft"

interface CategorySettingsProps {
  categories: BudgetCategory[]
  expenses: Expense[]
  fixedExpenses?: FixedExpense[]
  initialTab?: "categories" | "fixed"
  onSave: (list: BudgetCategory[]) => Promise<boolean>
  onSaveFixedExpenses?: (list: FixedExpense[]) => Promise<boolean>
  onReassign: (ids: string[], categoryId: string) => Promise<boolean>
  onResetAll?: () => Promise<boolean>
  onClose: () => void
}

const RESET_WORD = "BORRAR"

interface PendingDelete {
  row: DraftCat
  count: number
  target: string // id de destino o "" = dejarlos sin categoría
}

export const CategorySettings = ({
  categories,
  expenses,
  fixedExpenses = [],
  initialTab = "categories",
  onSave,
  onSaveFixedExpenses,
  onReassign,
  onResetAll,
  onClose,
}: CategorySettingsProps) => {
  const [tab, setTab] = useState<"categories" | "fixed">(initialTab)
  const [draft, setDraft] = useState<DraftCat[]>(() => toDraft(categories))
  const [fixedDraft, setFixedDraft] = useState<DraftFixed[]>(() => toFixedDraft(fixedExpenses))
  const [pending, setPending] = useState<PendingDelete | null>(null)
  const [moves, setMoves] = useState<Array<{ from: string; to: string }>>([]) // categoría borrada -> destino
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resetting, setResetting] = useState(false) // panel de confirmación de «Borrar todos mis datos»
  const [resetText, setResetText] = useState("")

  const fixedTotal = draftFixedTotal(fixedDraft)

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

  // Gastos de cada categoría guardada (ids antiguos y nombres incluidos)
  const idsByCategory = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const e of expenses) {
      const c = resolveCategory(e.category, categories)
      if (c) map.set(c.id, [...(map.get(c.id) ?? []), e.id])
    }
    return map
  }, [expenses, categories])

  const remove = (id: string) => setDraft((d) => d.filter((x) => x.id !== id))

  const requestDelete = (row: DraftCat) => {
    const count = row.isNew ? 0 : (idsByCategory.get(row.id)?.length ?? 0)
    if (count === 0) return remove(row.id)
    const firstOther = draft.find((d) => d.id !== row.id && !d.savings && d.name.trim())
    setPending({ row, count, target: firstOther?.id ?? "" })
  }

  const confirmDelete = () => {
    if (!pending) return
    if (pending.target) setMoves((m) => [...m, { from: pending.row.id, to: pending.target }])
    remove(pending.row.id)
    setPending(null)
  }

  const save = async () => {
    const catProblem = validateDraft(draft)
    if (catProblem) {
      setTab("categories")
      return setError(catProblem)
    }
    const fixedProblem = validateFixedDraft(fixedDraft)
    if (fixedProblem) {
      setTab("fixed")
      return setError(fixedProblem)
    }

    setError(null)
    setBusy(true)

    const list = fromDraft(draft)
    const okCats = await onSave(list)
    const okFixed = onSaveFixedExpenses ? await onSaveFixedExpenses(fromFixedDraft(fixedDraft)) : true

    if (!okCats || !okFixed) {
      setBusy(false)
      return setError("No se pudo guardar. Inténtalo de nuevo.")
    }

    // Mover los gastos de las categorías borradas, solo a destinos que siguen existiendo
    for (const m of moves) {
      const ids = idsByCategory.get(m.from) ?? []
      if (ids.length && list.some((c) => c.id === m.to)) await onReassign(ids, m.to)
    }
    onClose()
  }

  const resetAll = async () => {
    if (!onResetAll || resetText.trim().toUpperCase() !== RESET_WORD) return
    setError(null)
    setBusy(true)
    if (await onResetAll()) return onClose()
    setBusy(false)
    setError("No se pudieron borrar los datos. Inténtalo de nuevo.")
  }

  const targets = pending ? draft.filter((d) => d.id !== pending.row.id && d.name.trim()) : []

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-label="Ajustes de presupuesto"
        className="glass-panel fade-up flex max-h-[94dvh] w-full max-w-lg flex-col rounded-t-3xl sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5 sm:px-6 sm:pt-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Presupuesto y reparto</h2>
            <p className="mt-0.5 text-sm text-white/65">
              {tab === "categories"
                ? "Cada sobre lleva una cantidad fija (€) o un % de lo que quede tras los gastos fijos y los sobres en €."
                : "Gastos que se repiten todos los meses. Se descuentan de la nómina antes de hacer los %."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/[0.07] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Selector de pestañas */}
        <div className="px-5 pb-3 sm:px-6">
          <div className="flex rounded-xl bg-white/[0.06] p-1">
            <button
              type="button"
              onClick={() => {
                setTab("categories")
                setError(null)
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${
                tab === "categories" ? "bg-white/15 text-white shadow-sm" : "text-white/60 hover:text-white"
              }`}
            >
              Sobres
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("fixed")
                setError(null)
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${
                tab === "fixed" ? "bg-white/15 text-white shadow-sm" : "text-white/60 hover:text-white"
              }`}
            >
              Gastos fijos (€) {fixedTotal > 0 && <span className="ml-1 text-xs opacity-75 tabular-nums">· {fmt(fixedTotal)}</span>}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-2 sm:px-6">
          {tab === "categories" ? (
            <CategoryEditor draft={draft} onChange={setDraft} onDelete={requestDelete} sticky />
          ) : (
            <FixedExpenseEditor
              draft={fixedDraft}
              onChange={setFixedDraft}
              onDelete={(row) => setFixedDraft((d) => d.filter((x) => x.id !== row.id))}
              sticky
            />
          )}
        </div>

        <div className="space-y-3 border-t border-white/[0.08] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pb-6">
          {pending && (
            <div className="space-y-3 rounded-2xl border border-amber-400/30 bg-amber-400/[0.09] p-4 text-sm text-amber-50">
              <p>
                «{pending.row.name.trim() || "Esta categoría"}» tiene {pending.count} {pending.count === 1 ? "gasto" : "gastos"}. ¿Qué hago con
                {pending.count === 1 ? " él" : " ellos"}?
              </p>
              <select
                value={pending.target}
                onChange={(e) => setPending({ ...pending, target: e.target.value })}
                aria-label="Destino de los gastos"
                className="glass-input w-full rounded-xl px-3 py-2.5 text-base [&>option]:bg-[#0b1020]"
              >
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>
                    Moverlos a {t.name.trim()}
                  </option>
                ))}
                <option value="">Dejarlos sin categoría</option>
              </select>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="rounded-xl bg-red-500/90 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-red-500"
                >
                  Borrar categoría
                </button>
                <button
                  type="button"
                  onClick={() => setPending(null)}
                  className="rounded-xl border border-white/25 px-4 py-2.5 font-medium text-white/85 transition-colors hover:bg-white/10"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {resetting && (
            <div className="space-y-3 rounded-2xl border border-red-400/35 bg-red-500/[0.1] p-4 text-sm text-red-50">
              <p>
                Se borrarán <strong>todos tus gastos</strong>, las categorías, las nóminas, los gastos fijos y la cartera de ahorros.
                No se puede deshacer.
              </p>
              <label className="block">
                <span className="text-white/75">Escribe {RESET_WORD} para confirmar</span>
                <input
                  value={resetText}
                  onChange={(e) => setResetText(e.target.value)}
                  autoComplete="off"
                  className="glass-input mt-1.5 w-full rounded-xl px-3 py-2.5 text-base"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void resetAll()}
                  disabled={busy || resetText.trim().toUpperCase() !== RESET_WORD}
                  className="rounded-xl bg-red-500/90 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-50"
                >
                  {busy ? "Borrando…" : "Borrar todo"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setResetting(false)
                    setResetText("")
                  }}
                  className="rounded-xl border border-white/25 px-4 py-2.5 font-medium text-white/85 transition-colors hover:bg-white/10"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-300">{error}</p>}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/20 bg-white/[0.05] px-4 py-3 text-sm font-medium text-white/85 transition-colors hover:bg-white/[0.1] hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy}
              className="liquid-button ml-auto flex-1 rounded-xl px-5 py-3.5 text-base font-semibold text-[#04202a] disabled:opacity-60 sm:flex-none sm:min-w-[10rem]"
            >
              {busy ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>

          {onResetAll && !resetting && (
            <button
              type="button"
              onClick={() => {
                setPending(null)
                setResetting(true)
              }}
              className="w-full rounded-lg py-1.5 text-center text-xs font-medium text-red-300/80 transition-colors hover:text-red-200"
            >
              Borrar todos mis datos
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

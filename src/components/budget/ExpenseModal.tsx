import { useEffect, useState, type FormEvent } from "react"
import { createPortal } from "react-dom"
import { X, Trash2, Check } from "lucide-react"
import { CATEGORIES } from "../../constants/categories"
import { daysInMonth } from "../../utils/month"
import type { Expense, NewExpense } from "../../types/budget"
import { catColor, getLastCategory, parseAmount, saveLastCategory } from "./helpers"

interface ExpenseModalProps {
  expense: Expense | null // null = gasto nuevo
  month: string // mes que se está viendo
  defaultDate: string // fecha por defecto del gasto nuevo
  onSave: (data: NewExpense) => Promise<boolean>
  onDelete?: () => Promise<boolean>
  onClose: () => void
}

export const ExpenseModal = ({ expense, month, defaultDate, onSave, onDelete, onClose }: ExpenseModalProps) => {
  const editing = expense !== null
  const [amount, setAmount] = useState(editing ? String(expense.amount).replace(".", ",") : "")
  const [concept, setConcept] = useState(expense?.concept ?? "")
  const [category, setCategory] = useState(expense?.category ?? getLastCategory())
  const [date, setDate] = useState(expense?.date ?? defaultDate)
  const [errors, setErrors] = useState<{ amount?: boolean; concept?: boolean; date?: boolean }>({})
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [failed, setFailed] = useState(false)

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

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    const n = parseAmount(amount)
    const errs = { amount: !(n > 0), concept: !concept.trim(), date: !/^\d{4}-\d{2}-\d{2}$/.test(date) }
    setErrors(errs)
    if (errs.amount || errs.concept || errs.date) return
    setBusy(true)
    setFailed(false)
    const ok = await onSave({ amount: Math.round(n * 100) / 100, concept: concept.trim(), category, date })
    if (ok) {
      saveLastCategory(category)
      onClose()
    } else {
      setBusy(false)
      setFailed(true)
    }
  }

  const remove = async () => {
    if (!onDelete || busy) return
    setBusy(true)
    const ok = await onDelete()
    if (ok) onClose()
    else {
      setBusy(false)
      setFailed(true)
    }
  }

  const field = "glass-input w-full rounded-xl px-4 py-3 text-base"
  const bad = "!border-red-400/70"

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        onSubmit={submit}
        role="dialog"
        aria-label={editing ? "Editar gasto" : "Apuntar gasto"}
        className="glass-panel fade-up max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl sm:p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">{editing ? "Editar gasto" : "Apuntar gasto"}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/[0.07] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Importe: lo primero y lo más grande */}
        <div className="relative">
          <input
            autoFocus
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value)
              setErrors((x) => ({ ...x, amount: false }))
            }}
            placeholder="0,00"
            aria-label="Importe"
            className={`glass-input w-full rounded-2xl py-4 pl-5 pr-12 text-4xl font-bold tabular-nums ${errors.amount ? bad : ""}`}
          />
          <span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-2xl text-white/35">€</span>
        </div>
        {errors.amount && <p className="mt-1.5 text-xs text-red-300">Escribe un importe mayor que 0.</p>}

        <div className="mt-3">
          <input
            value={concept}
            onChange={(e) => {
              setConcept(e.target.value)
              setErrors((x) => ({ ...x, concept: false }))
            }}
            placeholder="¿En qué? (Mercadona, gasolina…)"
            aria-label="Concepto"
            maxLength={80}
            className={`${field} ${errors.concept ? bad : ""}`}
          />
          {errors.concept && <p className="mt-1.5 text-xs text-red-300">Pon un concepto.</p>}
        </div>

        <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Categoría">
          {CATEGORIES.map((c) => {
            const active = c === category
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setCategory(c)}
                className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-all active:scale-95 ${
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
              </button>
            )
          })}
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-medium text-white/60" htmlFor="expense-date">
            Fecha
          </label>
          <input
            id="expense-date"
            type="date"
            value={date}
            min={editing ? undefined : `${month}-01`}
            max={editing ? undefined : `${month}-${String(daysInMonth(month)).padStart(2, "0")}`}
            onChange={(e) => {
              setDate(e.target.value)
              setErrors((x) => ({ ...x, date: false }))
            }}
            className={`${field} ${errors.date ? bad : ""}`}
          />
        </div>

        {failed && <p className="mt-3 text-sm text-red-300">No se ha podido guardar. Inténtalo de nuevo.</p>}

        <div className="mt-5 flex items-center gap-2">
          {editing && onDelete && (
            confirmDelete ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={remove}
                  disabled={busy}
                  className="rounded-xl bg-red-500/90 px-3.5 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-60"
                >
                  Sí, borrar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-xl px-3 py-3 text-sm text-white/55 hover:text-white"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 rounded-xl px-3.5 py-3 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/10"
              >
                <Trash2 className="h-4 w-4" />
                Borrar
              </button>
            )
          )}
          <button
            type="submit"
            disabled={busy}
            className="liquid-button ml-auto flex-1 rounded-xl px-5 py-3.5 text-base font-semibold text-[#04202a] disabled:opacity-60 sm:flex-none sm:min-w-[9rem]"
          >
            {busy ? "Guardando…" : editing ? "Guardar cambios" : "Guardar"}
          </button>
        </div>
      </form>
    </div>,
    document.body
  )
}

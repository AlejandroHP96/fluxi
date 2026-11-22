import { useEffect, useState, type FormEvent } from "react"
import { createPortal } from "react-dom"
import { X, Trash2, Undo2, PiggyBank } from "lucide-react"
import { daysInMonth, resolveCategory } from "../../utils/month"
import { fmt } from "../../utils/formatters"
import { netAmount, type BudgetCategory, type Expense, type NewExpense, type Refund } from "../../types/budget"
import { CategoryChip } from "./CategoryChip"
import { catColor, getLastCategory, parseAmount, saveLastCategory } from "./helpers"
import { newCategoryId, todayKey } from "../../utils/month"

interface ExpenseModalProps {
  expense: Expense | null // null = gasto nuevo
  month: string // mes que se está viendo
  categories: BudgetCategory[] // las del usuario
  onManageCategories: () => void
  defaultDate: string // fecha por defecto del gasto nuevo
  onSave: (data: NewExpense) => Promise<boolean>
  onDelete?: () => Promise<boolean>
  onSaveRefunds?: (refunds: Refund[]) => Promise<boolean> // solo al editar
  onClose: () => void
  authorship?: string | null // «Apuntado por X · editado por Y» (presupuesto compartido)
}

export const ExpenseModal = ({
  expense, month, categories, onManageCategories, defaultDate, onSave, onDelete, onSaveRefunds, onClose, authorship,
}: ExpenseModalProps) => {
  const editing = expense !== null
  const spendCats = categories.filter((c) => !c.savings)
  const [amount, setAmount] = useState(editing ? String(expense.amount).replace(".", ",") : "")
  const [concept, setConcept] = useState(expense?.concept ?? "")
  const [category, setCategory] = useState(expense ? (resolveCategory(expense.category, categories)?.id ?? "") : getLastCategory(spendCats))
  const [date, setDate] = useState(expense?.date ?? defaultDate)
  const [errors, setErrors] = useState<{ amount?: boolean; concept?: boolean; date?: boolean; category?: boolean }>({})
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [failed, setFailed] = useState(false)
  // Devoluciones: se guardan al momento (independientes de «Guardar cambios»). Salen del gasto actual, que llega
  // actualizado del listado, así nunca se manda una lista desfasada
  const refunds = expense?.refunds ?? []
  const [refundForm, setRefundForm] = useState<{ amount: string; note: string; toWallet: boolean } | null>(null)
  const [refundError, setRefundError] = useState<string | null>(null)

  const storeRefunds = async (next: Refund[]) => {
    if (!onSaveRefunds) return false
    setBusy(true)
    const ok = await onSaveRefunds(next)
    setBusy(false)
    if (!ok) setRefundError("No se pudo guardar la devolución. Inténtalo de nuevo.")
    return ok
  }

  const addRefund = async () => {
    if (!refundForm || !expense) return
    const n = parseAmount(refundForm.amount)
    if (!(n > 0)) return setRefundError("Escribe un importe mayor que 0.")
    const left = Math.round((expense.amount - refunds.reduce((a, r) => a + r.amount, 0)) * 100) / 100
    if (n > left + 0.005) return setRefundError(`No te pueden devolver más de lo que queda del gasto (${fmt(Math.max(0, left))}).`)
    const refund: Refund = {
      id: newCategoryId(),
      amount: Math.round(n * 100) / 100,
      note: refundForm.note.trim().slice(0, 60),
      date: todayKey(),
      toWallet: refundForm.toWallet,
    }
    setRefundError(null)
    if (await storeRefunds([...refunds, refund])) setRefundForm(null)
  }

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
    const errs = { amount: !(n > 0), concept: !concept.trim(), date: !/^\d{4}-\d{2}-\d{2}$/.test(date), category: !category }
    setErrors(errs)
    if (errs.amount || errs.concept || errs.date || errs.category) return
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

  // Chips: categorías de gasto (y la del gasto que se edita, aunque sea de ahorro)
  const chips = categories.filter((c) => !c.savings || c.id === category)

  if (!editing && spendCats.length === 0) {
    return createPortal(
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
        onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      >
        <div role="dialog" className="glass-panel fade-up w-full max-w-md rounded-t-3xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center sm:rounded-3xl">
          <h2 className="text-lg font-semibold tracking-tight">Primero crea tus categorías</h2>
          <p className="mt-2 text-sm text-white/65">Para apuntar un gasto necesitas al menos una categoría de gasto (no de ahorro).</p>
          <button
            type="button"
            onClick={() => {
              onClose()
              onManageCategories()
            }}
            className="liquid-button mt-5 w-full rounded-xl px-5 py-3.5 text-base font-semibold text-[#04202a]"
          >
            Crear categorías
          </button>
          <button type="button" onClick={onClose} className="mt-2 w-full rounded-xl px-5 py-3 text-sm text-white/70 hover:text-white">
            Ahora no
          </button>
        </div>
      </div>,
      document.body
    )
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
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight">{editing ? "Editar gasto" : "Apuntar gasto"}</h2>
            {editing && authorship && <p className="mt-0.5 text-xs text-white/50">{authorship}</p>}
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
          <span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-2xl text-white/60">€</span>
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

        <div className="mt-4">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Categoría">
            {chips.map((c) => (
              <CategoryChip
                key={c.id}
                label={c.name}
                color={catColor(categories, c)}
                active={c.id === category}
                onClick={() => {
                  setCategory(c.id)
                  setErrors((x) => ({ ...x, category: false }))
                }}
              />
            ))}
          </div>
          {errors.category && <p className="mt-1.5 text-xs text-red-300">Elige una categoría.</p>}
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

        {editing && onSaveRefunds && (
          <div className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-white/85">Devoluciones</p>
              {refunds.length > 0 && (
                <p className="text-xs text-white/60">
                  Te ha costado <span className="font-semibold tabular-nums text-white/90">{fmt(netAmount({ amount: expense.amount, refunds }))}</span>
                </p>
              )}
            </div>
            {refunds.length > 0 && (
              <ul className="mt-2.5 space-y-1.5">
                {refunds.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 text-sm">
                    {r.toWallet ? <PiggyBank className="h-4 w-4 shrink-0 text-cyan-300" /> : <Undo2 className="h-4 w-4 shrink-0 text-emerald-300" />}
                    <span className="min-w-0 flex-1 truncate text-white/80">
                      {r.note || "Devolución"} <span className="text-xs text-white/50">· {r.toWallet ? "a la cartera" : "al mes"}</span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-emerald-300">+{fmt(r.amount)}</span>
                    <button
                      type="button"
                      onClick={() => void storeRefunds(refunds.filter((x) => x.id !== r.id))}
                      disabled={busy}
                      aria-label={`Quitar devolución ${r.note || ""}`}
                      className="rounded-lg p-1 text-white/45 transition-colors hover:bg-white/[0.08] hover:text-red-300"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {refundForm ? (
              <div className="mt-3 space-y-2.5">
                <div className="flex gap-2">
                  <div className="relative w-28 shrink-0">
                    <input
                      autoFocus
                      inputMode="decimal"
                      value={refundForm.amount}
                      onChange={(e) => setRefundForm({ ...refundForm, amount: e.target.value })}
                      placeholder="0,00"
                      aria-label="Importe devuelto"
                      className="glass-input w-full rounded-xl py-2.5 pl-3 pr-7 text-right text-base font-semibold tabular-nums"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-white/60">€</span>
                  </div>
                  <input
                    value={refundForm.note}
                    onChange={(e) => setRefundForm({ ...refundForm, note: e.target.value })}
                    placeholder="¿Quién? (Ana, Bizum…)"
                    aria-label="Quién te lo devuelve"
                    maxLength={60}
                    className="glass-input min-w-0 flex-1 rounded-xl px-3 py-2.5 text-base"
                  />
                </div>
                <div className="flex rounded-xl bg-white/[0.06] p-1" role="radiogroup" aria-label="A dónde va el dinero">
                  {[
                    { v: false, label: "Vuelve al mes" },
                    { v: true, label: "A la cartera de ahorros" },
                  ].map((o) => (
                    <button
                      key={o.label}
                      type="button"
                      role="radio"
                      aria-checked={refundForm.toWallet === o.v}
                      onClick={() => setRefundForm({ ...refundForm, toWallet: o.v })}
                      className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                        refundForm.toWallet === o.v ? "bg-white/15 text-white" : "text-white/60 hover:text-white"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-white/55">
                  {refundForm.toWallet
                    ? "El gasto cuenta entero en su sobre y el dinero entra en tu cartera de ahorros."
                    : "Se resta de lo gastado en este sobre: cuenta solo lo que te ha costado a ti."}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void addRefund()}
                    disabled={busy}
                    className="liquid-button rounded-xl px-4 py-2.5 text-sm font-semibold text-[#04202a] disabled:opacity-60"
                  >
                    Añadir devolución
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRefundForm(null)
                      setRefundError(null)
                    }}
                    className="rounded-xl px-3 py-2.5 text-sm text-white/65 hover:text-white"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setRefundForm({ amount: "", note: "", toWallet: false })}
                className="mt-2.5 flex items-center gap-1.5 text-sm font-medium text-cyan-300 hover:text-cyan-200"
              >
                <Undo2 className="h-4 w-4" />
                Me han devuelto dinero
              </button>
            )}
            {refundError && <p className="mt-2 text-xs text-red-300">{refundError}</p>}
          </div>
        )}

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

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Trash2, X } from "lucide-react"
import { fmt } from "../../utils/formatters"
import { newCategoryId, todayKey } from "../../utils/month"
import { walletBalance, type Wallet } from "../../types/budget"
import { parseAmount, shortDate } from "./helpers"

// Cartera de ahorros (tarjeta «Ahorro» de arriba): aparte de los sobres. Saldo inicial puesto a mano y
// movimientos que entran o salen
export const WalletModal = ({ wallet, onSave, onClose }: { wallet: Wallet; onSave: (w: Wallet) => Promise<boolean>; onClose: () => void }) => {
  const [initial, setInitial] = useState(String(wallet.initial).replace(".", ","))
  const [form, setForm] = useState<{ amount: string; note: string; sign: 1 | -1 }>({ amount: "", note: "", sign: 1 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  // Saldo inicial tal como está escrito (aunque aún no se haya guardado), para no pisarlo al añadir un movimiento
  const typedInitial = () => {
    const n = initial.trim() === "" ? 0 : parseAmount(initial)
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : wallet.initial
  }

  const save = async (w: Wallet) => {
    setBusy(true)
    setError(null)
    const ok = await onSave(w)
    setBusy(false)
    if (!ok) setError("No se pudo guardar. Inténtalo de nuevo.")
    return ok
  }

  const saveInitial = async () => {
    const n = initial.trim() === "" ? 0 : parseAmount(initial)
    if (!Number.isFinite(n)) return setError("El saldo inicial tiene que ser un número.")
    if (Math.round(n * 100) / 100 !== wallet.initial) await save({ ...wallet, initial: Math.round(n * 100) / 100 })
  }

  const addMove = async () => {
    const n = parseAmount(form.amount)
    if (!(n > 0)) return setError("Escribe un importe mayor que 0.")
    const move = { id: newCategoryId(), amount: form.sign * Math.round(n * 100) / 100, note: form.note.trim().slice(0, 120), date: todayKey() }
    if (await save({ initial: typedInitial(), movements: [move, ...wallet.movements] })) setForm({ amount: "", note: "", sign: form.sign })
  }

  const balance = walletBalance(wallet)

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-label="Cartera de ahorros"
        className="glass-panel fade-up flex max-h-[94dvh] w-full max-w-md flex-col rounded-t-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl sm:p-6"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Cartera de ahorros</h2>
            <p className="mt-0.5 text-4xl font-bold tabular-nums tracking-tight">{fmt(balance)}</p>
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

        <label className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3.5 py-2.5">
          <span className="text-sm text-white/75">Saldo inicial</span>
          <span className="relative w-32">
            <input
              inputMode="decimal"
              value={initial}
              onChange={(e) => setInitial(e.target.value)}
              onBlur={() => void saveInitial()}
              onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
              aria-label="Saldo inicial"
              className="glass-input w-full rounded-lg py-2 pl-3 pr-7 text-right text-base font-semibold tabular-nums"
            />
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-white/60">€</span>
          </span>
        </label>

        {/* Nuevo movimiento */}
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <div className="flex shrink-0 rounded-xl bg-white/[0.06] p-0.5" role="radiogroup" aria-label="Tipo de movimiento">
              {([1, -1] as const).map((sg) => (
                <button
                  key={sg}
                  type="button"
                  role="radio"
                  aria-checked={form.sign === sg}
                  aria-label={sg === 1 ? "Entra dinero" : "Sale dinero"}
                  onClick={() => setForm({ ...form, sign: sg })}
                  className={`h-10 w-9 rounded-lg text-base font-bold transition-colors ${
                    form.sign === sg ? (sg === 1 ? "bg-emerald-400/25 text-emerald-200" : "bg-red-400/25 text-red-200") : "text-white/50 hover:text-white"
                  }`}
                >
                  {sg === 1 ? "+" : "−"}
                </button>
              ))}
            </div>
            <div className="relative w-28 shrink-0">
              <input
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && void addMove()}
                placeholder="0,00"
                aria-label="Importe del movimiento"
                className="glass-input w-full rounded-xl py-2.5 pl-3 pr-7 text-right text-base font-semibold tabular-nums"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-white/60">€</span>
            </div>
            <input
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && void addMove()}
              placeholder="Concepto"
              aria-label="Concepto del movimiento"
              maxLength={120}
              className="glass-input min-w-0 flex-1 rounded-xl px-3 py-2.5 text-base"
            />
          </div>
          <button
            type="button"
            onClick={() => void addMove()}
            disabled={busy}
            className="liquid-button w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-cyan-950 disabled:opacity-60"
          >
            {form.sign === 1 ? "Añadir a la cartera" : "Sacar de la cartera"}
          </button>
        </div>

        {error && <p className="mt-2 text-sm text-red-300">{error}</p>}

        {/* Historial */}
        <ul className="nice-scroll -mx-1 mt-4 flex-1 divide-y divide-white/[0.06] overflow-y-auto px-1">
          {wallet.movements.length === 0 && <li className="py-6 text-center text-sm text-white/50">Todavía no hay movimientos</li>}
          {wallet.movements.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-white/90">{m.note || "Movimiento"}</span>
                <span className="block text-xs text-white/50">{shortDate(m.date)}</span>
              </span>
              <span className={`shrink-0 text-sm font-semibold tabular-nums ${m.amount >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                {m.amount >= 0 ? "+" : ""}
                {fmt(m.amount)}
              </span>
              {m.refundId ? (
                // Viene de la devolución de un gasto: se quita desde ese gasto
                <span className="w-7 shrink-0" title="Se quita desde el gasto" />
              ) : (
                <button
                  type="button"
                  onClick={() => void save({ initial: typedInitial(), movements: wallet.movements.filter((x) => x.id !== m.id) })}
                  disabled={busy}
                  aria-label={`Borrar movimiento ${m.note}`}
                  className="w-7 shrink-0 rounded-lg p-1 text-white/40 transition-colors hover:bg-red-500/10 hover:text-red-300"
                >
                  <Trash2 className="mx-auto h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body
  )
}

import { useState } from "react"
import { Plus, Target, Trash2 } from "lucide-react"
import { fmt } from "../../utils/formatters"
import { currentMonthKey, monthLabel, newCategoryId } from "../../utils/month"
import type { SavingsGoal } from "../../types/budget"
import { parseAmount } from "./helpers"

const round = (n: number) => Math.round(n * 100) / 100

// Meses que quedan hasta la fecha de la meta, contando el actual (0 si ya pasó)
const monthsUntil = (month: string) => {
  const [y1, m1] = currentMonthKey().split("-").map(Number)
  const [y2, m2] = month.split("-").map(Number)
  return Math.max(0, (y2 - y1) * 12 + (m2 - m1) + 1)
}

// Metas de ahorro dentro de la cartera: cada una aparta una parte del saldo. Lo apartado entre todas no puede
// pasar del saldo de la cartera
export const GoalsSection = ({ goals, balance, onSave }: { goals: SavingsGoal[]; balance: number; onSave: (g: SavingsGoal[]) => Promise<boolean> }) => {
  const [form, setForm] = useState<{ name: string; target: string; month: string } | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const assigned = round(goals.reduce((a, g) => a + g.saved, 0))
  const free = round(balance - assigned)

  const save = async (list: SavingsGoal[]) => {
    setBusy(true)
    setError(null)
    const ok = await onSave(list)
    setBusy(false)
    if (!ok) setError("No se pudo guardar. Inténtalo de nuevo.")
    return ok
  }

  const create = async () => {
    if (!form) return
    const target = parseAmount(form.target)
    if (!form.name.trim()) return setError("Ponle un nombre a la meta.")
    if (!(target > 0)) return setError("Escribe cuánto quieres juntar.")
    const goal: SavingsGoal = { id: newCategoryId(), name: form.name.trim(), target: round(target), saved: 0, ...(form.month ? { month: form.month } : {}) }
    if (await save([...goals, goal])) setForm(null)
  }

  // Cambiar lo apartado para una meta: como mucho lo que ya tenía más lo libre de la cartera
  const setSaved = async (g: SavingsGoal) => {
    const raw = drafts[g.id]
    if (raw === undefined) return
    const n = raw.trim() === "" ? 0 : parseAmount(raw)
    setDrafts(({ [g.id]: _, ...rest }) => rest)
    if (!Number.isFinite(n) || n < 0) return setError("Lo apartado tiene que ser un número positivo.")
    const max = round(g.saved + Math.max(0, free))
    if (n > max + 0.005) return setError(`En la cartera solo quedan ${fmt(Math.max(0, free))} sin apartar.`)
    if (round(n) !== g.saved) await save(goals.map((x) => (x.id === g.id ? { ...x, saved: round(n) } : x)))
  }

  return (
    <section className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3.5" aria-label="Metas de ahorro">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium text-white/85">
          <Target className="h-4 w-4 text-cyan-300" />
          Metas
        </p>
        <div className="flex items-center gap-2">
          {goals.length > 0 && (
            <span className={`text-xs tabular-nums ${free < -0.005 ? "text-red-300" : "text-white/55"}`}>Sin apartar: {fmt(free)}</span>
          )}
          {!form && (
            <button
              type="button"
              onClick={() => setForm({ name: "", target: "", month: "" })}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-cyan-300 hover:bg-white/[0.06] hover:text-cyan-200"
            >
              <Plus className="h-3.5 w-3.5" />
              Nueva
            </button>
          )}
        </div>
      </div>

      {goals.length === 0 && !form && (
        <p className="mt-1.5 text-xs text-white/50">Aparta parte de la cartera para algo concreto (un viaje, el coche…) y ve cuánto te falta.</p>
      )}

      {form && (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <input
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="¿Para qué? (Viaje…)"
              aria-label="Nombre de la meta"
              maxLength={60}
              className="glass-input min-w-0 flex-1 rounded-xl px-3 py-2.5 text-base"
            />
            <div className="relative w-28 shrink-0">
              <input
                inputMode="decimal"
                value={form.target}
                onChange={(e) => setForm({ ...form, target: e.target.value })}
                placeholder="Objetivo"
                aria-label="Cuánto quieres juntar"
                className="glass-input w-full rounded-xl py-2.5 pl-3 pr-7 text-right text-base font-semibold tabular-nums"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-white/60">€</span>
            </div>
          </div>
          <label className="flex items-center justify-between gap-3 text-xs text-white/60">
            Para cuándo (opcional)
            <input
              type="month"
              value={form.month}
              min={currentMonthKey()}
              onChange={(e) => setForm({ ...form, month: e.target.value })}
              aria-label="Para cuándo"
              className="glass-input rounded-lg px-2.5 py-1.5 text-sm"
            />
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={() => void create()} disabled={busy} className="liquid-button rounded-xl px-4 py-2.5 text-sm font-semibold text-cyan-950 disabled:opacity-60">
              Crear meta
            </button>
            <button type="button" onClick={() => { setForm(null); setError(null) }} className="rounded-xl px-3 py-2.5 text-sm text-white/65 hover:text-white">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {goals.length > 0 && (
        <ul className="mt-3 space-y-3">
          {goals.map((g) => {
            const left = round(Math.max(0, g.target - g.saved))
            const pct = g.target > 0 ? Math.min(100, (g.saved / g.target) * 100) : 0
            const months = g.month ? monthsUntil(g.month) : null
            return (
              <li key={g.id}>
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-white/90">{g.name}</span>
                  <span className="relative w-24 shrink-0">
                    <input
                      inputMode="decimal"
                      value={drafts[g.id] ?? String(g.saved).replace(".", ",")}
                      onChange={(e) => setDrafts({ ...drafts, [g.id]: e.target.value })}
                      onBlur={() => void setSaved(g)}
                      onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
                      aria-label={`Apartado para ${g.name}`}
                      title="Lo que apartas de la cartera para esta meta"
                      className="glass-input w-full rounded-lg py-1.5 pl-2 pr-6 text-right text-sm font-semibold tabular-nums"
                    />
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-white/60">€</span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-white/50">/ {fmt(g.target)}</span>
                  <button
                    type="button"
                    onClick={() => void save(goals.filter((x) => x.id !== g.id))}
                    disabled={busy}
                    aria-label={`Borrar meta ${g.name}`}
                    className="shrink-0 rounded-lg p-1 text-white/40 transition-colors hover:bg-red-500/10 hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                  <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-white/55">
                  {left <= 0.005
                    ? "¡Conseguida!"
                    : months === null
                      ? `Faltan ${fmt(left)}`
                      : months === 0
                        ? `Faltan ${fmt(left)} y ya pasó la fecha (${monthLabel(g.month!)})`
                        : `Faltan ${fmt(left)}: ${fmt(left / months)} al mes hasta ${monthLabel(g.month!)}`}
                </p>
              </li>
            )
          })}
        </ul>
      )}

      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </section>
  )
}

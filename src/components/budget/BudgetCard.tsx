import { useState, type FormEvent, type ReactNode } from "react"
import { Pencil, Check } from "lucide-react"
import { fmt } from "../../utils/formatters"
import { monthLabel } from "../../utils/month"
import type { MonthStatus, MonthSummary } from "../../types/budget"
import { parseAmount } from "./helpers"

interface BudgetCardProps {
  summary: MonthSummary
  onSetBudget: (month: string, amount: number) => Promise<boolean>
}

const TONES: Record<MonthStatus, { text: string; bar: string; box: string; glow: string }> = {
  bien: {
    text: "text-emerald-300",
    bar: "from-cyan-400 to-emerald-400",
    box: "border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-100",
    glow: "rgba(52, 211, 153, 0.16)",
  },
  "ritmo-alto": {
    text: "text-amber-300",
    bar: "from-amber-300 to-amber-500",
    box: "border-amber-400/30 bg-amber-400/[0.09] text-amber-100",
    glow: "rgba(251, 191, 36, 0.15)",
  },
  pasado: {
    text: "text-red-400",
    bar: "from-red-400 to-red-600",
    box: "border-red-400/30 bg-red-500/[0.10] text-red-100",
    glow: "rgba(248, 113, 113, 0.17)",
  },
  "sin-presupuesto": {
    text: "text-cyan-300",
    bar: "from-cyan-400 to-sky-500",
    box: "border-cyan-400/25 bg-cyan-400/[0.07] text-cyan-100",
    glow: "rgba(34, 211, 238, 0.14)",
  },
}

const dias = (n: number) => `${n} ${n === 1 ? "día" : "días"}`

function statusMessage(s: MonthSummary): string {
  if (s.budget === null) return ""
  const over = -s.remaining
  if (s.isPast) {
    return s.status === "pasado"
      ? `Mes cerrado fuera del presupuesto: te pasaste ${fmt(over)}.`
      : `Mes cerrado dentro del presupuesto: te sobraron ${fmt(s.remaining)}.`
  }
  if (!s.isCurrent) return "Este mes aún no ha empezado."
  if (s.status === "pasado") return `Has superado el presupuesto por ${fmt(over)}. Cada gasto nuevo suma.`
  const daily = s.dailyAllowance ?? 0
  if (daily < 0.005) return "Has gastado justo todo el presupuesto. Hasta fin de mes, mejor no gastar más."
  if (s.status === "ritmo-alto")
    return `Vas algo por encima del ritmo del mes: para llegar a fin de mes te quedan ${fmt(daily)} al día (${dias(s.daysLeft)}).`
  return `Vas bien: puedes gastar ${fmt(daily)} al día hasta fin de mes (${dias(s.daysLeft)}).`
}

interface EditorProps {
  month: string
  initial: number | null
  onSave: (amount: number) => Promise<boolean>
  onCancel?: () => void
}

const BudgetEditor = ({ month, initial, onSave, onCancel }: EditorProps) => {
  const [value, setValue] = useState(initial !== null ? String(initial).replace(".", ",") : "")
  const [saving, setSaving] = useState(false)
  const [invalid, setInvalid] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const n = parseAmount(value)
    if (!(n > 0)) return setInvalid(true)
    setSaving(true)
    const ok = await onSave(Math.round(n * 100) / 100)
    setSaving(false)
    if (ok) onCancel?.()
  }

  return (
    <form onSubmit={submit} className="space-y-2.5">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            autoFocus
            inputMode="decimal"
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setInvalid(false)
            }}
            placeholder="0,00"
            aria-label="Presupuesto mensual"
            className={`glass-input w-full rounded-xl py-3 pl-4 pr-9 text-lg font-semibold tabular-nums ${invalid ? "!border-red-400/70" : ""}`}
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/60">€</span>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="liquid-button flex items-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-[#04202a] disabled:opacity-60"
        >
          <Check className="h-4 w-4" strokeWidth={2.5} />
          {saving ? "Guardando…" : "Guardar"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-3 text-sm text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            Cancelar
          </button>
        )}
      </div>
      <p className="text-xs text-white/60">
        {invalid ? "Escribe un importe mayor que 0." : `Se aplica desde ${monthLabel(month)} en adelante. Los meses anteriores no cambian.`}
      </p>
    </form>
  )
}

export const BudgetCard = ({ summary: s, onSetBudget }: BudgetCardProps) => {
  const [editing, setEditing] = useState(false)
  const tone = TONES[s.status]
  const label = monthLabel(s.month)

  const shell = (children: ReactNode) => (
    <section
      className="glass-panel relative overflow-hidden rounded-3xl p-5 sm:p-7"
      style={{ backgroundImage: `radial-gradient(ellipse 90% 70% at 50% -20%, ${tone.glow}, transparent 70%)` }}
    >
      {children}
    </section>
  )

  // Sin presupuesto: llamada clara a fijarlo
  if (s.budget === null) {
    return shell(
      <div className="space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">Primer paso</p>
          <h2 className="mt-1.5 text-2xl font-bold tracking-tight">¿Cuánto quieres gastar en {label}?</h2>
          <p className="mt-1 text-sm text-white/50">Fija un presupuesto mensual y te diré si vas bien o te estás pasando.</p>
        </div>
        <BudgetEditor month={s.month} initial={null} onSave={(a) => onSetBudget(s.month, a)} />
        {s.spent > 0 && (
          <p className="text-sm text-white/55">
            Llevas gastado <span className="font-semibold text-white">{fmt(s.spent)}</span> este mes.
          </p>
        )}
      </div>
    )
  }

  const over = s.remaining < 0
  const headline = s.isPast ? (over ? "Te pasaste" : "Sobraron") : over ? "Te has pasado" : "Te quedan"
  const barPct = Math.min(100, s.pctSpent)

  return shell(
    <div className="space-y-6">
      {/* Presupuesto */}
      {editing ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">Presupuesto de {label}</p>
          <BudgetEditor
            month={s.month}
            initial={s.budget}
            onSave={(a) => onSetBudget(s.month, a)}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
            Presupuesto <span className="ml-1 text-sm normal-case tracking-normal text-white/80 tabular-nums">{fmt(s.budget)}</span>
          </p>
          <button
            onClick={() => setEditing(true)}
            aria-label="Editar presupuesto"
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/55 transition-colors hover:bg-white/[0.07] hover:text-white"
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </button>
        </div>
      )}

      {/* Cifra principal */}
      <div>
        <p className="text-sm text-white/55">{headline}</p>
        <p className={`mt-0.5 text-5xl font-bold tabular-nums tracking-tight sm:text-6xl ${tone.text}`}>
          {fmt(Math.abs(s.remaining))}
        </p>
      </div>

      {/* Barra con marca de ritmo esperado */}
      <div>
        <div className="relative">
          <div className="h-3.5 overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${tone.bar} transition-all duration-700 ease-out`}
              style={{ width: `${barPct}%` }}
            />
          </div>
          {s.isCurrent && (
            <div
              className="absolute -bottom-1.5 -top-1.5 w-[3px] -translate-x-1/2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]"
              style={{ left: `${Math.min(100, s.pctElapsed)}%` }}
              title={`Ritmo esperado: ${Math.round(s.pctElapsed)} % del mes`}
            />
          )}
        </div>
        <div className="mt-3 flex items-baseline justify-between gap-3 text-sm">
          <p className="text-white/55">
            Gastado <span className="font-semibold text-white tabular-nums">{fmt(s.spent)}</span>
            <span className="ml-1.5 text-white/60">· {Math.round(s.pctSpent)} %</span>
          </p>
          {s.isCurrent && (
            <p className="flex items-center gap-1.5 text-xs text-white/60">
              <span className="inline-block h-3 w-[3px] rounded-full bg-white" />
              Ritmo esperado {Math.round(s.pctElapsed)} %
            </p>
          )}
        </div>
      </div>

      {/* Mensaje */}
      <p className={`rounded-2xl border px-4 py-3 text-sm leading-relaxed ${tone.box}`}>{statusMessage(s)}</p>
    </div>
  )
}

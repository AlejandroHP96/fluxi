import { useMemo } from "react"
import { TrendingDown, TrendingUp } from "lucide-react"
import { fmt } from "../../utils/formatters"
import { biggestChange, compareWithPast } from "../../utils/compare"
import type { BudgetCategory, Expense } from "../../types/budget"
import { catColor } from "./helpers"

const signed = (n: number) => `${n > 0 ? "+" : ""}${Math.round(n)} %`

// Color del cambio: gastar más que la media es lo que hay que vigilar
const tone = (d: number | null) =>
  d === null ? "text-white/45" : d >= 10 ? "text-red-300" : d <= -10 ? "text-emerald-300" : "text-white/60"

// Este mes frente a la media de los anteriores: titular con el cambio más grande y una fila por sobre
export const MonthCompare = ({ expenses, month, categories }: { expenses: Expense[]; month: string; categories: BudgetCategory[] }) => {
  const c = useMemo(() => compareWithPast(expenses, month, categories), [expenses, month, categories])
  if (!c.months || !c.rows.some((r) => r.spent > 0 || r.average > 0)) return null
  const top = biggestChange(c)
  const rows = c.rows.filter((r) => r.spent > 0.005 || r.average > 0.005)

  return (
    <section className="glass-panel rounded-3xl p-4 sm:p-5" aria-label="Comparación con otros meses">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-white/60">Frente a tu media</h2>
        <p className="text-xs text-white/50">
          {c.months === 1 ? "el mes anterior" : `media de los ${c.months} meses anteriores`}
          {c.upToDay !== null && `, hasta el día ${c.upToDay}`}
        </p>
      </div>

      {top && (
        <p className="mt-2.5 flex items-start gap-2 text-sm text-white/85">
          {top.spent > top.average ? (
            <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
          ) : (
            <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
          )}
          <span>
            Este mes gastas un <span className="font-semibold">{Math.abs(Math.round(top.diffPct!))} % {top.spent > top.average ? "más" : "menos"}</span> en{" "}
            <span className="font-semibold">{top.category.name}</span> ({fmt(top.spent)} frente a {fmt(top.average)}).
          </span>
        </p>
      )}

      <ul className="mt-3 divide-y divide-white/[0.06]">
        {rows.map((r) => {
          const max = Math.max(r.spent, r.average, 0.01)
          return (
            <li key={r.category.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: catColor(categories, r.category) }} />
                  <span className="truncate text-sm text-white/85">{r.category.name}</span>
                </div>
                {/* Barra de este mes y marca de la media */}
                <div className="relative mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                  <div className="h-full rounded-full bg-cyan-400/70" style={{ width: `${(r.spent / max) * 100}%` }} />
                  <div className="absolute inset-y-0 w-0.5 bg-white/70" style={{ left: `calc(${(r.average / max) * 100}% - 1px)` }} title="Media" />
                </div>
              </div>
              <span className="text-right text-xs tabular-nums text-white/60">
                <span className="block font-semibold text-white/90">{fmt(r.spent)}</span>
                media {fmt(r.average)}
              </span>
              <span className={`w-12 text-right text-xs font-semibold tabular-nums ${tone(r.diffPct)}`}>{r.diffPct === null ? "nuevo" : signed(r.diffPct)}</span>
            </li>
          )
        })}
      </ul>
      <p className="mt-2 text-right text-xs text-white/55 tabular-nums">
        Total {fmt(c.total.spent)} · media {fmt(c.total.average)}
        {c.total.diffPct !== null && <span className={`ml-1.5 font-semibold ${tone(c.total.diffPct)}`}>{signed(c.total.diffPct)}</span>}
      </p>
    </section>
  )
}

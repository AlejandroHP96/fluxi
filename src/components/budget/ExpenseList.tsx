import { useMemo } from "react"
import { Plus } from "lucide-react"
import { fmt } from "../../utils/formatters"
import { todayKey } from "../../utils/month"
import type { Expense } from "../../types/budget"
import { catColor, dayLabel } from "./helpers"

interface ExpenseListProps {
  expenses: Expense[] // ya filtrados por mes y ordenados (más recientes primero)
  loading: boolean
  onSelect: (e: Expense) => void
  onAdd: () => void
}

export const ExpenseList = ({ expenses, loading, onSelect, onAdd }: ExpenseListProps) => {
  const groups = useMemo(() => {
    const map = new Map<string, Expense[]>()
    for (const e of expenses) map.set(e.date, [...(map.get(e.date) ?? []), e])
    return [...map.entries()].map(([date, items]) => ({ date, items, total: items.reduce((a, e) => a + e.amount, 0) }))
  }, [expenses])
  const today = todayKey()

  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/60">Gastos del mes</h2>

      {loading ? (
        <div className="space-y-2.5" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-2xl bg-white/[0.04]" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/12 px-6 py-12 text-center">
          <p className="text-base font-medium text-white/80">Todavía no hay gastos este mes</p>
          <p className="mt-1 text-sm text-white/60">Apunta el primero y verás cómo avanza tu presupuesto.</p>
          <button
            onClick={onAdd}
            className="liquid-button mx-auto mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-[#04202a]"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Apuntar gasto
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.date}>
              <div className="mb-1.5 flex items-baseline justify-between px-1">
                <span className="text-sm font-semibold text-white/80 first-letter:uppercase">{dayLabel(g.date, today)}</span>
                <span className="text-xs tabular-nums text-white/60">{fmt(g.total)}</span>
              </div>
              <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025]">
                {g.items.map((e) => (
                  <li key={e.id}>
                    <button
                      onClick={() => onSelect(e)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.05] active:bg-white/[0.08]"
                    >
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: catColor(e.category) }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium">{e.concept}</span>
                        <span className="block text-xs text-white/60">{e.category}</span>
                      </span>
                      <span className="shrink-0 text-[15px] font-semibold tabular-nums">{fmt(e.amount)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

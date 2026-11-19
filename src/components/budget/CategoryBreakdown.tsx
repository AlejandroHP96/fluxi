import { fmt } from "../../utils/formatters"
import type { MonthSummary } from "../../types/budget"
import { catColor } from "./helpers"

export const CategoryBreakdown = ({ summary }: { summary: MonthSummary }) => {
  if (summary.byCategory.length === 0) return null
  const max = summary.byCategory[0].amount

  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/60">Por categoría</h2>
      <ul className="space-y-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
        {summary.byCategory.map(({ category, amount }) => (
          <li key={category}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="text-white/75">{category}</span>
              <span className="tabular-nums text-white/75">
                {fmt(amount)}
                <span className="ml-2 text-xs text-white/60">{Math.round((amount / summary.spent) * 100)} %</span>
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${(amount / max) * 100}%`, backgroundColor: catColor(category), opacity: 0.85 }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

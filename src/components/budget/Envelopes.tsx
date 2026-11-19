import { AlertTriangle, CircleDashed, HelpCircle, PiggyBank, SlidersHorizontal } from "lucide-react"
import { fmt } from "../../utils/formatters"
import type { BudgetCategory, EnvelopeStatus, EnvelopeSummary, MonthSummary } from "../../types/budget"
import { catColor } from "./helpers"

interface EnvelopesProps {
  summary: MonthSummary
  categories: BudgetCategory[]
  onEdit: () => void
}

const pct = (n: number) => `${Math.round(n * 10) / 10} %`.replace(".", ",")

const STATUS: Record<EnvelopeStatus, { bar: string; text: string }> = {
  ok: { bar: "bg-gradient-to-r from-cyan-400 to-emerald-400", text: "text-emerald-300" },
  casi: { bar: "bg-gradient-to-r from-amber-300 to-amber-500", text: "text-amber-300" },
  pasado: { bar: "bg-gradient-to-r from-red-400 to-red-600", text: "text-red-400" },
}

const Envelope = ({ e, categories, hasIncome }: { e: EnvelopeSummary; categories: BudgetCategory[]; hasIncome: boolean }) => {
  const st = STATUS[e.status]
  const over = e.remaining < -0.005
  return (
    <li className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3.5">
      <div className="flex items-center gap-2.5">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: catColor(categories, e.category) }} />
        <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{e.category.name}</span>
        <span className="shrink-0 rounded-full bg-white/[0.07] px-2 py-0.5 text-xs tabular-nums text-white/75">{pct(e.category.pct)}</span>
      </div>

      {hasIncome ? (
        <>
          <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-white/[0.08]">
            <div className={`h-full rounded-full transition-all duration-500 ${st.bar}`} style={{ width: `${Math.min(100, e.pctSpent)}%` }} />
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-3 text-sm">
            <span className="text-white/65 tabular-nums">
              {fmt(e.spent)} <span className="text-white/60">de {fmt(e.allocated)}</span>
            </span>
            <span className={`shrink-0 font-semibold tabular-nums ${st.text}`}>
              {over ? `Te pasas ${fmt(-e.remaining)}` : `Quedan ${fmt(e.remaining)}`}
            </span>
          </div>
        </>
      ) : (
        e.spent > 0 && <p className="mt-1.5 pl-5 text-sm tabular-nums text-white/65">Gastado {fmt(e.spent)}</p>
      )}
    </li>
  )
}

export const Envelopes = ({ summary: s, categories, onEdit }: EnvelopesProps) => {
  const hasIncome = s.income !== null
  const overHundred = s.totalPct > 100.005

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">Sobres del mes</h2>
          {hasIncome && s.totalFixed > 0 && (
            <p className="mt-0.5 text-xs text-white/50">
              Reparto sobre <span className="font-medium text-white/70 tabular-nums">{fmt(s.netIncome)}</span> (nómina − fijos)
            </p>
          )}
        </div>
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-medium text-white/75 transition-colors hover:border-cyan-400/40 hover:text-white"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Ajustar reparto
        </button>
      </div>

      {!hasIncome && (
        <p className="mb-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.06] px-4 py-3 text-sm text-cyan-100">
          Apunta la nómina de este mes para ver cuánto toca a cada sobre.
        </p>
      )}

      {overHundred && (
        <p className="mb-3 flex items-start gap-2 rounded-2xl border border-amber-400/30 bg-amber-400/[0.09] px-4 py-3 text-sm text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Tus porcentajes suman {pct(s.totalPct)}: repartes más de lo que cobras. Ajusta el reparto.
        </p>
      )}

      <ul className="space-y-2.5">
        {s.envelopes.map((e) => (
          <Envelope key={e.category.id} e={e} categories={categories} hasIncome={hasIncome} />
        ))}

        {s.uncategorized > 0.005 && (
          <li className="flex items-center gap-2.5 rounded-2xl border border-dashed border-white/15 px-4 py-3.5">
            <HelpCircle className="h-4 w-4 shrink-0 text-white/60" />
            <span className="flex-1 text-[15px] text-white/80">Sin categoría</span>
            <span className="text-sm tabular-nums text-white/65">Gastado {fmt(s.uncategorized)}</span>
          </li>
        )}

        {s.unassigned > 0.005 || (!hasIncome && s.unassignedPct > 0) ? (
          <li className="flex items-center gap-2.5 rounded-2xl border border-dashed border-white/15 px-4 py-3.5">
            <CircleDashed className="h-4 w-4 shrink-0 text-white/60" />
            <span className="flex-1 text-[15px] text-white/80">
              Sin asignar <span className="ml-1 text-xs text-white/60">{pct(s.unassignedPct)}</span>
            </span>
            <span className="text-sm tabular-nums text-white/65">{hasIncome ? `${fmt(s.unassigned)} libres` : "dinero libre"}</span>
          </li>
        ) : null}
      </ul>

      {s.savings.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
            <PiggyBank className="h-3.5 w-3.5" />
            Apartado para ahorro
          </h3>
          <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.05]">
            {s.savings.map((e) => (
              <li key={e.category.id} className="flex items-center gap-2.5 px-4 py-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: catColor(categories, e.category) }} />
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{e.category.name}</span>
                <span className="shrink-0 rounded-full bg-white/[0.07] px-2 py-0.5 text-xs tabular-nums text-white/75">{pct(e.category.pct)}</span>
                <span className="w-24 shrink-0 text-right text-sm font-semibold tabular-nums text-cyan-200">
                  {hasIncome ? fmt(e.allocated) : "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

import { AlertTriangle, CircleDashed, HelpCircle, SlidersHorizontal } from "lucide-react"
import { fmt } from "../../utils/formatters"
import type { BudgetCategory, EnvelopeStatus, EnvelopeSummary, MonthSummary } from "../../types/budget"
import { catColor } from "./helpers"

interface EnvelopesGridProps {
  summary: MonthSummary
  categories: BudgetCategory[]
  onEdit: () => void
}

const pct = (n: number) => `${Math.round(n * 10) / 10} %`.replace(".", ",")

const STATUS: Record<EnvelopeStatus, { bar: string; text: string; badge: string }> = {
  ok: {
    bar: "bg-gradient-to-r from-cyan-400 to-emerald-400",
    text: "text-emerald-300",
    badge: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  },
  casi: {
    bar: "bg-gradient-to-r from-amber-300 to-amber-500",
    text: "text-amber-300",
    badge: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  },
  pasado: {
    bar: "bg-gradient-to-r from-red-400 to-red-600",
    text: "text-red-400",
    badge: "border-red-400/30 bg-red-500/10 text-red-300",
  },
}

const EnvelopeCard = ({
  e,
  categories,
  hasIncome,
}: {
  e: EnvelopeSummary
  categories: BudgetCategory[]
  hasIncome: boolean
}) => {
  const st = STATUS[e.status]
  const over = e.remaining < -0.005
  const isSavings = e.category.savings
  const color = catColor(categories, e.category)

  return (
    <div className="glass-panel flex min-w-0 flex-col justify-between rounded-2xl p-3.5 transition-all duration-300 hover:border-cyan-400/30 sm:p-4">
      <div>
        {/* Cabecera del sobre */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.2)]"
              style={{ backgroundColor: color }}
            />
            <span className="truncate text-sm font-semibold text-white/95">{e.category.name}</span>
          </div>
          <span className="shrink-0 rounded-full bg-white/[0.08] px-2 py-0.5 text-[11px] font-medium tabular-nums text-white/70">
            {isSavings ? "Ahorro" : pct(e.category.pct)}
          </span>
        </div>

        {/* Cifra principal */}
        <div className="my-2.5 sm:my-3">
          {hasIncome ? (
            <div>
              <p className={`text-lg font-bold tabular-nums tracking-tight sm:text-2xl ${st.text}`}>
                {fmt(Math.abs(e.remaining))}
              </p>
              <p className="mt-0.5 text-xs text-white/55 tabular-nums">
                {over ? "por encima de" : "quedan de"} {fmt(e.allocated)}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-lg font-bold tabular-nums text-white sm:text-2xl">{fmt(e.spent)}</p>
              <p className="mt-0.5 text-xs text-white/50">Gastado hasta ahora</p>
            </div>
          )}
        </div>
      </div>

      {/* Barra de progreso e indicador */}
      <div>
        {hasIncome && e.allocated > 0 ? (
          <div className="space-y-1.5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${st.bar}`}
                style={{ width: `${Math.min(100, Math.max(0, e.pctSpent))}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-2 text-[11px] text-white/50 tabular-nums">
              <span>{Math.round(e.pctSpent)} % gastado</span>
              {e.status === "casi" && <span className="text-amber-300 font-medium">Alerta 90%</span>}
              {e.status === "pasado" && <span className="text-red-400 font-medium">Límite superado</span>}
            </div>
          </div>
        ) : (
          <div className="h-1.5 w-full rounded-full bg-white/[0.05]" />
        )}
      </div>
    </div>
  )
}

export const EnvelopesGrid = ({ summary: s, categories, onEdit }: EnvelopesGridProps) => {
  const hasIncome = s.income !== null
  const overHundred = s.totalPct > 100.005

  return (
    <section className="space-y-3.5">
      {/* Header de la sección */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-white/60">Sobres del mes</h2>
            <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-xs text-white/60">
              {s.envelopes.length + s.savings.length}
            </span>
          </div>
          {hasIncome && s.totalFixed > 0 && (
            <p className="mt-0.5 text-xs text-white/50">
              Reparto sobre <span className="font-medium text-white/75 tabular-nums">{fmt(s.netIncome)}</span>{" "}
              (nómina {fmt(s.income ?? 0)} − {fmt(s.totalFixed)} fijos)
            </p>
          )}
        </div>

        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/75 transition-colors hover:border-cyan-400/40 hover:text-white"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Ajustar reparto (%)
        </button>
      </div>

      {!hasIncome && (
        <p className="rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.06] px-4 py-3 text-sm text-cyan-100">
          Apunta la nómina de este mes para ver cuánto dinero corresponde a cada sobre.
        </p>
      )}

      {overHundred && (
        <p className="flex items-start gap-2 rounded-2xl border border-amber-400/30 bg-amber-400/[0.09] px-4 py-3 text-sm text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Tus porcentajes suman {pct(s.totalPct)}: repartes más de lo que cobras. Ajusta los porcentajes.
        </p>
      )}

      {/* Cuadrícula de tarjetas de sobres */}
      <div className="grid grid-cols-2 gap-3 sm:gap-3.5 lg:grid-cols-3">
        {/* Sobres de gasto variable */}
        {s.envelopes.map((e) => (
          <EnvelopeCard key={e.category.id} e={e} categories={categories} hasIncome={hasIncome} />
        ))}

        {/* Sobres de ahorro */}
        {s.savings.map((e) => (
          <EnvelopeCard key={e.category.id} e={e} categories={categories} hasIncome={hasIncome} />
        ))}

        {/* Tarjeta de gastos huérfanos sin categoría si los hay */}
        {s.uncategorized > 0.005 && (
          <div className="glass-panel flex flex-col justify-between rounded-2xl border-dashed border-amber-400/30 p-3.5 sm:p-4">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 shrink-0 text-amber-300" />
              <span className="text-sm font-semibold text-white/85">Sin categoría</span>
            </div>
            <div className="my-3">
              <p className="text-lg font-bold tabular-nums text-amber-300 sm:text-2xl">{fmt(s.uncategorized)}</p>
              <p className="mt-0.5 text-xs text-white/50">Gastos en categorías eliminadas</p>
            </div>
          </div>
        )}

        {/* Tarjeta de dinero sin asignar si los % no suman 100 */}
        {(s.unassigned > 0.005 || (!hasIncome && s.unassignedPct > 0)) && (
          <div className="glass-panel flex flex-col justify-between rounded-2xl border-dashed border-white/15 p-3.5 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CircleDashed className="h-4 w-4 shrink-0 text-white/60" />
                <span className="text-sm font-semibold text-white/80">Sin asignar</span>
              </div>
              <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[11px] text-white/60">
                {pct(s.unassignedPct)}
              </span>
            </div>
            <div className="my-3">
              <p className="text-lg font-bold tabular-nums text-white/85 sm:text-2xl">
                {hasIncome ? fmt(s.unassigned) : `${pct(s.unassignedPct)}`}
              </p>
              <p className="mt-0.5 text-xs text-white/50">Dinero libre no reservado</p>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

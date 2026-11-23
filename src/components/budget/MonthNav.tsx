import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { monthLabel } from "../../utils/month"

interface MonthNavProps {
  month: string
  isCurrent: boolean
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onAdd: () => void
}

const arrow =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-white/70 transition-colors hover:border-cyan-400/40 hover:text-white active:scale-95"

export const MonthNav = ({ month, isCurrent, onPrev, onNext, onToday, onAdd }: MonthNavProps) => (
  <div className="flex items-center justify-between gap-3">
    <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
      <button onClick={onPrev} aria-label="Mes anterior" className={arrow}>
        <ChevronLeft className="h-5 w-5" />
      </button>
      <h1 className="min-w-0 flex-1 text-center text-base font-semibold tracking-tight first-letter:uppercase sm:min-w-[12rem] sm:flex-none sm:text-xl">
        {monthLabel(month)}
      </h1>
      <button onClick={onNext} aria-label="Mes siguiente" className={arrow}>
        <ChevronRight className="h-5 w-5" />
      </button>
      {!isCurrent && (
        <button
          onClick={onToday}
          className="shrink-0 rounded-full border border-cyan-400/40 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-300 transition-colors hover:bg-cyan-400/20"
        >
          Hoy
        </button>
      )}
    </div>

    <button
      onClick={onAdd}
      className="liquid-button hidden items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-cyan-950 sm:flex"
    >
      <Plus className="h-4 w-4" strokeWidth={2.5} />
      Apuntar gasto
    </button>
  </div>
)

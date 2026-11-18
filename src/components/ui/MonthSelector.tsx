import { Calendar } from "lucide-react"
import type { MonthOption } from "../utils/dateFilters"

interface MonthSelectorProps {
  value: string
  onChange: (monthKey: string) => void
  options: MonthOption[]
  showAllOption?: boolean
}

export const MonthSelector = ({
  value,
  onChange,
  options,
  showAllOption = true,
}: MonthSelectorProps) => {
  return (
    <div className="flex items-center gap-2 glass-card px-3.5 py-1.5 rounded-xl text-xs text-white">
      <Calendar className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-white text-xs font-medium outline-none cursor-pointer pr-1 focus:outline-none"
      >
        {options.map((opt) => (
          <option key={opt.key} value={opt.key} className="bg-slate-900 text-white">
            {opt.label}
          </option>
        ))}
        {showAllOption && (
          <option value="all" className="bg-slate-900 text-white">
            Histórico completo
          </option>
        )}
      </select>
    </div>
  )
}

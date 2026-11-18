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
    <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-1.5 text-xs text-text">
      <Calendar className="w-3.5 h-3.5 text-accent shrink-0" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-text text-xs font-medium outline-none cursor-pointer pr-1"
      >
        {options.map((opt) => (
          <option key={opt.key} value={opt.key} className="bg-card text-text">
            {opt.label}
          </option>
        ))}
        {showAllOption && (
          <option value="all" className="bg-card text-text">
            Histórico completo
          </option>
        )}
      </select>
    </div>
  )
}

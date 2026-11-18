import { Search, Plus, Upload } from "lucide-react"
import { MonthSelector } from "../ui/MonthSelector"
import type { MonthOption } from "../../utils/dateFilters"

interface TopbarProps {
  searchQuery: string
  onSearchChange: (q: string) => void
  selectedMonth: string
  onMonthChange: (m: string) => void
  monthOptions: MonthOption[]
  onAdd: () => void
  onImport: () => void
}

export const Topbar = ({
  searchQuery,
  onSearchChange,
  selectedMonth,
  onMonthChange,
  monthOptions,
  onAdd,
  onImport,
}: TopbarProps) => {
  return (
    <header className="h-16 px-4 sm:px-8 border-b border-white/[0.08] bg-[#07090e]/60 backdrop-blur-2xl flex items-center justify-between gap-4 sticky top-0 z-20">
      {/* 1. Buscador estilo Píldora */}
      <div className="flex-1 max-w-md">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-white/40 absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar gastos, comercios, categorías..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/10 hover:border-white/20 focus:border-cyan-500/50 rounded-full pl-9 pr-12 py-2 text-xs text-white placeholder-white/30 transition-all outline-none"
          />
          <span className="absolute right-3 text-[10px] font-mono text-white/30 bg-white/5 px-1.5 py-0.5 rounded border border-white/10 hidden sm:inline">
            ⌘K
          </span>
        </div>
      </div>

      {/* 2. Selector de mes + Acciones */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        <MonthSelector
          value={selectedMonth}
          onChange={onMonthChange}
          options={monthOptions}
          showAllOption={true}
        />

        {/* Botón Importar */}
        <button
          onClick={onImport}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] text-xs font-medium text-white transition-all hover:border-cyan-500/30"
        >
          <Upload className="w-3.5 h-3.5 text-cyan-400" />
          <span>Importar</span>
        </button>

        {/* Botón Añadir */}
        <button
          onClick={onAdd}
          className="liquid-button flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-xl text-slate-950 text-xs font-bold transition-all active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span className="hidden sm:inline">Añadir</span>
        </button>
      </div>
    </header>
  )
}

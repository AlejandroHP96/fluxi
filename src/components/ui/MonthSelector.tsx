import { useState, useRef, useEffect } from "react"
import { Calendar, ChevronDown, Check } from "lucide-react"
import type { MonthOption } from "../../utils/dateFilters"

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
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Determinar la etiqueta actual seleccionada
  const currentLabel =
    value === "all"
      ? "Histórico completo"
      : options.find((opt) => opt.key === value)?.label || "Seleccionar mes"

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`glass-card flex items-center gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-medium text-white transition-all select-none hover:border-cyan-500/40 ${
          isOpen ? "border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.25)] ring-1 ring-cyan-500/30" : ""
        }`}
      >
        <Calendar className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
        <span className="truncate max-w-[130px] sm:max-w-[170px]">{currentLabel}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-white/50 shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-cyan-400" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 sm:left-0 sm:right-auto mt-2 w-56 max-h-72 overflow-y-auto z-50 rounded-2xl glass-panel p-1.5 shadow-2xl border border-white/15 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-1.5 text-[10px] font-semibold tracking-wider text-white/40 uppercase">
            Periodo
          </div>

          {showAllOption && (
            <button
              type="button"
              onClick={() => {
                onChange("all")
                setIsOpen(false)
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition-colors ${
                value === "all"
                  ? "bg-cyan-500/15 text-cyan-300 font-semibold"
                  : "text-white/80 hover:text-white hover:bg-white/5"
              }`}
            >
              <span>Histórico completo</span>
              {value === "all" && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
            </button>
          )}

          <div className="my-1 border-t border-white/10" />

          <div className="space-y-0.5">
            {options.map((opt) => {
              const isSelected = opt.key === value
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    onChange(opt.key)
                    setIsOpen(false)
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition-colors ${
                    isSelected
                      ? "bg-cyan-500/15 text-cyan-300 font-semibold"
                      : "text-white/80 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

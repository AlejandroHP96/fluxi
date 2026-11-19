import { Check } from "lucide-react"
import type { ReactNode } from "react"

interface CategoryChipProps {
  label: string
  color: string
  active: boolean
  onClick: () => void
  hint?: ReactNode // atajo de teclado, etc.
}

// Chip de categoría: mismo aspecto en «Apuntar gasto» y en la revisión de la importación
export const CategoryChip = ({ label, color, active, onClick, hint }: CategoryChipProps) => (
  <button
    type="button"
    role="radio"
    aria-checked={active}
    onClick={onClick}
    className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2.5 text-sm transition-all active:scale-95 ${
      active
        ? "border-cyan-200 bg-cyan-400/40 font-semibold text-white shadow-[0_0_0_3px_rgba(34,211,238,0.3)]"
        : "border-white/10 bg-white/[0.03] font-medium text-white/65 hover:border-white/25 hover:text-white"
    }`}
  >
    {active ? (
      <Check className="h-3.5 w-3.5 text-cyan-100" strokeWidth={3} />
    ) : (
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
    )}
    {label}
    {hint}
  </button>
)

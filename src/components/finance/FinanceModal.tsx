import type { ReactNode } from "react"
import { createPortal } from "react-dom"

interface FinanceModalProps {
  title: string
  onClose: () => void
  children: ReactNode
}

// Portal: .fade-up deja un transform activo y rompería el position: fixed
export const FinanceModal = ({ title, onClose, children }: FinanceModalProps) =>
  createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel border border-white/10 rounded-3xl p-6 sm:p-7 w-full max-w-sm my-auto max-h-[92vh] overflow-y-auto shadow-2xl"
      >
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-base font-bold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 text-lg leading-none transition-colors"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  )

export const inputClass =
  "w-full glass-input rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"

export const submitClass =
  "mt-6 w-full py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-slate-950 transition-all shadow-md shadow-cyan-500/20 disabled:opacity-50"

export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div>
    <label className="block text-[11px] font-medium text-white/50 mb-1.5">{label}</label>
    {children}
  </div>
)

export const SectionHeader = ({
  title, subtitle, action,
}: { title: string; subtitle?: string; action?: ReactNode }) => (
  <div className="flex flex-wrap justify-between items-start gap-3 mb-5">
    <div>
      <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
      {subtitle && <p className="text-xs text-white/40 mt-0.5">{subtitle}</p>}
    </div>
    {action}
  </div>
)

// Importe con coma o punto → número; NaN si no es válido
export const parseAmount = (s: string): number => parseFloat(s.trim().replace(",", "."))

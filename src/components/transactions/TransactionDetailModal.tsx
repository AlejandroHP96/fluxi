import { useState } from "react"
import { createPortal } from "react-dom"
import { Pencil } from "lucide-react"
import { fmtDec } from "../../utils/formatters"
import AddTransactionModal from "./AddTransactionModal"
import type { NewTransaction, Transaction } from "../../types"

interface TransactionDetailModalProps {
  tx: Transaction
  onClose: () => void
  onUpdate?: (id: string, tx: NewTransaction) => Promise<boolean>
}

const TransactionDetailModal = ({ tx, onClose, onUpdate }: TransactionDetailModalProps) => {
  const [editing, setEditing] = useState(false)
  const [day, time] = tx.date.split(" ")

  if (editing && onUpdate) {
    // Cancelar vuelve al detalle; guardar cierra todo (el detalle tendría los datos antiguos)
    return createPortal(
      <AddTransactionModal
        initial={tx}
        onClose={() => setEditing(false)}
        onSave={async (data) => {
          const ok = await onUpdate(tx.id, data)
          if (ok) onClose()
          return ok
        }}
      />,
      document.body
    )
  }

  // Portal: .fade-up deja un transform activo y rompería el position: fixed
  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel border border-white/10 rounded-3xl p-6 sm:p-7 w-full max-w-sm my-auto max-h-[92vh] overflow-y-auto shadow-2xl"
      >
        <div className="flex justify-between items-start gap-3 mb-5">
          <h3 className="text-base font-bold text-white break-words min-w-0">{tx.description}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 text-lg leading-none transition-colors"
          >
            ×
          </button>
        </div>

        <dl className="space-y-3 text-xs">
          <div className="flex justify-between gap-4">
            <dt className="text-white/50">Importe</dt>
            <dd className={`font-mono font-bold ${tx.type === "income" ? "text-emerald-400" : "text-rose-400"}`}>
              {tx.type === "income" ? "+" : ""}
              {fmtDec(tx.amount)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-white/50">Categoría</dt>
            <dd className="text-white/80">{tx.category}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-white/50">Fecha</dt>
            <dd className="text-white/80">
              {day}
              {time && <span className="text-cyan-400/80 ml-2 font-mono">{time}</span>}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-white/50">Tipo</dt>
            <dd className="text-white/80">{tx.type === "income" ? "Ingreso" : "Gasto"}</dd>
          </div>
        </dl>

        {onUpdate && (
          <button
            onClick={() => setEditing(true)}
            className="mt-6 w-full py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-slate-950 transition-all shadow-md shadow-cyan-500/20 flex items-center justify-center gap-1.5"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>Editar</span>
          </button>
        )}
      </div>
    </div>,
    document.body
  )
}

export default TransactionDetailModal

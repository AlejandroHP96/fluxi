import { useMemo, useState } from "react"
import { ChevronDown, X, ArrowRightLeft } from "lucide-react"
import { inputClass } from "./FinanceModal"
import { isOwnTransfer, ownTransferKind } from "../../utils/finance"
import type { FinanceApi } from "../../hooks/useFinance"
import type { Transaction } from "../../types"

interface TransferSettingsProps {
  transactions: Transaction[]
  finance: FinanceApi
}

export const TransferSettings = ({ transactions, finance }: TransferSettingsProps) => {
  const names = finance.settings.ownTransferNames
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  const matches = useMemo(
    () => (names.length ? transactions.filter((t) => isOwnTransfer(t.description, names)) : []),
    [transactions, names]
  )

  const addName = () => {
    const n = draft.trim()
    if (!n) return
    finance.setOwnTransferNames([...names, n])
    setDraft("")
  }

  const move = async () => {
    if (matches.length === 0) return
    if (!window.confirm(
      `¿Mover ${matches.length} transacciones a traspasos? Dejarán de salir en Transacciones y no contarán como gasto ni ingreso.`
    )) return
    setBusy(true)
    setResult(null)
    const moved = await finance.moveTransactionsToTransfers(
      matches.map((tx) => ({ tx, kind: ownTransferKind(Number(tx.amount)) }))
    )
    setBusy(false)
    setResult(
      moved > 0
        ? { ok: true, text: `Se movieron ${moved} transacciones a traspasos.` }
        : { ok: false, text: "No se pudo mover nada. Inténtalo de nuevo." }
    )
  }

  return (
    <section className="glass-card rounded-2xl p-5 sm:p-6">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border border-white/10 bg-cyan-500/10 text-cyan-400">
            <ArrowRightLeft className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-white tracking-tight">Ajustes de traspasos</h3>
            <p className="text-xs text-white/40">
              {matches.length > 0
                ? `${matches.length} transacciones parecen traspasos entre tus cuentas`
                : "Qué transferencias son entre tus propias cuentas"}
            </p>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-white/50 shrink-0 transition-transform duration-200 ${open ? "rotate-180 text-cyan-400" : ""}`} />
      </button>

      {open && (
        <div className="mt-5 space-y-5">
          <p className="text-xs text-white/50 leading-relaxed">
            Las transferencias entre tus cuentas no son gasto ni ingreso: salen de Transacciones y se ven en
            «Traspasos con tus otras cuentas». Indica aquí los nombres de tus otras cuentas tal y como aparecen en
            el extracto (p. ej. «Transferencia de ALEJANDRO HERRERA PESTANA»).
          </p>

          <div>
            <label className="block text-[11px] font-medium text-white/50 mb-1.5">Nombres de titular</label>
            {names.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {names.map((n) => (
                  <span
                    key={n}
                    className="flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full text-[11px] bg-cyan-500/10 text-cyan-200 border border-cyan-500/20"
                  >
                    {n}
                    <button
                      onClick={() => finance.setOwnTransferNames(names.filter((x) => x !== n))}
                      title="Quitar"
                      className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-white/10 text-cyan-300"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nombre y apellidos"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addName()}
                className={inputClass}
              />
              <button
                onClick={addName}
                disabled={!draft.trim()}
                className="liquid-button px-4 rounded-xl text-xs font-semibold text-white shrink-0 disabled:opacity-40"
              >
                Añadir
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-white/60">
              {names.length === 0
                ? "Añade al menos un nombre para detectar traspasos."
                : matches.length === 0
                  ? "Ninguna transacción actual coincide con esos nombres."
                  : `${matches.length} transacciones actuales coinciden con esos nombres.`}
            </p>
            {matches.length > 0 && (
              <button
                onClick={move}
                disabled={busy}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-slate-950 transition-all disabled:opacity-50"
              >
                {busy ? "Moviendo..." : `Mover ${matches.length} a traspasos`}
              </button>
            )}
          </div>

          {result && (
            <p className={`text-xs ${result.ok ? "text-emerald-400" : "text-rose-400"}`}>{result.text}</p>
          )}
        </div>
      )}
    </section>
  )
}

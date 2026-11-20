import { useState, type FormEvent } from "react"
import { Check, Pencil, PiggyBank, Receipt, TrendingDown, Wallet, X } from "lucide-react"
import { fmt } from "../../utils/formatters"
import { walletBalance, type MonthStatus, type MonthSummary, type Wallet as SavingsWallet } from "../../types/budget"
import { EMPTY_WALLET } from "../../utils/wallet"
import { WalletModal } from "./WalletModal"
import { parseAmount } from "./helpers"

interface BentoKpisProps {
  summary: MonthSummary
  suggestedIncome: number | null
  onSetIncome: (month: string, amount: number) => Promise<boolean>
  onEditFixed: () => void
  wallet: SavingsWallet | null
  onSaveWallet: (w: SavingsWallet) => Promise<boolean>
}

const STATUS_BADGES: Record<MonthStatus, { label: string; bg: string; text: string; border: string }> = {
  bien: {
    label: "Ritmo óptimo",
    bg: "bg-emerald-400/10",
    text: "text-emerald-300",
    border: "border-emerald-400/25",
  },
  "ritmo-alto": {
    label: "Ritmo alto",
    bg: "bg-amber-400/10",
    text: "text-amber-300",
    border: "border-amber-400/25",
  },
  pasado: {
    label: "Te has pasado",
    bg: "bg-red-500/10",
    text: "text-red-400",
    border: "border-red-400/25",
  },
  "sin-nomina": {
    label: "Pendiente nómina",
    bg: "bg-cyan-400/10",
    text: "text-cyan-300",
    border: "border-cyan-400/25",
  },
}

export const BentoKpis = ({
  summary: s,
  suggestedIncome,
  onSetIncome,
  onEditFixed,
  wallet,
  onSaveWallet,
}: BentoKpisProps) => {
  const [walletOpen, setWalletOpen] = useState(false)
  const [editingIncome, setEditingIncome] = useState(false)
  const [incomeVal, setIncomeVal] = useState(s.income !== null ? String(s.income).replace(".", ",") : "")
  const [savingIncome, setSavingIncome] = useState(false)
  const [incomeErr, setIncomeErr] = useState(false)

  const hasIncome = s.income !== null
  const badge = STATUS_BADGES[s.status]

  const handleIncomeSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const n = parseAmount(incomeVal)
    if (!(n > 0)) return setIncomeErr(true)
    setSavingIncome(true)
    const ok = await onSetIncome(s.month, Math.round(n * 100) / 100)
    setSavingIncome(false)
    if (ok) setEditingIncome(false)
  }

  // Tarjeta 1: Disponible (El KPI principal)
  const renderAvailableCard = () => {
    const isNegative = s.available < -0.005
    return (
      <div
        className="glass-panel relative col-span-2 flex flex-col justify-between overflow-hidden rounded-3xl p-4 sm:col-span-1 sm:p-5"
        style={{
          backgroundImage: isNegative
            ? "radial-gradient(ellipse 90% 80% at 90% 10%, rgba(248, 113, 113, 0.15), transparent 70%)"
            : "radial-gradient(ellipse 90% 80% at 90% 10%, rgba(6, 182, 212, 0.14), transparent 70%)",
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">
            {s.isPast ? "Balance final" : "Disponible para gastar"}
          </span>
          <span
            className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${badge.bg} ${badge.text} ${badge.border}`}
          >
            {badge.label}
          </span>
        </div>

        <div className="my-2.5 sm:my-3">
          <p
            className={`text-3xl font-extrabold tracking-tight tabular-nums sm:text-4xl ${
              isNegative ? "text-red-400" : "text-white"
            }`}
          >
            {hasIncome ? fmt(s.available) : "—"}
          </p>

          <p className="mt-1 text-xs text-white/65">
            {hasIncome ? (
              s.isCurrent ? (
                s.dailyAllowance !== null && s.dailyAllowance > 0.005 ? (
                  <>
                    Puedes gastar{" "}
                    <span className="font-semibold text-emerald-300 tabular-nums">{fmt(s.dailyAllowance)}/día</span>{" "}
                    ({s.daysLeft} {s.daysLeft === 1 ? "día" : "días"})
                  </>
                ) : isNegative ? (
                  <span className="text-red-300">Has sobrepasado el presupuesto del mes</span>
                ) : (
                  "Has alcanzado el límite exacto para este mes"
                )
              ) : s.isPast ? (
                s.available >= 0 ? (
                  `Sobraron ${fmt(s.available)} a fin de mes`
                ) : (
                  `Te pasaste ${fmt(-s.available)} a fin de mes`
                )
              ) : (
                "Mes futuro pendiente de inicio"
              )
            ) : (
              "Apunta la nómina para ver tu disponible"
            )}
          </p>
        </div>

        {/* Mini barra de progreso del mes */}
        {hasIncome && s.spendable > 0 && (
          <div className="relative mt-auto pt-2">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isNegative ? "bg-red-400" : "bg-gradient-to-r from-cyan-400 to-emerald-400"
                }`}
                style={{ width: `${Math.min(100, Math.max(0, s.pctSpent))}%` }}
              />
            </div>
            {s.isCurrent && (
              <div
                className="absolute top-1 h-3.5 w-1 -translate-x-1/2 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.7)]"
                style={{ left: `${Math.min(100, Math.max(0, s.pctElapsed))}%` }}
                title={`Día actual: ${Math.round(s.pctElapsed)} % del mes`}
              />
            )}
          </div>
        )}
      </div>
    )
  }

  // Tarjeta 2: Nómina & Gastos Fijos
  const renderIncomeCard = () => {
    return (
      <div className="glass-panel relative flex flex-col justify-between overflow-hidden rounded-3xl p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 text-white/55">
            <Wallet className="h-3.5 w-3.5 text-cyan-300" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">
              Nómina<span className="hidden sm:inline"> & Fijos</span>
            </span>
          </div>
          {hasIncome && !editingIncome && (
            <button
              onClick={() => {
                setIncomeVal(String(s.income).replace(".", ","))
                setEditingIncome(true)
              }}
              aria-label="Editar nómina"
              className="-mr-1 -mt-1 flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-white/55 transition-colors hover:bg-white/[0.08] hover:text-white sm:mr-0 sm:mt-0"
            >
              <Pencil className="h-3 w-3" />
              <span className="hidden sm:inline">Editar</span>
            </button>
          )}
        </div>

        <div className="my-2.5 sm:my-3">
          {editingIncome || !hasIncome ? (
            <form onSubmit={handleIncomeSubmit} className="space-y-2">
              <div className="relative">
                <input
                  autoFocus={editingIncome}
                  inputMode="decimal"
                  value={incomeVal}
                  onChange={(e) => {
                    setIncomeVal(e.target.value)
                    setIncomeErr(false)
                  }}
                  placeholder={suggestedIncome ? String(suggestedIncome) : "0,00"}
                  className={`glass-input w-full rounded-xl py-2 pl-3 pr-8 text-lg font-bold tabular-nums ${
                    incomeErr ? "!border-red-400/70" : ""
                  }`}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-white/60">
                  €
                </span>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="submit"
                  disabled={savingIncome}
                  className="liquid-button flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold text-[#04202a]"
                >
                  <Check className="h-3.5 w-3.5" />
                  {savingIncome ? "…" : hasIncome ? "Guardar" : "Apuntar"}
                </button>
                {editingIncome && hasIncome && (
                  <button
                    type="button"
                    onClick={() => setEditingIncome(false)}
                    className="rounded-lg px-2.5 py-1.5 text-xs text-white/60 hover:bg-white/[0.08] hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </form>
          ) : (
            <>
              <p className="text-2xl font-extrabold tracking-tight tabular-nums text-white sm:text-4xl">
                {fmt(s.netIncome)}
              </p>
              <p className="mt-1 text-xs text-white/65">
                Nómina <span className="font-semibold text-white/90">{fmt(s.income ?? 0)}</span>
                {s.totalFixed > 0 ? (
                  <>
                    {" "}
                    − <span className="text-amber-300 font-medium">{fmt(s.totalFixed)}</span> fijos
                  </>
                ) : (
                  " (sin fijos)"
                )}
              </p>
            </>
          )}
        </div>

        <div className="mt-auto border-t border-white/[0.06] pt-2 text-[11px] text-white/60">
          {s.totalFixed > 0 ? (
            <button
              onClick={onEditFixed}
              className="flex items-center gap-1.5 text-left text-white/60 transition-colors hover:text-cyan-300"
            >
              <Receipt className="h-3.5 w-3.5 text-amber-300" />
              <span>{s.fixedExpenses.length} gastos fijos configurados</span>
            </button>
          ) : (
            <button
              onClick={onEditFixed}
              className="text-left text-white/45 transition-colors hover:text-cyan-300"
            >
              + Añadir gastos fijos mensuales
            </button>
          )}
        </div>
      </div>
    )
  }

  // Tarjeta 3: Ahorro = cartera de ahorros (saldo a mano + movimientos), aparte de los sobres
  const renderSavingsCard = () => {
    const last = wallet?.movements[0]
    return (
      <button
        type="button"
        onClick={() => setWalletOpen(true)}
        className="glass-panel relative flex flex-col justify-between overflow-hidden rounded-3xl p-4 text-left transition-colors hover:border-cyan-400/30 sm:p-5"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 text-white/55">
            <PiggyBank className="h-3.5 w-3.5 text-cyan-300" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">Ahorro</span>
          </div>
          <Pencil className="h-3.5 w-3.5 text-white/40" />
        </div>

        <div className="my-2.5 sm:my-3">
          <p className="text-2xl font-extrabold tracking-tight tabular-nums text-white sm:text-4xl">{fmt(walletBalance(wallet))}</p>
          <p className="mt-1 truncate text-xs text-white/65">
            {last
              ? `Último: ${last.amount > 0 ? "+" : ""}${fmt(last.amount)} · ${last.note || "Movimiento"}`
              : wallet
                ? "Sin movimientos"
                : "Toca para poner tu saldo"}
          </p>
        </div>

        <div className="mt-auto border-t border-white/[0.06] pt-2 text-[11px] text-white/60">
          {s.saved > 0.005 ? (
            <>
              Sobres de ahorro este mes: <span className="font-semibold text-white/90 tabular-nums">{fmt(s.saved)}</span>
            </>
          ) : (
            <>
              Para gastar libre: <span className="font-semibold text-white/90 tabular-nums">{fmt(s.spendable)}</span>
            </>
          )}
        </div>
      </button>
    )
  }

  // Tarjeta 4: Gastado en Sobres
  const renderSpentCard = () => {
    return (
      <div className="glass-panel relative col-span-2 flex flex-col justify-between overflow-hidden rounded-3xl p-4 sm:col-span-1 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 text-white/55">
            <TrendingDown className="h-3.5 w-3.5 text-amber-300" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">Gastos en Sobres</span>
          </div>
          <span className="text-xs text-white/50 tabular-nums">
            {s.count} {s.count === 1 ? "gasto" : "gastos"}
          </span>
        </div>

        <div className="my-2.5 sm:my-3">
          <p className="text-3xl font-extrabold tracking-tight tabular-nums text-white sm:text-4xl">
            {fmt(s.spent)}
          </p>
          <p className="mt-1 text-xs text-white/65">
            {hasIncome && s.spendable > 0 ? (
              <>
                <span className="font-semibold text-white/90 tabular-nums">{Math.round(s.pctSpent)} %</span> del presupuesto para gastar
              </>
            ) : (
              "Total acumulado este mes"
            )}
          </p>
        </div>

        <div className="mt-auto border-t border-white/[0.06] pt-2 text-[11px] text-white/60">
          {s.uncategorized > 0 ? (
            <span className="text-amber-300">{fmt(s.uncategorized)} sin categoría asignada</span>
          ) : s.unassigned > 0.005 ? (
            <span>{fmt(s.unassigned)} libres sin sobre</span>
          ) : (
            <span>100 % del presupuesto asignado</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {renderAvailableCard()}
      {renderIncomeCard()}
      {renderSavingsCard()}
      {renderSpentCard()}
      {walletOpen && <WalletModal wallet={wallet ?? EMPTY_WALLET} onSave={onSaveWallet} onClose={() => setWalletOpen(false)} />}
    </div>
  )
}

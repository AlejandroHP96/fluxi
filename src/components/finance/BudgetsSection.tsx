import { useEffect, useMemo, useState } from "react"
import { SectionHeader, parseAmount } from "./FinanceModal"
import { MonthSelector } from "../ui/MonthSelector"
import { CATEGORIES } from "../../constants/categories"
import { fmtDec } from "../../utils/formatters"
import { getAvailableMonths } from "../../utils/dateFilters"
import { spentByCategory } from "../../utils/finance"
import type { FinanceApi } from "../../hooks/useFinance"
import type { Transaction } from "../../types"

const currentMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

// <75 % normal, ≥75 % aviso, ≥100 % excedido
const level = (pct: number) =>
  pct >= 100
    ? { bar: "bg-rose-500", text: "text-rose-400" }
    : pct >= 75
      ? { bar: "bg-amber-400", text: "text-amber-400" }
      : { bar: "bg-cyan-400", text: "text-cyan-300" }

interface BudgetRowProps {
  category: string
  spent: number
  limit: number | undefined
  onSave: (category: string, limit: number | null) => void
}

const BudgetRow = ({ category, spent, limit, onSave }: BudgetRowProps) => {
  const [draft, setDraft] = useState(limit ? String(limit) : "")
  useEffect(() => setDraft(limit ? String(limit) : ""), [limit])

  const commit = () => {
    const value = parseAmount(draft)
    const next = Number.isNaN(value) || value <= 0 ? null : value
    if (next === (limit ?? null)) {
      setDraft(limit ? String(limit) : "")
      return
    }
    onSave(category, next)
  }

  const pct = limit ? (spent / limit) * 100 : 0
  const lv = level(pct)
  const left = limit ? limit - spent : 0

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-white truncate">{category}</p>
        <div className="flex items-center gap-1.5 shrink-0">
          <input
            type="text"
            inputMode="decimal"
            placeholder="Sin límite"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            aria-label={`Límite mensual de ${category}`}
            className="w-24 glass-input rounded-lg px-2.5 py-1.5 text-xs text-white text-right placeholder-white/20"
          />
          <span className="text-xs text-white/40">€</span>
        </div>
      </div>

      {limit ? (
        <>
          <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden mt-3">
            <div
              className={`h-full rounded-full transition-all duration-500 ${lv.bar}`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
          <div className="flex justify-between items-center gap-2 mt-2 text-[11px]">
            <span className="text-white/60 font-mono">
              {fmtDec(spent)} <span className="text-white/30">/ {fmtDec(limit)}</span>
            </span>
            <span className={`font-semibold ${lv.text}`}>
              {left >= 0 ? `Quedan ${fmtDec(left)}` : `Te pasas ${fmtDec(-left)}`}
            </span>
          </div>
        </>
      ) : (
        <p className="text-[11px] text-white/40 mt-2">
          {spent > 0 ? `Gastado este mes: ${fmtDec(spent)}` : "Sin gasto este mes"} · sin presupuesto
        </p>
      )}
    </div>
  )
}

interface BudgetsSectionProps {
  transactions: Transaction[]
  finance: FinanceApi
}

export const BudgetsSection = ({ transactions, finance }: BudgetsSectionProps) => {
  const [month, setMonth] = useState(currentMonth)
  const monthOptions = useMemo(() => getAvailableMonths(transactions), [transactions])
  const spent = useMemo(() => spentByCategory(transactions, month), [transactions, month])
  const { budgets } = finance.settings

  // Categorías fijas + las que tengan gasto este mes o presupuesto aunque no estén en la lista
  const categories = useMemo(() => {
    const extra = [...Object.keys(spent), ...Object.keys(budgets)].filter((c) => !CATEGORIES.includes(c))
    return [...CATEGORIES, ...new Set(extra)]
  }, [spent, budgets])

  const totalSpent = categories.reduce((s, c) => s + (spent[c] || 0), 0)
  const budgeted = categories.filter((c) => budgets[c])
  const totalLimit = budgeted.reduce((s, c) => s + budgets[c], 0)
  const spentInBudgeted = budgeted.reduce((s, c) => s + (spent[c] || 0), 0)
  const totalPct = totalLimit ? (spentInBudgeted / totalLimit) * 100 : 0
  const lv = level(totalPct)

  return (
    <section className="glass-card rounded-2xl p-5 sm:p-6">
      <SectionHeader
        title="Presupuestos"
        subtitle="Límite mensual por categoría. Déjalo vacío para no tener presupuesto."
        action={<MonthSelector value={month} onChange={setMonth} options={monthOptions} showAllOption={false} />}
      />

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 mb-4">
        <div className="flex flex-wrap justify-between gap-2 text-xs">
          <span className="text-white/50">Gasto del mes</span>
          <span className="font-mono font-bold text-white">{fmtDec(totalSpent)}</span>
        </div>
        {totalLimit > 0 ? (
          <>
            <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden mt-3">
              <div className={`h-full rounded-full transition-all duration-500 ${lv.bar}`} style={{ width: `${Math.min(100, totalPct)}%` }} />
            </div>
            <p className="text-[11px] text-white/40 mt-2">
              Presupuestado: <span className="font-mono text-white/70">{fmtDec(spentInBudgeted)}</span> de{" "}
              <span className="font-mono text-white/70">{fmtDec(totalLimit)}</span> ({Math.round(totalPct)} %)
            </p>
          </>
        ) : (
          <p className="text-[11px] text-white/40 mt-2">Aún no has puesto ningún límite.</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {categories.map((c) => (
          <BudgetRow key={c} category={c} spent={spent[c] || 0} limit={budgets[c]} onSave={finance.setBudget} />
        ))}
      </div>
    </section>
  )
}

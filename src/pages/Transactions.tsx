import { useState, useMemo } from "react"
import TransactionRow from "../components/transactions/TransactionRow"
import { MonthSelector } from "../components/ui/MonthSelector"
import { fmtDec } from "../utils/formatters"
import { getAvailableMonths, filterTransactionsByMonth } from "../utils/dateFilters"
import type { Transaction } from "../types"

const FILTERS: Record<string, string> = {
  all: "Todos",
  income: "Ingresos",
  expense: "Gastos",
}

interface TransactionsProps {
  transactions: Transaction[]
  onDelete: (id: string) => Promise<boolean>
}

const Transactions = ({ transactions, onDelete }: TransactionsProps) => {
  const monthOptions = useMemo(() => getAvailableMonths(transactions), [transactions])
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return monthOptions[0]?.key || "all"
  })
  const [typeFilter, setTypeFilter] = useState("all")

  // Filtrado compuesto: Mes + Tipo (Ingreso / Gasto)
  const filtered = useMemo(() => {
    let result = filterTransactionsByMonth(transactions, selectedMonth)
    if (typeFilter !== "all") {
      result = result.filter((t) => t.type === typeFilter)
    }
    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [transactions, selectedMonth, typeFilter])

  return (
    <div className="fade-up">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
        <div>
          <h2 className="text-xl font-bold">Transacciones</h2>
          <p className="text-xs text-muted">
            {filtered.length} movimiento{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Selector de Mes */}
          <MonthSelector
            value={selectedMonth}
            onChange={setSelectedMonth}
            options={monthOptions}
            showAllOption={true}
          />

          {/* Filtro de Tipo */}
          <div className="flex gap-1 bg-card border border-border rounded-xl p-1">
            {Object.entries(FILTERS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTypeFilter(key)}
                className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs transition-all ${
                  typeFilter === key
                    ? "bg-accent text-black font-semibold"
                    : "text-muted hover:text-text"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile: card list */}
      <div className="sm:hidden bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
        {filtered.length === 0 ? (
          <p className="px-4 py-12 text-center text-muted text-sm">
            No hay transacciones en este periodo.
          </p>
        ) : (
          filtered.map((t) => (
            <div key={t.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{t.description}</p>
                <p className="text-xs text-muted mt-0.5">
                  {t.date} · {t.category}
                </p>
              </div>
              <div className="flex items-center gap-3 ml-3 shrink-0">
                <span
                  className={`text-sm font-mono font-semibold ${
                    t.type === "income" ? "text-income" : "text-expense"
                  }`}
                >
                  {t.type === "income" ? "+" : ""}
                  {fmtDec(t.amount)}
                </span>
                <button
                  onClick={() => onDelete(t.id)}
                  className="text-muted hover:text-expense text-lg leading-none transition-colors"
                >
                  ×
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden sm:block bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-surface">
              {["Fecha", "Descripción", "Categoría", "Importe", ""].map((h, i) => (
                <th
                  key={i}
                  className={`px-4 py-3 text-xs text-muted font-semibold uppercase tracking-wide border-b border-border ${
                    i === 3 ? "text-right" : "text-left"
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted text-sm">
                  No hay transacciones en este periodo.
                </td>
              </tr>
            ) : (
              filtered.map((t, i) => (
                <TransactionRow
                  key={t.id}
                  tx={t}
                  onDelete={onDelete}
                  isEven={i % 2 === 0}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default Transactions

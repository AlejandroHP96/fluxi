import { useMemo, useState } from "react"
import { AlertTriangle, Plus } from "lucide-react"
import type { BudgetApi } from "../hooks/useBudget"
import { budgetFor, currentMonthKey, shiftMonth, summarizeMonth, todayKey } from "../utils/month"
import type { Expense } from "../types/budget"
import { AppHeader } from "../components/budget/AppHeader"
import { MonthNav } from "../components/budget/MonthNav"
import { BudgetCard } from "../components/budget/BudgetCard"
import { ExpenseList } from "../components/budget/ExpenseList"
import { CategoryBreakdown } from "../components/budget/CategoryBreakdown"
import { ExpenseModal } from "../components/budget/ExpenseModal"
import { ImportWizard } from "../components/budget/ImportWizard"

interface MonthDashboardProps {
  email: string | null
  onSignOut: () => void
  budget: BudgetApi
}

type ModalState = { kind: "new" } | { kind: "edit"; expense: Expense } | null

const MonthDashboard = ({ email, onSignOut, budget }: MonthDashboardProps) => {
  const { expenses, history, loading, error, addExpense, updateExpense, deleteExpense, setBudget } = budget
  const [month, setMonth] = useState(currentMonthKey)
  const [modal, setModal] = useState<ModalState>(null)
  const [importing, setImporting] = useState(false)

  const monthExpenses = useMemo(() => expenses.filter((e) => e.date.startsWith(month)), [expenses, month])
  const summary = useMemo(
    () => summarizeMonth(expenses, month, budgetFor(history, month)),
    [expenses, history, month]
  )

  const closeModal = () => setModal(null)
  const openNew = () => setModal({ kind: "new" })
  // Gasto nuevo: hoy si estás en el mes actual; si no, el día 1 del mes que miras
  const defaultDate = summary.isCurrent ? todayKey() : `${month}-01`

  return (
    <div className="min-h-screen bg-[#07090e] text-white">
      <AppHeader email={email} onSignOut={onSignOut} onImport={() => setImporting(true)} />

      <main className="fade-up mx-auto max-w-5xl space-y-5 px-4 pb-40 pt-5 sm:px-6 sm:pb-12 sm:pt-7">
        <MonthNav
          month={month}
          isCurrent={summary.isCurrent}
          onPrev={() => setMonth((m) => shiftMonth(m, -1))}
          onNext={() => setMonth((m) => shiftMonth(m, 1))}
          onToday={() => setMonth(currentMonthKey())}
          onAdd={openNew}
        />

        {error && (
          <div role="alert" className="flex items-start gap-2.5 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Hay un problema con los datos: {error}</span>
          </div>
        )}

        <div className="grid gap-x-8 gap-y-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:grid-rows-[auto_1fr] lg:items-start">
          <div className="lg:col-start-1 lg:row-start-1">
            {loading ? (
              <div className="h-80 animate-pulse rounded-3xl bg-white/[0.04]" aria-busy="true" />
            ) : (
              <BudgetCard key={month} summary={summary} onSetBudget={setBudget} />
            )}
          </div>
          <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <ExpenseList expenses={monthExpenses} loading={loading} onSelect={(e) => setModal({ kind: "edit", expense: e })} onAdd={openNew} />
          </div>
          <div className="lg:col-start-1 lg:row-start-2">
            <CategoryBreakdown summary={summary} />
          </div>
        </div>
      </main>

      {/* Móvil: botón centrado abajo (no tapa la columna de importes) sobre un degradado que apaga la lista */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 h-28 bg-gradient-to-t from-[#07090e] via-[#07090e]/80 to-transparent sm:hidden" />
      <div className="pointer-events-none fixed inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-40 flex justify-center sm:hidden">
        <button
          onClick={openNew}
          className="liquid-button pointer-events-auto flex h-14 items-center gap-2 rounded-full px-7 text-base font-semibold text-[#04202a]"
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} />
          Apuntar gasto
        </button>
      </div>

      {importing && (
        <ImportWizard
          budget={budget}
          viewMonth={month}
          onClose={(imported) => {
            setImporting(false)
            if (imported) setMonth(imported)
          }}
        />
      )}

      {modal && (
        <ExpenseModal
          expense={modal.kind === "edit" ? modal.expense : null}
          month={month}
          defaultDate={defaultDate}
          onSave={async (data) => (modal.kind === "edit" ? updateExpense(modal.expense.id, data) : (await addExpense(data)) !== null)}
          onDelete={modal.kind === "edit" ? () => deleteExpense(modal.expense.id) : undefined}
          onClose={closeModal}
        />
      )}
    </div>
  )
}

export default MonthDashboard

import { useMemo, useState } from "react"
import { AlertTriangle, Plus } from "lucide-react"
import type { BudgetApi } from "../hooks/useBudget"
import { currentMonthKey, lastIncomeBefore, shiftMonth, summarizeMonth, todayKey } from "../utils/month"
import type { Expense } from "../types/budget"
import { AppHeader } from "../components/budget/AppHeader"
import { MonthNav } from "../components/budget/MonthNav"
import { BentoKpis } from "../components/budget/BentoKpis"
import { MonthCharts } from "../components/budget/MonthCharts"
import { EnvelopesGrid } from "../components/budget/EnvelopesGrid"
import { ExpenseList } from "../components/budget/ExpenseList"
import { ExpenseModal } from "../components/budget/ExpenseModal"
import { ImportWizard } from "../components/budget/ImportWizard"
import { CategorySettings } from "../components/budget/CategorySettings"
import { FirstSetup } from "../components/budget/FirstSetup"

interface MonthDashboardProps {
  email: string | null
  onSignOut: () => void
  budget: BudgetApi
}

type ModalState = { kind: "new" } | { kind: "edit"; expense: Expense } | null

const MonthDashboard = ({ email, onSignOut, budget }: MonthDashboardProps) => {
  const {
    expenses,
    categories,
    fixedExpenses,
    income,
    loading,
    error,
    addExpense,
    updateExpense,
    deleteExpense,
    reassignExpenses,
    setIncome,
    saveCategories,
    saveFixedExpenses,
  } = budget
  const [month, setMonth] = useState(currentMonthKey)
  const [modal, setModal] = useState<ModalState>(null)
  const [importing, setImporting] = useState(false)
  const [settingsTab, setSettingsTab] = useState<"categories" | "fixed" | null>(null)

  const monthExpenses = useMemo(() => expenses.filter((e) => e.date.startsWith(month)), [expenses, month])
  const summary = useMemo(
    () => summarizeMonth(expenses, month, income[month] ?? null, categories, fixedExpenses),
    [expenses, income, categories, fixedExpenses, month]
  )

  const closeModal = () => setModal(null)
  const openNew = () => setModal({ kind: "new" })
  const openSettings = (tab: "categories" | "fixed" = "categories") => setSettingsTab(tab)
  const closeSettings = () => setSettingsTab(null)
  // Gasto nuevo: hoy si estás en el mes actual; si no, el día 1 del mes que miras
  const defaultDate = summary.isCurrent ? todayKey() : `${month}-01`
  const firstTime = !loading && categories.length === 0

  const header = (
    <AppHeader
      email={email}
      onSignOut={onSignOut}
      onImport={() => setImporting(true)}
      onCategories={() => openSettings("categories")}
    />
  )

  const errorBanner = error && (
    <div role="alert" className="flex items-start gap-2.5 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>Hay un problema con los datos: {error}</span>
    </div>
  )

  // Primera vez: nómina + reparto propuesto
  if (firstTime) {
    return (
      <div className="min-h-screen bg-[#07090e] text-white">
        {header}
        <main className="fade-up mx-auto max-w-5xl space-y-5 px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
          {errorBanner}
          <FirstSetup
            month={month}
            onSubmit={async (cats, amount) => (await saveCategories(cats)) && (await setIncome(month, amount))}
          />
        </main>
        {importing && (
          <ImportWizard
            budget={budget}
            viewMonth={month}
            onManageCategories={() => openSettings("categories")}
            onClose={() => setImporting(false)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#07090e] text-white">
      {header}

      <main className="fade-up mx-auto max-w-6xl space-y-6 px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pb-12 sm:pt-6">
        <MonthNav
          month={month}
          isCurrent={summary.isCurrent}
          onPrev={() => setMonth((m) => shiftMonth(m, -1))}
          onNext={() => setMonth((m) => shiftMonth(m, 1))}
          onToday={() => setMonth(currentMonthKey())}
          onAdd={openNew}
        />

        {errorBanner}

        {/* Fila 1: KPIs Bento */}
        <BentoKpis
          summary={summary}
          suggestedIncome={lastIncomeBefore(income, month)}
          onSetIncome={setIncome}
          onEditFixed={() => openSettings("fixed")}
          onEditCategories={() => openSettings("categories")}
        />

        {/* Fila 2: Gráficas de cada mes (Evolución diaria, Historial 6 meses, Reparto) */}
        <MonthCharts
          currentMonth={month}
          allExpenses={expenses}
          allIncome={income}
          categories={categories}
          fixedExpenses={fixedExpenses}
          summary={summary}
        />

        {/* Fila 3: Sobres del mes (Grid) y Lista de gastos interactiva */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-6">
            <EnvelopesGrid
              summary={summary}
              categories={categories}
              onEdit={() => openSettings("categories")}
            />
          </div>
          <div className="lg:col-span-5 lg:sticky lg:top-20">
            <ExpenseList
              expenses={monthExpenses}
              categories={categories}
              loading={loading}
              onSelect={(e) => setModal({ kind: "edit", expense: e })}
              onAdd={openNew}
            />
          </div>
        </div>
      </main>

      {/* Móvil: barra inferior opaca a todo el ancho; su altura está reservada al final de la página */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#07090e] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:hidden">
        <button
          onClick={openNew}
          className="liquid-button flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold text-[#04202a]"
        >
          <Plus className="h-5 w-5" strokeWidth={2.5} />
          Apuntar gasto
        </button>
      </div>

      {importing && (
        <ImportWizard
          budget={budget}
          viewMonth={month}
          onManageCategories={() => openSettings("categories")}
          onClose={(imported) => {
            setImporting(false)
            if (imported) setMonth(imported)
          }}
        />
      )}

      {settingsTab && (
        <CategorySettings
          categories={categories}
          expenses={expenses}
          fixedExpenses={fixedExpenses}
          initialTab={settingsTab}
          onSave={saveCategories}
          onSaveFixedExpenses={saveFixedExpenses}
          onReassign={reassignExpenses}
          onClose={closeSettings}
        />
      )}

      {modal && (
        <ExpenseModal
          expense={modal.kind === "edit" ? modal.expense : null}
          month={month}
          categories={categories}
          onManageCategories={() => openSettings("categories")}
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

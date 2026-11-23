import { Suspense, lazy, useEffect, useMemo, useState } from "react"
import { AlertTriangle, ArrowRight, Plus, X } from "lucide-react"
import type { BudgetApi } from "../hooks/useBudget"
import { currentMonthKey, lastIncomeBefore, shiftMonth, summarizeMonth, todayKey } from "../utils/month"
import type { Expense } from "../types/budget"
import { DEMO_EMAIL } from "../constants/demo"
import { authorshipLabel } from "../utils/members"
import { applyTheme, rememberTheme, rememberedTheme } from "../constants/themes"
import { AppHeader } from "../components/budget/AppHeader"
import { MonthNav } from "../components/budget/MonthNav"
import { BentoKpis } from "../components/budget/BentoKpis"
import { MonthCharts } from "../components/budget/MonthCharts"
import { EnvelopesGrid } from "../components/budget/EnvelopesGrid"
import { ExpenseList } from "../components/budget/ExpenseList"
import { MonthCompare } from "../components/budget/MonthCompare"

const ExpenseModal = lazy(() =>
  import("../components/budget/ExpenseModal").then((m) => ({ default: m.ExpenseModal }))
)
const CategorySettings = lazy(() =>
  import("../components/budget/CategorySettings").then((m) => ({ default: m.CategorySettings }))
)
const ThemeModal = lazy(() =>
  import("../components/budget/ThemeModal").then((m) => ({ default: m.ThemeModal }))
)
const FirstSetup = lazy(() =>
  import("../components/budget/FirstSetup").then((m) => ({ default: m.FirstSetup }))
)

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
  const [settingsTab, setSettingsTab] = useState<"categories" | "fixed" | null>(null)
  const [themeOpen, setThemeOpen] = useState(false)

  // Tema de quien ha iniciado sesión. Mientras cargan los datos, el último que usó en este dispositivo
  const uid = budget.currentUid
  const myTheme = uid ? (budget.themes[uid] ?? null) : null
  useEffect(() => {
    if (!uid) return
    applyTheme(myTheme ?? (loading ? rememberedTheme(uid) : null))
    if (myTheme) rememberTheme(uid, myTheme)
  }, [uid, myTheme, loading])
  // Al salir (login) vuelve el tema por defecto
  useEffect(() => () => applyTheme(null), [])

  const monthExpenses = useMemo(() => expenses.filter((e) => e.date.startsWith(month)), [expenses, month])
  const summary = useMemo(
    () => summarizeMonth(expenses, month, income[month] ?? null, categories, fixedExpenses, new Date(), budget.carry),
    [expenses, income, categories, fixedExpenses, month, budget.carry]
  )

  // Mes en curso: si en el anterior sobró dinero en algún sobre y aún no se ha pasado nada, se avisa (se puede cerrar)
  const prevMonth = shiftMonth(month, -1)
  const dismissKey = `fluxi:carry-hint:${month}`
  const [hintClosed, setHintClosed] = useState(() => {
    try { return localStorage.getItem(dismissKey) === "1" } catch { return false }
  })
  const leftovers = useMemo(() => {
    if (!summary.isCurrent || income[prevMonth] === undefined || Object.keys(budget.carry[month] ?? {}).length) return 0
    const prev = summarizeMonth(expenses, prevMonth, income[prevMonth], categories, fixedExpenses, new Date(), budget.carry)
    return prev.envelopes.filter((e) => e.remaining > 0.005).length
  }, [summary.isCurrent, income, prevMonth, month, budget.carry, expenses, categories, fixedExpenses])
  const closeHint = () => {
    setHintClosed(true)
    try { localStorage.setItem(dismissKey, "1") } catch { /* sin almacenamiento */ }
  }

  // Acceso directo del icono de la app («Nuevo gasto», ver manifest): abre el formulario al entrar
  useEffect(() => {
    const url = new URL(window.location.href)
    if (!url.searchParams.has("nuevo")) return
    url.searchParams.delete("nuevo")
    window.history.replaceState(null, "", url.pathname + url.search + url.hash)
    setModal({ kind: "new" })
  }, [])

  // Gasto que se edita, el actual del listado (llega actualizado), no la copia de cuando se abrió
  const editingExpense = modal?.kind === "edit" ? (expenses.find((x) => x.id === modal.expense.id) ?? modal.expense) : null
  const closeModal = () => setModal(null)
  const openNew = () => setModal({ kind: "new" })
  const openSettings = (tab: "categories" | "fixed" = "categories") => setSettingsTab(tab)
  const closeSettings = () => setSettingsTab(null)
  // Gasto nuevo: hoy si estás en el mes actual; si no, el día 1 del mes que miras
  const defaultDate = summary.isCurrent ? todayKey() : `${month}-01`
  // La bienvenida crea un presupuesto: solo si el servidor ha confirmado cuál es (nunca por un enlace sin resolver)
  const firstTime = !loading && budget.budgetConfirmed && categories.length === 0

  const header = (
    <AppHeader
      email={email}
      onSignOut={onSignOut}
      onCategories={() => openSettings("categories")}
      onTheme={() => setThemeOpen(true)}
      push={email !== DEMO_EMAIL && uid && budget.budgetUid ? { uid, budget: budget.budgetUid } : undefined}
    />
  )

  const themeModal = themeOpen && (
    <Suspense fallback={null}>
      <ThemeModal current={myTheme} onSave={budget.saveTheme} onClose={() => setThemeOpen(false)} />
    </Suspense>
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
      <div className="min-h-screen bg-ink text-white">
        {header}
        <main className="fade-up mx-auto max-w-5xl space-y-5 px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
          {errorBanner}
          <Suspense fallback={null}>
            <FirstSetup
              month={month}
              onSubmit={async (cats, amount) => (await saveCategories(cats)) && (await setIncome(month, amount))}
            />
          </Suspense>
        </main>
        {themeModal}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ink text-white">
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

        {email === DEMO_EMAIL && (
          <p className="rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.06] px-4 py-2.5 text-sm text-cyan-100">
            Modo demo: puedes probarlo todo, pero los cambios no se guardan y al recargar vuelve a empezar.
          </p>
        )}

        {leftovers > 0 && !hintClosed && (
          <div className="flex items-center gap-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.06] px-4 py-2.5 text-sm text-cyan-100">
            <span className="min-w-0 flex-1">
              El mes pasado te sobró dinero en {leftovers === 1 ? "1 sobre" : `${leftovers} sobres`}. Puedes pasarlo a este mes.
            </span>
            <button type="button" onClick={() => setMonth(prevMonth)} className="flex shrink-0 items-center gap-1 font-semibold text-cyan-200 hover:text-white">
              Ver <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={closeHint} aria-label="Cerrar aviso" className="shrink-0 rounded-lg p-1 text-cyan-100/60 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Fila 1: KPIs Bento */}
        <BentoKpis
          summary={summary}
          suggestedIncome={lastIncomeBefore(income, month)}
          onSetIncome={setIncome}
          onEditFixed={() => openSettings("fixed")}
          wallet={budget.wallet}
          onSaveWallet={budget.saveWallet}
          goals={budget.goals}
          onSaveGoals={budget.saveGoals}
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

        <MonthCompare expenses={expenses} month={month} categories={categories} />

        {/* Fila 3: Sobres del mes (Grid) y Lista de gastos interactiva */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-6">
            <EnvelopesGrid
              summary={summary}
              categories={categories}
              onEdit={() => openSettings("categories")}
              onCarry={budget.saveCarry}
            />
          </div>
          <div className="lg:col-span-5 lg:sticky lg:top-20">
            <ExpenseList
              expenses={monthExpenses}
              categories={categories}
              loading={loading}
              onSelect={(e) => setModal({ kind: "edit", expense: e })}
              onAdd={openNew}
              members={budget.members}
              themes={budget.themes}
            />
          </div>
        </div>
      </main>

      {/* Móvil: barra inferior opaca a todo el ancho; su altura está reservada al final de la página */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:hidden">
        <button
          onClick={openNew}
          className="liquid-button flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold text-cyan-950"
        >
          <Plus className="h-5 w-5" strokeWidth={2.5} />
          Apuntar gasto
        </button>
      </div>

      {themeModal}

      {settingsTab && (
        <Suspense fallback={null}>
          <CategorySettings
            categories={categories}
            expenses={expenses}
            fixedExpenses={fixedExpenses}
            initialTab={settingsTab}
            onSave={saveCategories}
            onSaveFixedExpenses={saveFixedExpenses}
            onReassign={reassignExpenses}
            // «Borrar todos mis datos» solo para el dueño del presupuesto
            onResetAll={budget.isOwner ? budget.resetAll : undefined}
            onClose={closeSettings}
          />
        </Suspense>
      )}

      {modal && (
        <Suspense fallback={null}>
          <ExpenseModal
            expense={editingExpense}
            authorship={editingExpense ? authorshipLabel(editingExpense, budget.members) : null}
            history={expenses}
            month={month}
            categories={categories}
            onManageCategories={() => openSettings("categories")}
            defaultDate={defaultDate}
            onSave={async (data, receipt) => {
              if (modal.kind === "edit") {
                const ok = await updateExpense(modal.expense.id, data)
                return ok && receipt !== undefined ? budget.saveReceipt(modal.expense.id, receipt) : ok
              }
              const id = await addExpense(data)
              if (id === null) return false
              if (receipt) await budget.saveReceipt(id, receipt)
              return true
            }}
            loadReceipt={modal.kind === "edit" ? () => budget.loadReceipt(modal.expense.id) : undefined}
            onDelete={modal.kind === "edit" ? () => deleteExpense(modal.expense.id) : undefined}
            onSaveRefunds={
              modal.kind === "edit"
                ? (r) => budget.saveRefunds(modal.expense, r)
                : undefined
            }
            onClose={closeModal}
          />
        </Suspense>
      )}
    </div>
  )
}

export default MonthDashboard

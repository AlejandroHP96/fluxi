import { useState, useMemo } from "react"
import { useAuth } from "./hooks/useAuth"
import { useTransactions } from "./hooks/useTransactions"
import { Sidebar } from "./components/layout/Sidebar"
import { Topbar } from "./components/layout/Topbar"
import { DashboardOverview } from "./components/dashboard/DashboardOverview"
import Transactions from "./pages/Transactions"
import Analytics from "./pages/Analytics"
import AuthPage from "./pages/AuthPage"
import AddTransactionModal from "./components/transactions/AddTransactionModal"
import { ImportStatementModal } from "./components/transactions/ImportStatementModal"
import { getAvailableMonths } from "./utils/dateFilters"
import { LayoutDashboard, ReceiptText, BarChart3 } from "lucide-react"

const App = () => {
  const { user, loading: authLoading, signIn, signUp, signOut } = useAuth()
  const {
    transactions,
    addTransaction,
    addBatchTransactions,
    deleteTransaction,
    deleteAllTransactions,
    totals,
  } = useTransactions(user?.uid)

  const [activeTab, setActiveTab] = useState("overview")
  const [showModal, setShowModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const monthOptions = useMemo(() => getAvailableMonths(transactions), [transactions])
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return monthOptions[0]?.key || "all"
  })

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#07090e] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold animate-pulse">
            F
          </div>
          <p className="text-white/40 text-xs">Cargando Fluxi...</p>
        </div>
      </div>
    )
  }

  if (!user) return <AuthPage onSignIn={signIn} onSignUp={signUp} />

  return (
    <div className="flex min-h-screen bg-[#07090e] text-white">
      {/* 1. Sidebar Fija Lateral (Desktop) como en el video */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onAdd={() => setShowModal(true)}
        onImport={() => setShowImportModal(true)}
        onSignOut={signOut}
        userEmail={user.email}
        txCount={transactions.length}
      />

      {/* 2. Área de Contenido Principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar con buscador ⌘K, selector de mes y perfil */}
        <Topbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedMonth={selectedMonth}
          onMonthChange={setSelectedMonth}
          monthOptions={monthOptions}
          onAdd={() => setShowModal(true)}
          onImport={() => setShowImportModal(true)}
          userEmail={user.email}
        />

        {/* Barra de pestañas móvil en parte superior */}
        <div className="lg:hidden flex items-center justify-around border-b border-white/5 bg-white/[0.02] px-2 py-2">
          {[
            { id: "overview", label: "Dashboard", icon: LayoutDashboard },
            { id: "transactions", label: "Transacciones", icon: ReceiptText },
            { id: "analytics", label: "Analítica", icon: BarChart3 },
          ].map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
                    : "text-white/40 hover:text-white"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* Contenedor del contenido */}
        <main className="flex-1 p-4 sm:p-7 max-w-7xl w-full mx-auto overflow-y-auto">
          {activeTab === "overview" && (
            <DashboardOverview
              transactions={transactions}
              totals={totals}
              selectedMonth={selectedMonth}
              searchQuery={searchQuery}
              onViewAllTransactions={() => setActiveTab("transactions")}
            />
          )}

          {activeTab === "transactions" && (
            <Transactions
              transactions={transactions}
              onDelete={deleteTransaction}
              onDeleteAll={deleteAllTransactions}
            />
          )}

          {activeTab === "analytics" && (
            <Analytics
              transactions={transactions}
              totals={totals}
            />
          )}
        </main>
      </div>

      {/* Modales */}
      {showModal && (
        <AddTransactionModal
          onClose={() => setShowModal(false)}
          onAdd={addTransaction}
        />
      )}

      {showImportModal && (
        <ImportStatementModal
          onClose={() => setShowImportModal(false)}
          onImport={addBatchTransactions}
        />
      )}
    </div>
  )
}

export default App

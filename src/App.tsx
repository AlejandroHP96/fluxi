import { useState } from "react"
import { useAuth } from "./hooks/useAuth"
import { useTransactions } from "./hooks/useTransactions"
import Header from "./components/layout/Header"
import AddTransactionModal from "./components/transactions/AddTransactionModal"
import { ImportStatementModal } from "./components/transactions/ImportStatementModal"
import Overview from "./pages/Overview"
import Transactions from "./pages/Transactions"
import Analytics from "./pages/Analytics"
import AuthPage from "./pages/AuthPage"
import { ADMIN_EMAIL } from "./constants/demo"
import { resetDemoData } from "./lib/demoData"

const App = () => {
  const { user, loading: authLoading, signIn, signUp, signOut } = useAuth()
  const { transactions, loading: txLoading, addTransaction, addBatchTransactions, deleteTransaction, totals } = useTransactions(user?.uid)
  const [activeTab, setActiveTab] = useState("overview")
  const [showModal, setShowModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)

  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <p className="text-muted text-sm">Cargando...</p>
      </div>
    )
  }

  if (!user) return <AuthPage onSignIn={signIn} onSignUp={signUp} />

  const isAdmin = user.email === ADMIN_EMAIL
  const handleReset = async () => {
    if (!window.confirm("¿Reiniciar los datos de la cuenta de demostración?")) return
    try {
      await resetDemoData()
    } catch (e) {
      window.alert("No se pudo reiniciar: " + (e as Error).message)
    }
  }

  const pages: Record<string, JSX.Element> = {
    overview:     <Overview     transactions={transactions} totals={totals} />,
    transactions: <Transactions transactions={transactions} onDelete={deleteTransaction} />,
    analytics:    <Analytics    transactions={transactions} totals={totals} />,
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onAdd={() => setShowModal(true)}
        onImport={() => setShowImportModal(true)}
        onSignOut={signOut}
        userEmail={user.email}
        onReset={isAdmin ? handleReset : undefined}
      />
      <main className="max-w-5xl mx-auto px-4 py-6 sm:px-8 sm:py-8">
        {txLoading
          ? <p className="text-muted text-sm">Cargando transacciones...</p>
          : pages[activeTab]
        }
      </main>
      {showModal && <AddTransactionModal onClose={() => setShowModal(false)} onAdd={addTransaction} />}
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

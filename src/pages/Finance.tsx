import { AccountsSection } from "../components/finance/AccountsSection"
import { SavingsSection } from "../components/finance/SavingsSection"
import { BudgetsSection } from "../components/finance/BudgetsSection"
import { GoalsSection } from "../components/finance/GoalsSection"
import { CategoriesSection } from "../components/finance/CategoriesSection"
import { TransferSettings } from "../components/finance/TransferSettings"
import type { FinanceApi } from "../hooks/useFinance"
import type { Transaction } from "../types"

interface FinanceProps {
  transactions: Transaction[]
  finance: FinanceApi
  onImport?: () => void
  onUpdateBatch: (updates: Array<{ id: string; description: string; category: string }>) => Promise<number>
}

const Finance = ({ transactions, finance, onImport, onUpdateBatch }: FinanceProps) => {
  if (finance.loading) {
    return <p className="text-white/40 text-xs py-20 text-center">Cargando tus finanzas...</p>
  }

  return (
    <div className="space-y-6 fade-up">
      {finance.error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
          Algo ha fallado con tus datos de Finanzas: {finance.error}
        </div>
      )}
      <AccountsSection finance={finance} onImport={onImport} />
      <SavingsSection transfers={finance.transfers} />
      <BudgetsSection transactions={transactions} finance={finance} />
      <GoalsSection finance={finance} />
      <CategoriesSection transactions={transactions} finance={finance} onUpdateBatch={onUpdateBatch} />
      <TransferSettings transactions={transactions} finance={finance} />
    </div>
  )
}

export default Finance

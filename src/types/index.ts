export type TransactionType = "income" | "expense"

export interface Transaction {
  id: string
  description: string
  amount: number
  category: string
  type: TransactionType
  date: string
  userId: string
  createdAt?: unknown
}

export interface NewTransaction {
  description: string
  amount: number
  category: string
  type: TransactionType
  date: string
}

export interface Totals {
  income: number
  expense: number
  balance: number
  savingsRate: string
}

export interface MonthlyData {
  label: string
  income: number
  expense: number
  savings: number
}

export interface CategoryData {
  name: string
  value: number
}

export interface AuthResult {
  error: Error | null
}

// ── Finanzas ───────────────────────────────────────────────────────────────

// Traspasos: no son gasto ni ingreso, no salen en Transacciones (colección "transfers")
//  - savings_in / savings_out: aportación / retirada en la cuenta de Ahorros (fila "Depósito" del CSV)
//  - interest: intereses netos de Ahorros
//  - own_in / own_out: transferencias desde / hacia tus otras cuentas (nombres en FinanceSettings)
export type TransferKind = "savings_in" | "savings_out" | "interest" | "own_in" | "own_out"

export interface Transfer {
  id: string
  userId: string
  date: string // "YYYY-MM-DD HH:mm"
  amount: number // con signo, visto desde la cuenta (Ahorros para savings_*/interest, Conjunta para own_*)
  kind: TransferKind
  description: string
}

export type NewTransfer = Omit<Transfer, "id" | "userId">

// Cuentas: las de Revolut se actualizan solas al importar el CSV; las manuales se editan a mano
export type AccountKind = "revolut_current" | "revolut_savings" | "manual"

export interface Account {
  id: string
  userId: string
  name: string
  kind: AccountKind
  balance: number
  balanceDate: string // "YYYY-MM-DD HH:mm" del último movimiento que fijó el saldo (o del último cambio manual)
}

export interface Goal {
  id: string
  userId: string
  name: string
  target: number
  deadline: string | null // "YYYY-MM-DD"
  accountId: string // el progreso es el saldo de esta cuenta
}

export type NewGoal = Omit<Goal, "id" | "userId">

// Documento finance/{uid}
export interface FinanceSettings {
  budgets: Record<string, number> // categoría -> límite mensual en €
  ownTransferNames: string[] // titulares cuyas transferencias son traspasos ("ALEJANDRO HERRERA PESTANA")
  categoryRules: Record<string, string> // conceptKey(descripción) -> categoría (ver src/utils/categorize.ts)
}

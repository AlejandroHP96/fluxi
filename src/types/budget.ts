// Fluxi: la nómina de cada mes se reparte en categorías propias con un % (sobres) y los gastos se apuntan
// a una de ellas. Las categorías de ahorro se apartan y no cuentan como dinero para gastar.

export interface Expense {
  id: string
  userId: string
  amount: number // positivo, en €
  concept: string
  category: string // id de BudgetCategory (los gastos antiguos pueden traer el nombre: se resuelve por nombre)
  date: string // "YYYY-MM-DD"
  refunds?: Refund[] // devoluciones de este gasto (compras en conjunto que te devuelven)
  createdBy?: string // uid de quien lo apuntó (los antiguos no lo tienen: son del dueño, userId)
  updatedBy?: string // uid de quien lo editó por última vez
  receipt?: boolean // tiene foto del ticket (en receipts/{id})
}

// Dinero que te devuelven de un gasto. Si vuelve al mes, resta de lo gastado en su categoría;
// si va a la cartera de ahorros, el gasto cuenta entero y el dinero entra en la cartera
export interface Refund {
  id: string
  amount: number // positivo
  note: string // quién o por qué («Ana», «Bizum cena»)
  date: string // "YYYY-MM-DD"
  toWallet: boolean
}

// Cartera de ahorros aparte de los sobres: saldo inicial puesto a mano y movimientos (+ entra, − sale)
export interface WalletMove {
  id: string
  amount: number // con signo
  note: string
  date: string // "YYYY-MM-DD"
  refundId?: string // si viene de la devolución de un gasto (se gestiona desde el gasto)
}

export interface Wallet {
  initial: number
  movements: WalletMove[]
}

export const walletBalance = (w: Wallet | null | undefined) =>
  w ? Math.round((Number(w.initial) + w.movements.reduce((a, m) => a + Number(m.amount), 0)) * 100) / 100 : 0

// Lo que de verdad te ha costado un gasto: su importe menos lo devuelto al mes (no lo que fue a la cartera)
export const netAmount = (e: Pick<Expense, "amount" | "refunds">) =>
  Math.max(0, Number(e.amount) - (e.refunds ?? []).reduce((a, r) => a + (r.toWallet ? 0 : Number(r.amount)), 0))

export type NewExpense = Pick<Expense, "amount" | "concept" | "category" | "date">

// Meta de ahorro (budgets/{uid}.goals): una parte del saldo de la cartera apartada para algo concreto
export interface SavingsGoal {
  id: string
  name: string
  target: number // € que se quieren juntar
  saved: number // € de la cartera apartados ya para esta meta
  month?: string // "YYYY-MM": para cuándo (opcional)
}

// Sobrante pasado de un mes al siguiente (budgets/{uid}.carry): mes que lo recibe -> sobre -> €
export type Carry = Record<string, Record<string, number>>

export interface BudgetCategory {
  id: string
  name: string
  pct: number // % del resto (nómina − gastos fijos − sobres en €), 0-100. En los sobres en € no se usa (0)
  amount?: number // sobre de importe fijo en € al mes: si está, el sobre es en € y se reparte antes que los %
  savings: boolean // ahorro: su parte se aparta y no se gasta
}

export interface FixedExpense {
  id: string
  name: string
  amount: number // en € al mes
}

// Documento budgets/{uid}: un único reparto para todos los meses (cambiar los % recalcula también los pasados)
export interface BudgetSettings {
  categories: BudgetCategory[]
  income: Record<string, number> // "YYYY-MM" -> nómina de ese mes en €
  fixedExpenses?: FixedExpense[] // gastos fijos mensuales
}

export type EnvelopeStatus = "ok" | "casi" | "pasado"

export interface EnvelopeSummary {
  category: BudgetCategory
  allocated: number // en €: su importe; en %: resto * pct / 100 (0 si no hay nómina)
  spent: number
  remaining: number // puede ser negativo
  carriedIn: number // € que vienen del mes anterior (ya sumados en allocated)
  carriedOut: number // € que se han pasado al mes siguiente (informativo: no cambia lo de este mes)
  pctSpent: number // gastado / asignado * 100 (0 si no hay asignado)
  status: EnvelopeStatus // casi = 90 % o más
}

export type MonthStatus = "sin-nomina" | "bien" | "ritmo-alto" | "pasado"

export interface MonthSummary {
  month: string // "YYYY-MM"
  income: number | null // nómina del mes (null si aún no se ha apuntado)
  fixedExpenses: FixedExpense[] // gastos fijos mensuales
  totalFixed: number // suma de los gastos fijos
  netIncome: number // nómina - gastos fijos (base para sobres, mín 0)
  totalAmount: number // suma de los sobres en €
  pctBase: number // resto que se reparte en %: nómina − fijos − sobres en € (mín 0)
  amountOver: number // € que piden los sobres en € por encima de lo disponible (0 si caben)
  totalPct: number // suma de los % de las categorías en %
  unassignedPct: number // 100 - totalPct (0 si se pasa de 100)
  unassigned: number // € sin asignar (dinero libre): la parte del resto que no cubren los %
  saved: number // € apartados en categorías de ahorro
  spendable: number // nómina - fijos - ahorro (lo que hay para gastar, incluido lo sin asignar)
  spent: number // todos los gastos del mes apuntados en sobres
  available: number // spendable - spent (negativo si te pasas)
  pctSpent: number // gastado / spendable * 100
  pctElapsed: number // % del mes transcurrido (100 en meses pasados, 0 en futuros)
  status: MonthStatus
  daysInMonth: number
  daysLeft: number // contando hoy (0 en meses pasados)
  dailyAllowance: number | null // lo que puedes gastar al día hasta fin de mes (mes actual con nómina)
  isCurrent: boolean
  isPast: boolean
  envelopes: EnvelopeSummary[] // categorías de gasto, en el orden configurado
  savings: EnvelopeSummary[] // categorías de ahorro (gastado = lo apuntado en ellas, normalmente 0)
  uncategorized: number // € gastados en categorías que ya no existen
  count: number
}

// Miembros del presupuesto compartido (budgets/{uid}.members): uid -> nombre. Lo escribe solo el script de enlace
export type Members = Record<string, string>

// Tema de color de cada persona del presupuesto (budgets/{uid}.themes): uid -> id de tema (src/constants/themes.ts).
// Cada uno solo cambia el suyo; el resto lo lee para colorear su burbuja en la lista de gastos
export type Themes = Record<string, string>

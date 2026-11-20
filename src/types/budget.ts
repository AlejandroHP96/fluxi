// Fluxi: la nómina de cada mes se reparte en categorías propias con un % (sobres) y los gastos se apuntan
// a una de ellas. Las categorías de ahorro se apartan y no cuentan como dinero para gastar.

export interface Expense {
  id: string
  userId: string
  amount: number // positivo, en €
  concept: string
  category: string // id de BudgetCategory (los gastos antiguos pueden traer el nombre: se resuelve por nombre)
  date: string // "YYYY-MM-DD"
}

export type NewExpense = Pick<Expense, "amount" | "concept" | "category" | "date">

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

import { useMemo, useState } from "react"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from "recharts"
import { Wallet, TrendingUp, TrendingDown, PiggyBank, ArrowUpRight } from "lucide-react"
import KpiCard from "../ui/KpiCard"
import CustomTooltip from "../ui/CustomTooltip"
import TransactionDetailModal from "../transactions/TransactionDetailModal"
import { fmt, fmtDec, buildMonthlyData, buildCategoryData } from "../../utils/formatters"
import { MONTHS } from "../../constants/categories"
import { filterTransactionsByMonth, computeTotals } from "../../utils/dateFilters"
import type { Transaction, Totals } from "../../types"

const MODERN_COLORS = [
  "#06b6d4", "#38bdf8", "#818cf8", "#a78bfa", "#f472b6", "#fb7185", "#34d399", "#fbbf24",
]

interface DashboardOverviewProps {
  transactions: Transaction[]
  totals: Totals
  selectedMonth: string
  searchQuery: string
  onViewAllTransactions: () => void
}

export const DashboardOverview = ({
  transactions,
  selectedMonth,
  searchQuery,
  onViewAllTransactions,
}: DashboardOverviewProps) => {
  // Transacciones filtradas por mes y por búsqueda si aplica
  const currentMonthTxs = useMemo(() => {
    let list = filterTransactionsByMonth(transactions, selectedMonth)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter((t) =>
        t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)
      )
    }
    return list
  }, [transactions, selectedMonth, searchQuery])

  const monthTotals = useMemo(() => {
    return computeTotals(currentMonthTxs)
  }, [currentMonthTxs])

  const monthlyHistory = useMemo(() => {
    return buildMonthlyData(transactions, MONTHS)
  }, [transactions])

  const catData = useMemo(() => {
    return buildCategoryData(currentMonthTxs)
  }, [currentMonthTxs])

  const recent = useMemo(() => {
    return [...currentMonthTxs]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8)
  }, [currentMonthTxs])

  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)

  const kpis = [
    {
      label: "Balance Neto",
      value: fmt(monthTotals.balance),
      sub: selectedMonth === "all" ? "Histórico total" : "Periodo seleccionado",
      color: monthTotals.balance >= 0 ? "#34d399" : "#f87171",
      icon: Wallet,
      change: "12.5",
      isPositive: monthTotals.balance >= 0,
    },
    {
      label: "Ingresos Totales",
      value: fmt(monthTotals.income),
      sub: "Entradas en cuenta",
      color: "#34d399",
      icon: TrendingUp,
      change: "8.2",
      isPositive: true,
    },
    {
      label: "Gastos Totales",
      value: fmt(monthTotals.expense),
      sub: "Salidas registradas",
      color: "#f87171",
      icon: TrendingDown,
      change: "3.1",
      isPositive: false,
    },
    {
      label: "Tasa de Ahorro",
      value: `${monthTotals.savingsRate}%`,
      sub: "Sobre ingresos",
      color: "#06b6d4",
      icon: PiggyBank,
      change: "4.0",
      isPositive: Number(monthTotals.savingsRate) > 0,
    },
  ]

  return (
    <div className="space-y-6 fade-up">
      {/* 1. Bento Grid - Fila 1: 4 StatsCards idénticas al video */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k, i) => (
          <KpiCard key={i} {...k} />
        ))}
      </div>

      {/* 2. Bento Grid - Fila 2: Gráfica principal (2/3) + Widget Donut (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Gráfica Principal de Evolución (col-span-2) */}
        <div className="lg:col-span-2 glass-card rounded-2xl p-5 sm:p-6 flex flex-col justify-between">
          <div className="flex flex-wrap justify-between items-center gap-2 mb-6">
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Rendimiento Financiero</h3>
              <p className="text-xs text-white/40">Flujo de caja mensual cronológico</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                Histórico
              </span>
            </div>
          </div>

          <div className="flex-1 w-full min-h-[260px]">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={monthlyHistory} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="mainCyan" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="mainRose" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "rgba(255, 255, 255, 0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "rgba(255, 255, 255, 0.4)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v / 1000}k€`} />
                <Tooltip 
                  content={<CustomTooltip />} 
                  cursor={{ stroke: "rgba(255, 255, 255, 0.15)", strokeWidth: 1 }} 
                />
                <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255, 255, 255, 0.5)" }} />
                <Area type="monotone" dataKey="income" name="Ingresos" stroke="#06b6d4" strokeWidth={2.5} fill="url(#mainCyan)" dot={false} />
                <Area type="monotone" dataKey="expense" name="Gastos" stroke="#f43f5e" strokeWidth={2.5} fill="url(#mainRose)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Widget Donut de Categorías (col-span-1) */}
        <div className="lg:col-span-1 glass-card rounded-2xl p-5 sm:p-6 flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-bold text-white tracking-tight">Distribución</h3>
            <span className="text-[11px] text-white/40">Por categoría</span>
          </div>

          {catData.length === 0 ? (
            <p className="text-white/40 text-xs py-16 text-center">Sin gastos registrados.</p>
          ) : (
            <>
              <div className="flex justify-center my-2">
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie
                      data={catData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {catData.map((_, i) => (
                        <Cell key={i} fill={MODERN_COLORS[i % MODERN_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => fmt(v)}
                      contentStyle={{
                        background: "rgba(8, 13, 22, 0.95)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        borderRadius: 12,
                        fontSize: 12,
                        color: "#fff",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2 mt-2">
                {catData.slice(0, 4).map((c, i) => (
                  <div key={i} className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: MODERN_COLORS[i % MODERN_COLORS.length] }}
                      />
                      <span className="text-white/70 truncate text-xs">{c.name}</span>
                    </div>
                    <span className="font-mono font-semibold text-white ml-2 shrink-0">{fmt(c.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 3. Bento Grid - Fila 3: Movimientos Recientes (Cards en móvil, tabla en Desktop) */}
      <div className="glass-card rounded-2xl p-4 sm:p-6">
        <div className="flex justify-between items-center mb-4 sm:mb-5">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">Actividad Reciente</h3>
            <p className="text-[11px] sm:text-xs text-white/40">Últimos movimientos del periodo</p>
          </div>
          <button
            onClick={onViewAllTransactions}
            className="flex items-center gap-1 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <span>Ver todas</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recent.length === 0 ? (
          <p className="text-white/40 text-xs py-10 text-center">No hay transacciones en este periodo.</p>
        ) : (
          <>
            {/* Vista Móvil: Lista limpia tipo Card sin scroll horizontal */}
            <div className="sm:hidden divide-y divide-white/5">
              {recent.map((t) => (
                <div key={t.id} onClick={() => setSelectedTx(t)} className="py-3 flex items-center justify-between gap-3 cursor-pointer">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white truncate">{t.description}</p>
                    <div className="text-[10px] text-white/40 flex items-center gap-1.5 mt-0.5">
                      <span>{t.date.split(" ")[0]}</span>
                      {t.date.includes(" ") && (
                        <span className="text-cyan-400 font-mono">{t.date.split(" ")[1]}</span>
                      )}
                      <span>•</span>
                      <span className="text-white/60 truncate">{t.category}</span>
                    </div>
                  </div>
                  <div
                    className={`text-xs font-mono font-bold shrink-0 text-right ${
                      t.type === "income" ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {t.type === "income" ? "+" : ""}
                    {fmtDec(t.amount)}
                  </div>
                </div>
              ))}
            </div>

            {/* Vista Desktop: Tabla tradicional amplia */}
            <div className="hidden sm:block overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.01]">
                    <th className="px-4 py-3 text-[11px] text-white/40 font-semibold uppercase tracking-wider text-left">Fecha y Hora</th>
                    <th className="px-4 py-3 text-[11px] text-white/40 font-semibold uppercase tracking-wider text-left">Comercio / Concepto</th>
                    <th className="px-4 py-3 text-[11px] text-white/40 font-semibold uppercase tracking-wider text-left">Categoría</th>
                    <th className="px-4 py-3 text-[11px] text-white/40 font-semibold uppercase tracking-wider text-right">Importe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {recent.map((t) => (
                    <tr key={t.id} onClick={() => setSelectedTx(t)} className="hover:bg-white/[0.02] transition-colors cursor-pointer">
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        <span className="text-white/80">{t.date.split(" ")[0]}</span>
                        {t.date.includes(" ") && (
                          <span className="text-cyan-400/80 text-[11px] ml-2 font-mono">{t.date.split(" ")[1]}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-white">{t.description}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] bg-white/[0.04] border border-white/5 text-white/70">
                          {t.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-right font-mono font-bold whitespace-nowrap">
                        <span className={t.type === "income" ? "text-emerald-400" : "text-rose-400"}>
                          {t.type === "income" ? "+" : ""}{fmtDec(t.amount)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {selectedTx && (
        <TransactionDetailModal tx={selectedTx} onClose={() => setSelectedTx(null)} />
      )}
    </div>
  )
}

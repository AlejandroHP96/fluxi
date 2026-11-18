import { useState, useMemo } from "react"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from "recharts"
import { Wallet, TrendingUp, TrendingDown, PiggyBank } from "lucide-react"
import KpiCard from "../components/ui/KpiCard"
import CustomTooltip from "../components/ui/CustomTooltip"
import { MonthSelector } from "../components/ui/MonthSelector"
import { fmt, buildMonthlyData, buildCategoryData } from "../utils/formatters"
import { MONTHS } from "../constants/categories"
import { getAvailableMonths, filterTransactionsByMonth, computeTotals } from "../utils/dateFilters"
import type { Transaction, Totals } from "../types"

// Paleta moderna de categorías estilo Glassmorphism
const MODERN_COLORS = [
  "#06b6d4", // Cyan
  "#38bdf8", // Sky
  "#818cf8", // Indigo
  "#a78bfa", // Purple
  "#f472b6", // Pink
  "#fb7185", // Rose
  "#34d399", // Emerald
  "#fbbf24", // Amber
]

interface OverviewProps {
  transactions: Transaction[]
  totals: Totals
}

const Overview = ({ transactions }: OverviewProps) => {
  const monthOptions = useMemo(() => getAvailableMonths(transactions), [transactions])

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return monthOptions[0]?.key || "all"
  })

  const currentMonthTxs = useMemo(() => {
    return filterTransactionsByMonth(transactions, selectedMonth)
  }, [transactions, selectedMonth])

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
      .slice(0, 6)
  }, [currentMonthTxs])

  const selectedMonthLabel = useMemo(() => {
    if (selectedMonth === "all") return "Histórico completo"
    return monthOptions.find((m) => m.key === selectedMonth)?.label || selectedMonth
  }, [selectedMonth, monthOptions])

  const kpis = [
    {
      label: "Balance neto",
      value: fmt(monthTotals.balance),
      sub: selectedMonthLabel,
      color: monthTotals.balance >= 0 ? "#34d399" : "#f87171",
      icon: Wallet,
    },
    {
      label: "Ingresos",
      value: fmt(monthTotals.income),
      sub: selectedMonthLabel,
      color: "#34d399",
      icon: TrendingUp,
    },
    {
      label: "Gastos",
      value: fmt(monthTotals.expense),
      sub: selectedMonthLabel,
      color: "#f87171",
      icon: TrendingDown,
    },
    {
      label: "Tasa de ahorro",
      value: `${monthTotals.savingsRate}%`,
      sub: "Sobre ingresos",
      color: "#06b6d4",
      icon: PiggyBank,
    },
  ]

  return (
    <div className="fade-up space-y-6">
      {/* Header contextual */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Panel Financiero</h2>
          <p className="text-xs text-white/50 mt-0.5">Métricas de {selectedMonthLabel}</p>
        </div>
        <MonthSelector
          value={selectedMonth}
          onChange={setSelectedMonth}
          options={monthOptions}
          showAllOption={true}
        />
      </div>

      {/* Grid de KPIs con Glassmorphism */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {kpis.map((k, i) => <KpiCard key={i} {...k} />)}
      </div>

      {/* Gráfico principal con curvas suaves y brillo cian */}
      <div className="glass-card rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap justify-between items-center gap-2 mb-6">
          <div>
            <h3 className="text-sm font-semibold text-white tracking-wide">Evolución de Ingresos y Gastos</h3>
            <p className="text-xs text-white/40">Comparativa mensual cronológica</p>
          </div>
          <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            Vista general
          </span>
        </div>

        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={monthlyHistory} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="cyanGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#06b6d4" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="roseGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#f43f5e" stopOpacity={0.22} />
                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "rgba(255, 255, 255, 0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "rgba(255, 255, 255, 0.4)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v / 1000}k€`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255, 255, 255, 0.5)" }} />
            <Area type="monotone" dataKey="income"  name="Ingresos" stroke="#06b6d4" strokeWidth={2.5} fill="url(#cyanGrad)" dot={false} />
            <Area type="monotone" dataKey="expense" name="Gastos"   stroke="#f43f5e" strokeWidth={2.5} fill="url(#roseGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Categorías y Movimientos Recientes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Gráfico Donut de Categorías */}
        <div className="glass-card rounded-2xl p-5 sm:p-6">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-sm font-semibold text-white">Gastos por categoría</h3>
            <span className="text-xs text-white/40">{selectedMonthLabel}</span>
          </div>

          {catData.length === 0 ? (
            <p className="text-white/40 text-xs py-14 text-center">Sin gastos registrados en este periodo.</p>
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={170} height={170}>
                <PieChart>
                  <Pie
                    data={catData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
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
                      background: "rgba(10, 15, 26, 0.9)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: 12,
                      fontSize: 12,
                      color: "#fff",
                      backdropFilter: "blur(12px)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              <div className="flex-1 space-y-2.5">
                {catData.slice(0, 5).map((c, i) => (
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
            </div>
          )}
        </div>

        {/* Movimientos Recientes */}
        <div className="glass-card rounded-2xl p-5 sm:p-6">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-sm font-semibold text-white">Últimos movimientos</h3>
            <span className="text-xs text-white/40">{recent.length} recientes</span>
          </div>

          {recent.length === 0 ? (
            <p className="text-white/40 text-xs py-14 text-center">Sin transacciones registradas.</p>
          ) : (
            <div className="space-y-3">
              {recent.map((t) => (
                <div
                  key={t.id}
                  className="flex justify-between items-center p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 transition-colors"
                >
                  <div className="min-w-0 pr-3">
                    <p className="font-medium text-xs text-white truncate">{t.description}</p>
                    <p className="text-[10px] text-white/40 mt-0.5">
                      <span className="text-white/70">{t.date.split(" ")[0]}</span>
                      {t.date.includes(" ") && (
                        <span className="text-cyan-400/80 ml-1.5 font-mono">{t.date.split(" ")[1]}</span>
                      )}
                      {" "}· {t.category}
                    </p>
                  </div>
                  <span
                    className={`font-mono text-xs font-bold shrink-0 ${
                      t.type === "income" ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {t.type === "income" ? "+" : ""}{fmt(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Overview

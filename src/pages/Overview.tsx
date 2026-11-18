import { useState, useMemo } from "react"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from "recharts"
import KpiCard from "../components/ui/KpiCard"
import CustomTooltip from "../components/ui/CustomTooltip"
import { MonthSelector } from "../components/ui/MonthSelector"
import { fmt, buildMonthlyData, buildCategoryData } from "../utils/formatters"
import { MONTHS, CAT_COLORS } from "../constants/categories"
import { getAvailableMonths, filterTransactionsByMonth, computeTotals } from "../utils/dateFilters"
import type { Transaction, Totals } from "../types"

interface OverviewProps {
  transactions: Transaction[]
  totals: Totals
}

const Overview = ({ transactions }: OverviewProps) => {
  const monthOptions = useMemo(() => getAvailableMonths(transactions), [transactions])

  // Por defecto, selecciona el mes más reciente disponible o el actual
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return monthOptions[0]?.key || "all"
  })

  // Transacciones del mes seleccionado para KPIs y gráfico de categorías
  const currentMonthTxs = useMemo(() => {
    return filterTransactionsByMonth(transactions, selectedMonth)
  }, [transactions, selectedMonth])

  const monthTotals = useMemo(() => {
    return computeTotals(currentMonthTxs)
  }, [currentMonthTxs])

  // Evolución mensual global (para el gráfico cronológico de todos los meses)
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
      label: "Balance del mes",
      value: fmt(monthTotals.balance),
      sub: selectedMonthLabel,
      color: monthTotals.balance >= 0 ? "#4ade80" : "#f87171",
    },
    {
      label: "Ingresos",
      value: fmt(monthTotals.income),
      sub: selectedMonthLabel,
      color: "#4ade80",
    },
    {
      label: "Gastos",
      value: fmt(monthTotals.expense),
      sub: selectedMonthLabel,
      color: "#f87171",
    },
    {
      label: "Tasa de ahorro",
      value: `${monthTotals.savingsRate}%`,
      sub: selectedMonthLabel,
      color: "#a78bfa",
    },
  ]

  return (
    <div className="fade-up space-y-6">
      {/* Selector de mes superior */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-xl font-bold">Resumen</h2>
          <p className="text-xs text-muted">Viendo datos de {selectedMonthLabel}</p>
        </div>
        <MonthSelector
          value={selectedMonth}
          onChange={setSelectedMonth}
          options={monthOptions}
          showAllOption={true}
        />
      </div>

      {/* KPIs del mes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k, i) => <KpiCard key={i} {...k} />)}
      </div>

      {/* Gráfico de evolución cronológica */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex justify-between items-center mb-5">
          <p className="text-sm font-semibold">Evolución mensual histórica</p>
          <span className="text-[11px] text-muted">Orden cronológico</span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={monthlyHistory} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gi" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#4ade80" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="ge" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#f87171" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#2a2a38" strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "#6b6b80", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#6b6b80", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v / 1000}k€`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, color: "#6b6b80" }} />
            <Area type="monotone" dataKey="income"  name="Ingresos" stroke="#4ade80" strokeWidth={2} fill="url(#gi)" dot={false} />
            <Area type="monotone" dataKey="expense" name="Gastos"   stroke="#f87171" strokeWidth={2} fill="url(#ge)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Gastos por categoría y últimos movimientos del mes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-sm font-semibold mb-4">Gastos por categoría ({selectedMonthLabel})</p>
          {catData.length === 0 ? (
            <p className="text-muted text-xs py-10 text-center">Sin gastos registrados en este periodo.</p>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={catData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" strokeWidth={0}>
                    {catData.map((_, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "#1c1c26", border: "1px solid #2a2a38", borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1">
                {catData.slice(0, 5).map((c, i) => (
                  <div key={i} className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-sm" style={{ background: CAT_COLORS[i % CAT_COLORS.length] }} />
                      <span className="text-xs text-muted truncate max-w-[100px]">{c.name}</span>
                    </div>
                    <span className="text-xs font-mono">{fmt(c.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-sm font-semibold mb-4">Movimientos recientes ({selectedMonthLabel})</p>
          {recent.length === 0 ? (
            <p className="text-muted text-xs py-10 text-center">Sin transacciones en este mes.</p>
          ) : (
            <div className="space-y-3">
              {recent.map((t) => (
                <div key={t.id} className="flex justify-between items-center text-xs">
                  <div className="min-w-0 pr-2">
                    <p className="font-medium truncate">{t.description}</p>
                    <p className="text-[10px] text-muted">{t.date} · {t.category}</p>
                  </div>
                  <span className={`font-mono font-semibold shrink-0 ${t.type === "income" ? "text-income" : "text-expense"}`}>
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

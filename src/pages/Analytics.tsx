import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import CategoryBar from "../components/ui/CategoryBar"
import CustomTooltip from "../components/ui/CustomTooltip"
import { buildMonthlyData, buildCategoryData } from "../utils/formatters"
import { MONTHS } from "../constants/categories"
import type { Transaction, Totals } from "../types"

const MODERN_COLORS = [
  "#06b6d4", "#38bdf8", "#818cf8", "#a78bfa", "#f472b6", "#fb7185", "#34d399", "#fbbf24",
]

interface AnalyticsProps {
  transactions: Transaction[]
  totals: Totals
}

const Analytics = ({ transactions, totals }: AnalyticsProps) => {
  const monthly = buildMonthlyData(transactions, MONTHS)
  const catData = buildCategoryData(transactions)

  return (
    <div className="fade-up space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Analítica Financiera</h2>
        <p className="text-xs text-white/50 mt-0.5">Rendimiento y distribución histórica</p>
      </div>

      <div className="glass-card rounded-2xl p-5 sm:p-6">
        <div className="flex justify-between items-center mb-5">
          <p className="text-sm font-semibold text-white">Ahorro neto mensual</p>
          <span className="text-xs text-white/40">Historial completo</span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={monthly} barSize={28}>
            <CartesianGrid stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "rgba(255, 255, 255, 0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "rgba(255, 255, 255, 0.4)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}€`} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="savings" name="Ahorro" radius={[8, 8, 0, 0]}>
              {monthly.map((m, i) => (
                <Cell key={i} fill={m.savings >= 0 ? "#06b6d4" : "#f43f5e"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="glass-card rounded-2xl p-5 sm:p-6">
        <p className="text-sm font-semibold text-white mb-5">Desglose de gastos por categoría</p>
        {catData.length === 0 ? (
          <p className="text-white/40 text-xs py-8 text-center">Sin datos de gastos todavía.</p>
        ) : (
          <div className="space-y-4">
            {catData.map((c, i) => (
              <CategoryBar
                key={i}
                name={c.name}
                value={c.value}
                total={totals.expense}
                color={MODERN_COLORS[i % MODERN_COLORS.length]}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Analytics

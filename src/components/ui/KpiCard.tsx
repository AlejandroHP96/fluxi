import { motion } from "framer-motion"
import { LucideIcon } from "lucide-react"

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  color?: string
  icon?: LucideIcon
  change?: string
  isPositive?: boolean
}

const KpiCard = ({ label, value, sub, color = "#06b6d4", icon: Icon, change, isPositive }: KpiCardProps) => (
  <motion.div
    whileHover={{ y: -4, transition: { duration: 0.2 } }}
    className="glass-card p-5 sm:p-6 rounded-2xl relative overflow-hidden group"
  >
    {/* Resplandor sutil en hover */}
    <div
      className="absolute -top-12 -right-12 w-28 h-28 rounded-full opacity-0 group-hover:opacity-20 blur-2xl transition-opacity pointer-events-none"
      style={{ background: color }}
    />

    <div className="flex items-start justify-between mb-3">
      <p className="text-xs sm:text-sm font-medium text-white/60 tracking-wide">{label}</p>
      {Icon && (
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border border-white/10"
          style={{ background: `${color}18`, color }}
        >
          <Icon className="w-4 h-4" />
        </div>
      )}
    </div>

    <div className="space-y-1">
      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">{value}</h2>
      <div className="flex items-center justify-between text-xs pt-1">
        {sub && <span className="text-white/40 truncate text-[11px] sm:text-xs">{sub}</span>}
        {change && (
          <span
            className={`font-semibold flex items-center gap-0.5 ml-auto text-[11px] sm:text-xs ${
              isPositive ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {isPositive ? "↑" : "↓"} {change}
          </span>
        )}
      </div>
    </div>
  </motion.div>
)

export default KpiCard

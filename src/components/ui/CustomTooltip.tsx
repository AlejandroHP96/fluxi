import { fmt } from "../../utils/formatters"

interface PayloadEntry {
  color: string
  name: string
  value: number
}

interface CustomTooltipProps {
  active?: boolean
  payload?: PayloadEntry[]
  label?: string
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-panel rounded-xl px-4 py-3 text-xs shadow-2xl border border-white/15 backdrop-blur-xl">
      <p className="text-white/60 font-medium mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || "#06b6d4" }} className="my-0.5 font-semibold">
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  )
}

export default CustomTooltip

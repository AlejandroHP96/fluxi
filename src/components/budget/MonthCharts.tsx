import { useLayoutEffect, useMemo, useRef, useState } from "react"
import { Activity, BarChart3, PieChart } from "lucide-react"
import { fmt } from "../../utils/formatters"
import { daysInMonth, monthLabel, shiftMonth, summarizeMonth } from "../../utils/month"
import { netAmount, type BudgetCategory, type Expense, type FixedExpense, type MonthSummary } from "../../types/budget"
import { catColor } from "./helpers"

interface MonthChartsProps {
  currentMonth: string
  allExpenses: Expense[]
  allIncome: Record<string, number>
  categories: BudgetCategory[]
  fixedExpenses: FixedExpense[]
  summary: MonthSummary
}

type ChartTab = "daily" | "history" | "categories"

export const MonthCharts = ({
  currentMonth,
  allExpenses,
  allIncome,
  categories,
  fixedExpenses,
  summary: s,
}: MonthChartsProps) => {
  const [activeTab, setActiveTab] = useState<ChartTab>("daily")
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  // Ancho real del área de la gráfica: el SVG se dibuja a ese ancho (sin escalar ni dejar márgenes vacíos)
  const chartRef = useRef<HTMLDivElement>(null)
  const [chartWidth, setChartWidth] = useState(640)
  // useLayoutEffect: mide antes de pintar, así el móvil no ve un fotograma a 640px
  useLayoutEffect(() => {
    const el = chartRef.current
    if (!el) return
    setChartWidth(Math.max(240, Math.round(el.clientWidth)))
    const ro = new ResizeObserver(([entry]) => setChartWidth(Math.max(240, Math.round(entry.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 1. Datos para evolución diaria (mes en curso)
  const dailyData = useMemo(() => {
    const totalDays = daysInMonth(currentMonth)
    const monthExps = allExpenses.filter((e) => e.date.startsWith(currentMonth))
    const dayMap = new Map<number, number>()
    for (const e of monthExps) {
      const day = Number(e.date.split("-")[2])
      dayMap.set(day, (dayMap.get(day) || 0) + netAmount(e))
    }

    const todayDate = new Date()
    const isCurrent = s.isCurrent
    const currentDay = isCurrent ? todayDate.getDate() : s.isPast ? totalDays : 0

    let runningTotal = 0
    const points: Array<{
      day: number
      spent: number
      accumulated: number
      pace: number
      isFuture: boolean
    }> = []

    const spendable = Math.max(0, s.spendable)

    for (let d = 1; d <= totalDays; d++) {
      const daySpent = dayMap.get(d) || 0
      const isFuture = isCurrent && d > currentDay
      if (!isFuture) {
        runningTotal += daySpent
      }
      const pace = spendable > 0 ? (spendable / totalDays) * d : 0
      points.push({
        day: d,
        spent: daySpent,
        accumulated: runningTotal,
        pace,
        isFuture,
      })
    }
    return { points, totalDays, currentDay }
  }, [currentMonth, allExpenses, s.isCurrent, s.isPast, s.spendable])

  // 2. Datos para historial de 6 meses
  const historyData = useMemo(() => {
    const months: string[] = []
    for (let i = -5; i <= 0; i++) {
      months.push(shiftMonth(currentMonth, i))
    }
    return months.map((m) => {
      const inc = allIncome[m] ?? null
      const sum = summarizeMonth(allExpenses, m, inc, categories, fixedExpenses)
      const shortName = new Intl.DateTimeFormat("es-ES", { month: "short" })
        .format(new Date(`${m}-01T12:00:00`))
        .replace(".", "")
      return {
        month: m,
        label: shortName,
        fullLabel: monthLabel(m),
        income: inc ?? 0,
        netIncome: sum.netIncome,
        spent: sum.spent + sum.totalFixed,
        saved: sum.saved,
        available: sum.available,
      }
    })
  }, [currentMonth, allExpenses, allIncome, categories, fixedExpenses])

  // 3. Datos de reparto por categorías del mes
  const categoryDistribution = useMemo(() => {
    return s.envelopes
      .map((e) => ({
        category: e.category,
        allocated: e.allocated,
        spent: e.spent,
        remaining: e.remaining,
        pctSpent: e.pctSpent,
        shareOfTotal: s.spent > 0 ? (e.spent / s.spent) * 100 : 0,
        color: catColor(categories, e.category),
      }))
      .sort((a, b) => b.spent - a.spent)
  }, [s.envelopes, s.spent, categories])

  // RENDER: Evolución diaria (SVG Area Chart)
  const renderDailyChart = () => {
    const { points, totalDays, currentDay } = dailyData
    const activePoints = points.filter((p) => !p.isFuture)
    if (activePoints.length === 0) {
      return (
        <div className="flex h-52 items-center justify-center text-sm text-white/50">
          Apunta tus primeros gastos del mes para ver la gráfica de ritmo diario.
        </div>
      )
    }

    const maxVal = Math.max(
      s.spendable || 0,
      ...points.map((p) => p.accumulated),
      ...points.map((p) => p.pace),
      100
    ) * 1.1

    const width = chartWidth
    const height = 180
    const paddingX = 12
    const paddingY = 16
    const axisH = 18
    const chartW = width - paddingX * 2
    const chartH = height - paddingY - axisH

    const getX = (day: number) => paddingX + ((day - 1) / (totalDays - 1)) * chartW
    const getY = (val: number) => paddingY + chartH - (val / maxVal) * chartH

    // Path del área acumulada real
    const areaPoints = activePoints.map((p) => `${getX(p.day)},${getY(p.accumulated)}`)
    const linePath = `M ${areaPoints.join(" L ")}`
    const areaPath = `${linePath} L ${getX(activePoints[activePoints.length - 1].day)},${paddingY + chartH} L ${getX(
      1
    )},${paddingY + chartH} Z`

    // Path de la línea de ritmo esperado
    const pacePath = `M ${getX(1)},${getY(points[0].pace)} L ${getX(totalDays)},${getY(
      points[points.length - 1].pace
    )}`

    const hovered = hoverIndex !== null && points[hoverIndex] ? points[hoverIndex] : null

    return (
      <div className="relative">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-white/60">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              Gasto acumulado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-3 bg-white/40 border-b border-dashed border-white" />
              Ritmo presupuestado
            </span>
          </div>
          {/* Siempre presente (invisible sin hover) para que la gráfica no salte al pasar el dedo */}
          <span className={`min-h-[1rem] font-medium text-white/90 ${hovered ? "" : "invisible"}`}>
            {hovered ? (
              <>
                Día {hovered.day}: {fmt(hovered.accumulated)} acum.{" "}
                {hovered.spent > 0 && `(+${fmt(hovered.spent)})`}
              </>
            ) : (
              "–"
            )}
          </span>
        </div>

        <div className="w-full overflow-hidden">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            width={width}
            height={height}
            className="block overflow-visible"
            onMouseLeave={() => setHoverIndex(null)}
          >
            <defs>
              <linearGradient id="dailyAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Líneas horizontales de guía */}
            {[0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = paddingY + chartH - ratio * chartH
              return (
                <line
                  key={ratio}
                  x1={paddingX}
                  y1={y}
                  x2={width - paddingX}
                  y2={y}
                  stroke="rgba(255,255,255,0.06)"
                  strokeDasharray="4 4"
                />
              )
            })}

            {/* Línea de ritmo ideal */}
            <path
              d={pacePath}
              fill="none"
              stroke="rgba(255, 255, 255, 0.3)"
              strokeWidth="1.5"
              strokeDasharray="5 4"
            />

            {/* Área y línea de gasto acumulado real */}
            <path d={areaPath} fill="url(#dailyAreaGrad)" />
            <path
              d={linePath}
              fill="none"
              stroke="#22d3ee"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Puntos y áreas interactivas por día */}
            {points.map((p, idx) => {
              if (p.isFuture) return null
              const cx = getX(p.day)
              const cy = getY(p.accumulated)
              const isHovered = hoverIndex === idx
              return (
                <g key={p.day}>
                  {p.spent > 0 && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isHovered ? 5 : 3}
                      fill="#22d3ee"
                      stroke="#07090e"
                      strokeWidth="2"
                    />
                  )}
                  {/* Zona táctil invisible amplia */}
                  <rect
                    x={cx - chartW / totalDays / 2}
                    y={paddingY}
                    width={chartW / totalDays}
                    height={chartH}
                    fill="transparent"
                    onMouseEnter={() => setHoverIndex(idx)}
                    onTouchStart={() => setHoverIndex(idx)}
                    className="cursor-pointer"
                  />
                </g>
              )
            })}

            {/* Eje de días */}
            {[1, 10, 20, totalDays].map((d, i, arr) => (
              <text
                key={d}
                x={getX(d)}
                y={height - 4}
                textAnchor={i === 0 ? "start" : i === arr.length - 1 ? "end" : "middle"}
                fill="rgba(255,255,255,0.4)"
                fontSize="11"
              >
                Día {d}
              </text>
            ))}

            {/* Marcador vertical de día actual */}
            {s.isCurrent && (
              <line
                x1={getX(currentDay)}
                y1={paddingY}
                x2={getX(currentDay)}
                y2={paddingY + chartH}
                stroke="rgba(255,255,255,0.5)"
                strokeWidth="1"
              />
            )}
          </svg>
        </div>

      </div>
    )
  }

  // RENDER: Historial de los últimos 6 meses
  const renderHistoryChart = () => {
    const maxVal = Math.max(...historyData.map((d) => Math.max(d.netIncome, d.spent, d.saved)), 100) * 1.15
    const width = chartWidth
    const height = 180
    const paddingX = 8
    const paddingY = 16
    const chartW = width - paddingX * 2
    const chartH = height - paddingY - 20

    const colWidth = chartW / historyData.length
    const barWidth = Math.min(22, colWidth * 0.28)

    const hovered = hoverIndex !== null && historyData[hoverIndex] ? historyData[hoverIndex] : null

    return (
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-white/60">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-cyan-400" />
              Nómina neta
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-amber-400" />
              Gastado total
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-emerald-400" />
              Ahorro
            </span>
          </div>
          <span className={`min-h-[1rem] font-medium text-white/90 ${hovered ? "" : "invisible"}`}>
            {hovered ? `${hovered.fullLabel}: Gastado ${fmt(hovered.spent)} de ${fmt(hovered.netIncome)}` : "–"}
          </span>
        </div>

        <div className="w-full overflow-hidden">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            width={width}
            height={height}
            className="block overflow-visible"
            onMouseLeave={() => setHoverIndex(null)}
          >
            {/* Líneas guía horizontales */}
            {[0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = paddingY + chartH - ratio * chartH
              return (
                <line
                  key={ratio}
                  x1={paddingX}
                  y1={y}
                  x2={width - paddingX}
                  y2={y}
                  stroke="rgba(255,255,255,0.06)"
                  strokeDasharray="4 4"
                />
              )
            })}

            {/* Barras de cada mes */}
            {historyData.map((d, i) => {
              const centerX = paddingX + i * colWidth + colWidth / 2
              const incomeH = maxVal > 0 ? (d.netIncome / maxVal) * chartH : 0
              const spentH = maxVal > 0 ? (d.spent / maxVal) * chartH : 0
              const savedH = maxVal > 0 ? (d.saved / maxVal) * chartH : 0

              const isSelected = d.month === currentMonth
              const isHovered = hoverIndex === i

              return (
                <g key={d.month}>
                  {/* Resalte del mes seleccionado */}
                  {isSelected && (
                    <rect
                      x={centerX - colWidth / 2 + 4}
                      y={paddingY}
                      width={colWidth - 8}
                      height={chartH}
                      rx="8"
                      fill="rgba(6, 182, 212, 0.08)"
                      stroke="rgba(6, 182, 212, 0.3)"
                      strokeWidth="1"
                    />
                  )}

                  {/* Barra 1: Nómina Neta */}
                  <rect
                    x={centerX - barWidth * 1.5 - 2}
                    y={paddingY + chartH - incomeH}
                    width={barWidth}
                    height={incomeH}
                    rx="3"
                    fill="#38bdf8"
                    opacity={isHovered ? 1 : 0.85}
                  />

                  {/* Barra 2: Gastado */}
                  <rect
                    x={centerX - barWidth / 2}
                    y={paddingY + chartH - spentH}
                    width={barWidth}
                    height={spentH}
                    rx="3"
                    fill={d.spent > d.netIncome ? "#f87171" : "#fbbf24"}
                    opacity={isHovered ? 1 : 0.85}
                  />

                  {/* Barra 3: Ahorro */}
                  <rect
                    x={centerX + barWidth / 2 + 2}
                    y={paddingY + chartH - savedH}
                    width={barWidth}
                    height={savedH}
                    rx="3"
                    fill="#34d399"
                    opacity={isHovered ? 1 : 0.85}
                  />

                  {/* Label mes en eje X */}
                  <text
                    x={centerX}
                    y={height - 2}
                    textAnchor="middle"
                    fill={isSelected ? "#22d3ee" : "rgba(255,255,255,0.6)"}
                    fontSize="11"
                    fontWeight={isSelected ? "600" : "400"}
                  >
                    {d.label}
                  </text>

                  {/* Área táctil para interacción */}
                  <rect
                    x={centerX - colWidth / 2}
                    y={paddingY}
                    width={colWidth}
                    height={chartH}
                    fill="transparent"
                    onMouseEnter={() => setHoverIndex(i)}
                    onTouchStart={() => setHoverIndex(i)}
                    className="cursor-pointer"
                  />
                </g>
              )
            })}
          </svg>
        </div>
      </div>
    )
  }

  // RENDER: Distribución por sobres
  const renderCategoriesDistribution = () => {
    if (categoryDistribution.length === 0) {
      return (
        <div className="flex h-52 items-center justify-center text-sm text-white/50">
          No hay categorías configuradas para mostrar distribución.
        </div>
      )
    }

    return (
      <div className="space-y-3 pt-1">
        <p className="text-xs text-white/60">
          Distribución del gasto real de {monthLabel(currentMonth)} entre tus sobres:
        </p>

        <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
          {categoryDistribution.map((item) => (
            <div key={item.category.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="truncate font-medium text-white/90">{item.category.name}</span>
                </div>
                <div className="flex items-baseline gap-2 shrink-0">
                  <span className="font-semibold text-white tabular-nums">{fmt(item.spent)}</span>
                  <span className="text-white/50 tabular-nums">
                    ({Math.round(item.shareOfTotal)} % del gasto)
                  </span>
                </div>
              </div>

              {/* Barra de progreso de este sobre */}
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    backgroundColor: item.color,
                    width: `${Math.min(100, item.pctSpent || 0)}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="glass-panel overflow-hidden rounded-3xl p-4 sm:p-6">
      {/* Header con tabs */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-3.5">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-cyan-300" />
          <h2 className="text-sm font-semibold tracking-tight text-white">Análisis y Gráficas</h2>
        </div>

        <div className="grid w-full grid-cols-3 rounded-xl bg-white/[0.06] p-1 text-xs font-medium sm:flex sm:w-auto">
          <button
            type="button"
            onClick={() => {
              setActiveTab("daily")
              setHoverIndex(null)
            }}
            className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 transition-all sm:px-2.5 ${
              activeTab === "daily" ? "bg-white/15 text-white shadow" : "text-white/60 hover:text-white"
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            <span className="sm:hidden">Diario</span>
            <span className="hidden sm:inline">Evolución diaria</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("history")
              setHoverIndex(null)
            }}
            className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 transition-all sm:px-2.5 ${
              activeTab === "history" ? "bg-white/15 text-white shadow" : "text-white/60 hover:text-white"
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span className="sm:hidden">6 meses</span>
            <span className="hidden sm:inline">Últimos 6 meses</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("categories")
              setHoverIndex(null)
            }}
            className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 transition-all sm:px-2.5 ${
              activeTab === "categories" ? "bg-white/15 text-white shadow" : "text-white/60 hover:text-white"
            }`}
          >
            <PieChart className="h-3.5 w-3.5" />
            <span className="sm:hidden">Sobres</span>
            <span className="hidden sm:inline">Por sobres</span>
          </button>
        </div>
      </div>

      {/* Contenido del gráfico activo */}
      <div ref={chartRef}>
        {activeTab === "daily" && renderDailyChart()}
        {activeTab === "history" && renderHistoryChart()}
        {activeTab === "categories" && renderCategoriesDistribution()}
      </div>
    </div>
  )
}

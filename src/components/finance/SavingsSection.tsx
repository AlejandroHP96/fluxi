import { useMemo, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { SectionHeader } from "./FinanceModal"
import CustomTooltip from "../ui/CustomTooltip"
import { fmt, fmtDec } from "../../utils/formatters"
import { summarizeTransfersByMonth } from "../../utils/finance"
import { MONTHS } from "../../constants/categories"
import type { Transfer } from "../../types"

const ROWS_COLLAPSED = 12

const monthLabel = (key: string) => {
  const [y, m] = key.split("-")
  return `${MONTHS[Number(m) - 1] ?? m} ${y.slice(-2)}`
}

const signed = (n: number) => `${n > 0 ? "+" : ""}${fmtDec(n)}`
const tone = (n: number) => (n > 0 ? "text-emerald-400" : n < 0 ? "text-rose-400" : "text-white/50")

const Stat = ({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) => (
  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
    <p className="text-[11px] text-white/40 uppercase tracking-wider font-semibold">{label}</p>
    <p className={`text-xl font-bold font-mono mt-1 ${color ?? "text-white"}`}>{value}</p>
    {sub && <p className="text-[11px] text-white/40 mt-0.5">{sub}</p>}
  </div>
)

const th = "px-3 py-2.5 text-[11px] text-white/40 font-semibold uppercase tracking-wider"

export const SavingsSection = ({ transfers }: { transfers: Transfer[] }) => {
  const months = useMemo(() => summarizeTransfersByMonth(transfers), [transfers])
  const [showAllSavings, setShowAllSavings] = useState(false)
  const [showAllOwn, setShowAllOwn] = useState(false)

  const year = String(new Date().getFullYear())
  const totals = useMemo(() => {
    const sum = (list: typeof months) =>
      list.reduce(
        (a, m) => ({
          in: a.in + m.savingsIn,
          out: a.out + m.savingsOut,
          interest: a.interest + m.interest,
        }),
        { in: 0, out: 0, interest: 0 }
      )
    return { year: sum(months.filter((m) => m.month.startsWith(year))), all: sum(months) }
  }, [months, year])

  const savingsMonths = useMemo(
    () => months.filter((m) => m.savingsIn || m.savingsOut || m.interest),
    [months]
  )
  const ownMonths = useMemo(() => months.filter((m) => m.ownIn || m.ownOut), [months])

  // Gráfica: últimos 12 meses con actividad, de más antiguo a más reciente
  const chartData = useMemo(
    () =>
      savingsMonths
        .slice(0, 12)
        .reverse()
        .map((m) => ({ label: monthLabel(m.month), aportado: m.savingsIn, retirado: m.savingsOut, intereses: m.interest })),
    [savingsMonths]
  )

  const yearNet = totals.year.in - totals.year.out + totals.year.interest

  return (
    <section className="glass-card rounded-2xl p-5 sm:p-6">
      <SectionHeader
        title="Ahorro"
        subtitle="Aportaciones, retiradas e intereses de tu cuenta de Ahorros. No cuentan como gasto ni ingreso."
      />

      {savingsMonths.length === 0 ? (
        <p className="text-xs text-white/40 py-8 text-center">
          Todavía no hay movimientos de ahorro. Se rellenan al importar el CSV de Revolut.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <Stat label={`Neto ${year}`} value={signed(yearNet)} color={tone(yearNet)} sub="Aportado − retirado + intereses" />
            <Stat label={`Aportado ${year}`} value={fmtDec(totals.year.in)} sub={`Retirado ${fmtDec(totals.year.out)}`} />
            <Stat label={`Intereses ${year}`} value={fmtDec(totals.year.interest)} color="text-emerald-400" />
            <Stat label="Intereses totales" value={fmtDec(totals.all.interest)} color="text-emerald-400" sub="Desde el primer movimiento" />
          </div>

          <div className="w-full mb-6">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "rgba(255, 255, 255, 0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "rgba(255, 255, 255, 0.4)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmt(v).replace(/,00/, "")} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255, 255, 255, 0.04)" }} />
                <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255, 255, 255, 0.5)" }} />
                <Bar dataKey="aportado" name="Aportado" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                <Bar dataKey="retirado" name="Retirado" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="intereses" name="Intereses" fill="#34d399" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[460px]">
              <thead>
                <tr className="border-b border-white/5">
                  <th className={`${th} text-left`}>Mes</th>
                  <th className={`${th} text-right`}>Aportado</th>
                  <th className={`${th} text-right`}>Retirado</th>
                  <th className={`${th} text-right`}>Intereses</th>
                  <th className={`${th} text-right`}>Neto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(showAllSavings ? savingsMonths : savingsMonths.slice(0, ROWS_COLLAPSED)).map((m) => {
                  const net = m.savingsIn - m.savingsOut + m.interest
                  return (
                    <tr key={m.month} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-3 py-2.5 text-xs text-white/80 whitespace-nowrap">{monthLabel(m.month)}</td>
                      <td className="px-3 py-2.5 text-xs text-right font-mono text-white/80">{fmtDec(m.savingsIn)}</td>
                      <td className="px-3 py-2.5 text-xs text-right font-mono text-white/80">{fmtDec(m.savingsOut)}</td>
                      <td className="px-3 py-2.5 text-xs text-right font-mono text-emerald-400">{fmtDec(m.interest)}</td>
                      <td className={`px-3 py-2.5 text-xs text-right font-mono font-bold ${tone(net)}`}>{signed(net)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {savingsMonths.length > ROWS_COLLAPSED && (
            <button
              onClick={() => setShowAllSavings((v) => !v)}
              className="mt-3 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              {showAllSavings ? "Ver menos" : `Ver los ${savingsMonths.length} meses`}
            </button>
          )}
        </>
      )}

      {/* Traspasos con tus cuentas y la Conjunta */}
      <div className="mt-8 pt-6 border-t border-white/[0.08]">
        <SectionHeader
          title="Traspasos con tus cuentas y la Conjunta"
          subtitle="Dinero que mueves entre tus cuentas o con quien comparte la Conjunta: ni gasto ni ingreso."
        />
        {ownMonths.length === 0 ? (
          <p className="text-xs text-white/40 py-4 text-center">
            Sin traspasos todavía. Añade los nombres en «Ajustes de traspasos» para detectarlos.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[380px]">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className={`${th} text-left`}>Mes</th>
                    <th className={`${th} text-right`}>Recibido</th>
                    <th className={`${th} text-right`}>Enviado</th>
                    <th className={`${th} text-right`}>Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(showAllOwn ? ownMonths : ownMonths.slice(0, ROWS_COLLAPSED)).map((m) => (
                    <tr key={m.month} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-3 py-2.5 text-xs text-white/80 whitespace-nowrap">{monthLabel(m.month)}</td>
                      <td className="px-3 py-2.5 text-xs text-right font-mono text-emerald-400">{fmtDec(m.ownIn)}</td>
                      <td className="px-3 py-2.5 text-xs text-right font-mono text-rose-400">{fmtDec(m.ownOut)}</td>
                      <td className={`px-3 py-2.5 text-xs text-right font-mono font-bold ${tone(m.ownIn - m.ownOut)}`}>
                        {signed(m.ownIn - m.ownOut)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {ownMonths.length > ROWS_COLLAPSED && (
              <button
                onClick={() => setShowAllOwn((v) => !v)}
                className="mt-3 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                {showAllOwn ? "Ver menos" : `Ver los ${ownMonths.length} meses`}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  )
}

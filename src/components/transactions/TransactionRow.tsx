import { fmtDec } from "../../utils/formatters"
import type { Transaction } from "../../types"

interface TransactionRowProps {
  tx: Transaction
  onDelete: (id: string) => Promise<boolean>
  isEven: boolean
}

const TransactionRow = ({ tx, onDelete }: TransactionRowProps) => (
  <tr className="hover:bg-white/[0.03] transition-colors group">
    <td className="px-5 py-3.5 text-xs whitespace-nowrap">
      <span className="text-white/80">{tx.date.split(" ")[0]}</span>
      {tx.date.includes(" ") && (
        <span className="text-cyan-400/80 text-[11px] ml-2 font-mono">{tx.date.split(" ")[1]}</span>
      )}
    </td>
    <td className="px-5 py-3.5 text-xs font-medium text-white">{tx.description}</td>
    <td className="px-5 py-3.5 text-xs text-white/50">
      <span className="px-2 py-0.5 rounded-full text-[11px] bg-white/[0.04] border border-white/5 text-white/70">
        {tx.category}
      </span>
    </td>
    <td className="px-5 py-3.5 text-xs text-right font-mono font-bold whitespace-nowrap">
      <span className={tx.type === "income" ? "text-emerald-400" : "text-rose-400"}>
        {tx.type === "income" ? "+" : ""}{fmtDec(tx.amount)}
      </span>
    </td>
    <td className="px-5 py-3.5 text-right w-10">
      <button
        onClick={() => onDelete(tx.id)}
        className="w-6 h-6 rounded-lg text-white/20 hover:text-rose-400 hover:bg-rose-500/10 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
      >
        ×
      </button>
    </td>
  </tr>
)

export default TransactionRow

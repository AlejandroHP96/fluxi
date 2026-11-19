import { useState } from "react"
import { Target, Pencil, Trash2, Plus } from "lucide-react"
import { FinanceModal, Field, SectionHeader, inputClass, submitClass, parseAmount } from "./FinanceModal"
import { fmtDec } from "../../utils/formatters"
import { goalProgress } from "../../utils/finance"
import type { FinanceApi } from "../../hooks/useFinance"
import type { Account, Goal, NewGoal } from "../../types"

const formatDate = (deadline: string) => {
  const [y, m, d] = deadline.split("-")
  return `${d ?? "01"}/${m}/${y}`
}

interface GoalFormProps {
  initial?: Goal
  accounts: Account[]
  onClose: () => void
  onSave: (goal: NewGoal) => Promise<boolean>
}

const GoalForm = ({ initial, accounts, onClose, onSave }: GoalFormProps) => {
  const defaultAccount = accounts.find((a) => a.kind === "revolut_savings")?.id ?? accounts[0]?.id ?? ""
  const [name, setName] = useState(initial?.name ?? "")
  const [target, setTarget] = useState(initial ? String(initial.target) : "")
  const [deadline, setDeadline] = useState(initial?.deadline ?? "")
  const [accountId, setAccountId] = useState(
    initial && accounts.some((a) => a.id === initial.accountId) ? initial.accountId : defaultAccount
  )
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")

  const submit = async () => {
    const value = parseAmount(target)
    if (!name.trim()) return setErr("Ponle un nombre al objetivo.")
    if (Number.isNaN(value) || value <= 0) return setErr("Indica un importe objetivo mayor que 0.")
    if (!accountId) return setErr("Elige la cuenta cuyo saldo cuenta para este objetivo.")
    setSaving(true)
    const ok = await onSave({ name: name.trim(), target: value, deadline: deadline || null, accountId })
    setSaving(false)
    if (ok) onClose()
    else setErr("No se pudo guardar. Inténtalo de nuevo.")
  }

  return (
    <FinanceModal title={initial ? "Editar objetivo" : "Nuevo objetivo"} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Nombre">
          <input
            type="text"
            placeholder="Ej: Viaje a Japón"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Importe objetivo (€)">
          <input
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Fecha límite (opcional)">
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Cuenta vinculada">
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputClass}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id} className="bg-slate-900 text-white">
                {a.name} ({fmtDec(a.balance)})
              </option>
            ))}
          </select>
          <p className="text-[11px] text-white/40 mt-1.5">El progreso es el saldo de esta cuenta.</p>
        </Field>
      </div>
      {err && <p className="text-rose-400 text-xs mt-3">{err}</p>}
      <button onClick={submit} disabled={saving} className={submitClass}>
        {saving ? "Guardando..." : initial ? "Guardar cambios" : "Crear objetivo"}
      </button>
    </FinanceModal>
  )
}

export const GoalsSection = ({ finance }: { finance: FinanceApi }) => {
  const { goals, accounts } = finance
  const [editing, setEditing] = useState<Goal | null>(null)
  const [adding, setAdding] = useState(false)

  const remove = (g: Goal) => {
    if (window.confirm(`¿Borrar el objetivo «${g.name}»?`)) finance.deleteGoal(g.id)
  }

  return (
    <section className="glass-card rounded-2xl p-5 sm:p-6">
      <SectionHeader
        title="Objetivos de ahorro"
        subtitle="Cuánto te falta para llegar a lo que te has propuesto"
        action={
          <button
            onClick={() => setAdding(true)}
            disabled={accounts.length === 0}
            title={accounts.length === 0 ? "Añade una cuenta primero" : undefined}
            className="liquid-button flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5 text-cyan-400" />
            Nuevo objetivo
          </button>
        }
      />

      {goals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-8 text-center">
          <Target className="w-5 h-5 text-cyan-400 mx-auto mb-2" />
          <p className="text-xs text-white/40 max-w-sm mx-auto">
            {accounts.length === 0
              ? "Para crear un objetivo necesitas al menos una cuenta: importa el CSV de Revolut o añade una a mano."
              : "Aún no tienes objetivos. Crea uno y vincúlalo a tu cuenta de Ahorros."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {goals.map((g) => {
            const account = accounts.find((a) => a.id === g.accountId)
            const p = goalProgress(g, accounts)
            const done = p.remaining === 0 && p.current > 0
            return (
              <div key={g.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{g.name}</p>
                    <p className="text-[10px] text-white/40 truncate">
                      {account ? account.name : "Cuenta no encontrada"}
                      {g.deadline && ` · hasta ${formatDate(g.deadline)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => setEditing(g)}
                      title="Editar"
                      className="p-1.5 rounded-lg text-white/40 hover:text-cyan-300 hover:bg-white/[0.06] transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => remove(g)}
                      title="Borrar"
                      className="p-1.5 rounded-lg text-white/40 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden mt-3">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${done ? "bg-emerald-400" : "bg-cyan-400"}`}
                    style={{ width: `${Math.max(0, Math.min(100, p.pct))}%` }}
                  />
                </div>
                <div className="flex justify-between items-center gap-2 mt-2 text-[11px]">
                  <span className="text-white/60 font-mono">
                    {fmtDec(p.current)} <span className="text-white/30">/ {fmtDec(g.target)}</span>
                  </span>
                  <span className={`font-semibold ${done ? "text-emerald-400" : "text-cyan-300"}`}>
                    {Math.round(p.pct)} %
                  </span>
                </div>
                <p className="text-[11px] text-white/40 mt-1.5">
                  {done
                    ? "¡Objetivo alcanzado!"
                    : p.monthlyNeeded !== null
                      ? `Faltan ${fmtDec(p.remaining)} · ${fmtDec(p.monthlyNeeded)}/mes hasta ${formatDate(g.deadline!)}`
                      : g.deadline
                        ? `Faltan ${fmtDec(p.remaining)} · la fecha límite ya pasó`
                        : `Faltan ${fmtDec(p.remaining)}`}
                </p>
              </div>
            )
          })}
        </div>
      )}

      {adding && (
        <GoalForm accounts={accounts} onClose={() => setAdding(false)} onSave={finance.addGoal} />
      )}
      {editing && (
        <GoalForm
          initial={editing}
          accounts={accounts}
          onClose={() => setEditing(null)}
          onSave={(goal) => finance.updateGoal(editing.id, goal)}
        />
      )}
    </section>
  )
}

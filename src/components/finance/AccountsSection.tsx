import { useState } from "react"
import { Landmark, PiggyBank, Pencil, Trash2, Plus, Upload, HandCoins } from "lucide-react"
import { FinanceModal, Field, SectionHeader, inputClass, submitClass, parseAmount } from "./FinanceModal"
import { fmtDec } from "../../utils/formatters"
import type { FinanceApi } from "../../hooks/useFinance"
import type { Account } from "../../types"

interface AccountsSectionProps {
  finance: FinanceApi
  onImport?: () => void
}

const KIND_META = {
  revolut_current: { icon: Landmark, label: "Revolut", color: "#38bdf8" },
  revolut_savings: { icon: PiggyBank, label: "Revolut · Ahorros", color: "#34d399" },
  manual: { icon: HandCoins, label: "Manual", color: "#a78bfa" },
} as const

const formatDate = (s: string) => {
  const [d, t] = s.split(" ")
  const [y, m, day] = d.split("-")
  return `${day}/${m}/${y}${t ? ` ${t}` : ""}`
}

interface AccountFormProps {
  initial?: Account
  onClose: () => void
  onSave: (name: string, balance: number) => Promise<boolean>
}

const AccountForm = ({ initial, onClose, onSave }: AccountFormProps) => {
  const isRevolut = initial ? initial.kind !== "manual" : false
  const [name, setName] = useState(initial?.name ?? "")
  const [balance, setBalance] = useState(initial ? String(initial.balance) : "")
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")

  const submit = async () => {
    const value = isRevolut ? initial!.balance : parseAmount(balance)
    if (!name.trim()) return setErr("Ponle un nombre a la cuenta.")
    if (Number.isNaN(value)) return setErr("Indica un saldo válido.")
    setSaving(true)
    const ok = await onSave(name.trim(), value)
    setSaving(false)
    if (ok) onClose()
    else setErr("No se pudo guardar. Inténtalo de nuevo.")
  }

  return (
    <FinanceModal title={initial ? "Editar cuenta" : "Añadir cuenta"} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Nombre">
          <input
            type="text"
            placeholder="Ej: Efectivo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Saldo (€)">
          <input
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={isRevolut ? String(initial!.balance) : balance}
            onChange={(e) => setBalance(e.target.value)}
            disabled={isRevolut}
            className={inputClass}
          />
          {isRevolut && (
            <p className="text-[11px] text-white/40 mt-1.5">
              El saldo de Revolut se actualiza solo al importar el CSV.
            </p>
          )}
        </Field>
      </div>
      {err && <p className="text-rose-400 text-xs mt-3">{err}</p>}
      <button onClick={submit} disabled={saving} className={submitClass}>
        {saving ? "Guardando..." : initial ? "Guardar cambios" : "Añadir cuenta"}
      </button>
    </FinanceModal>
  )
}

export const AccountsSection = ({ finance, onImport }: AccountsSectionProps) => {
  const { accounts } = finance
  const [editing, setEditing] = useState<Account | null>(null)
  const [adding, setAdding] = useState(false)

  const total = accounts.reduce((s, a) => s + Number(a.balance), 0)

  const remove = (a: Account) => {
    if (window.confirm(`¿Borrar la cuenta «${a.name}»? Los objetivos vinculados dejarán de tener progreso.`)) {
      finance.deleteAccount(a.id)
    }
  }

  return (
    <section className="glass-card rounded-2xl p-5 sm:p-6">
      <SectionHeader
        title="Patrimonio"
        subtitle="Lo que tienes ahora mismo entre todas tus cuentas"
        action={
          <button
            onClick={() => setAdding(true)}
            className="liquid-button flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white"
          >
            <Plus className="w-3.5 h-3.5 text-cyan-400" />
            Añadir cuenta
          </button>
        }
      />

      {accounts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-8 text-center">
          <p className="text-sm font-semibold text-white">Aún no hay cuentas</p>
          <p className="text-xs text-white/40 mt-1 max-w-sm mx-auto">
            Importa el CSV de Revolut y tus cuentas Conjunta y Ahorros aparecerán solas con su saldo.
            También puedes añadir a mano efectivo u otro banco.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {onImport && (
              <button
                onClick={onImport}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-500 to-sky-500 text-slate-950"
              >
                <Upload className="w-3.5 h-3.5" />
                Importar CSV de Revolut
              </button>
            )}
            <button
              onClick={() => setAdding(true)}
              className="liquid-button flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white"
            >
              <Plus className="w-3.5 h-3.5 text-cyan-400" />
              Añadir cuenta manual
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-5">
            <p className="text-[11px] text-white/40 uppercase tracking-wider font-semibold">Total</p>
            <p className="text-3xl sm:text-4xl font-bold tracking-tight text-white font-mono">{fmtDec(total)}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {accounts.map((a) => {
              const meta = KIND_META[a.kind] ?? KIND_META.manual
              const Icon = meta.icon
              const isManual = a.kind === "manual"
              return (
                <div key={a.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 relative group">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border border-white/10"
                        style={{ background: `${meta.color}18`, color: meta.color }}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{a.name}</p>
                        <p className="text-[10px] text-white/40">{meta.label}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={() => setEditing(a)}
                        title="Editar"
                        className="p-1.5 rounded-lg text-white/40 hover:text-cyan-300 hover:bg-white/[0.06] transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {isManual && (
                        <button
                          onClick={() => remove(a)}
                          title="Borrar"
                          className="p-1.5 rounded-lg text-white/40 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className={`text-xl font-bold font-mono ${a.balance < 0 ? "text-rose-400" : "text-white"}`}>
                    {fmtDec(a.balance)}
                  </p>
                  <p className="text-[11px] text-white/40 mt-1">
                    Actualizado el {formatDate(a.balanceDate)}
                  </p>
                  {!isManual && (
                    <p className="text-[10px] text-white/30 mt-1.5">Se actualiza al importar el CSV de Revolut</p>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {adding && (
        <AccountForm onClose={() => setAdding(false)} onSave={(name, balance) => finance.addManualAccount(name, balance)} />
      )}
      {editing && (
        <AccountForm
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(name, balance) =>
            finance.updateAccount(
              editing.id,
              editing.kind === "manual" && balance !== editing.balance ? { name, balance } : { name }
            )
          }
        />
      )}
    </section>
  )
}

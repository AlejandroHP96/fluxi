import { useState, useRef, ChangeEvent } from "react"
import { Camera, Image as ImageIcon, Loader2 } from "lucide-react"
import { CATEGORIES } from "../../constants/categories"
import { compressImage } from "../../utils/imageUtils"
import type { NewTransaction, TransactionType } from "../../types"

interface FormState {
  description: string
  amount: string
  category: string
  type: TransactionType
  date: string
}

const EMPTY: FormState = {
  description: "",
  amount: "",
  category: "Alimentación",
  type: "expense",
  date: new Date().toISOString().split("T")[0],
}

interface AddTransactionModalProps {
  onClose: () => void
  onAdd: (tx: NewTransaction) => Promise<boolean>
}

const AddTransactionModal = ({ onClose, onAdd }: AddTransactionModalProps) => {
  const [form, setForm]         = useState<FormState>(EMPTY)
  const [saving, setSaving]     = useState(false)
  const [scanning, setScanning] = useState(false)
  const [err, setErr]           = useState("")

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const handleCapture = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setScanning(true)
    setErr("")

    try {
      const base64DataUrl = await compressImage(file, 1200, 0.8)

      const res = await fetch("/api/scan-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64DataUrl,
          mimeType: "image/jpeg",
        }),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || "Fallo al escanear ticket")
      }

      const { data } = await res.json()

      setForm((prev) => ({
        ...prev,
        type: "expense",
        amount: data.amount ? String(data.amount) : prev.amount,
        description: data.description || prev.description,
        date: data.date || prev.date,
        category: data.category && CATEGORIES.includes(data.category) ? data.category : prev.category,
      }))
    } catch (error: any) {
      setErr(error.message || "No se pudo leer el ticket")
    } finally {
      setScanning(false)
      if (cameraInputRef.current) cameraInputRef.current.value = ""
      if (galleryInputRef.current) galleryInputRef.current.value = ""
    }
  }

  const handleSubmit = async () => {
    if (!form.description.trim() || !form.amount) {
      setErr("Descripción e importe son obligatorios."); return
    }
    setSaving(true)
    const ok = await onAdd({
      description: form.description.trim(),
      amount: form.type === "expense"
        ? -Math.abs(parseFloat(form.amount))
        : Math.abs(parseFloat(form.amount)),
      category: form.type === "income" ? "Ingresos" : form.category,
      type: form.type,
      date: form.date,
    })
    setSaving(false)
    if (ok) onClose()
    else setErr("Error al guardar. Inténtalo de nuevo.")
  }

  const fields: { label: string; key: keyof FormState; type: string; placeholder?: string }[] = [
    { label: "Descripción", key: "description", type: "text",   placeholder: "Ej: Mercadona" },
    { label: "Importe (€)", key: "amount",      type: "number", placeholder: "0.00" },
    { label: "Fecha",       key: "date",         type: "date" },
  ]

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-2xl p-5 sm:p-7 w-full max-w-sm my-auto max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-semibold">Nueva transacción</h3>
          <button onClick={onClose} className="text-muted hover:text-text text-xl leading-none">×</button>
        </div>

        {/* Botones de escanear (Cámara y Galería) */}
        {form.type === "expense" && (
          <div className="mb-4 space-y-2">
            {/* Input para cámara nativa */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleCapture}
              className="hidden"
            />
            {/* Input para galería / archivo */}
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              onChange={handleCapture}
              className="hidden"
            />

            {scanning ? (
              <div className="w-full py-2.5 px-3 rounded-lg border border-border bg-surface/50 text-xs font-medium text-text flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-accent" />
                <span>Leyendo ticket con Gemini...</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="py-2 px-2 rounded-lg border border-dashed border-border hover:border-accent text-xs font-medium text-text flex items-center justify-center gap-1.5 transition-colors bg-surface/50"
                >
                  <Camera className="w-3.5 h-3.5 text-accent shrink-0" />
                  <span className="truncate">Hacer foto</span>
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="py-2 px-2 rounded-lg border border-dashed border-border hover:border-accent text-xs font-medium text-text flex items-center justify-center gap-1.5 transition-colors bg-surface/50"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-accent shrink-0" />
                  <span className="truncate">Subir de galería</span>
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 mb-5">
          {(["expense", "income"] as TransactionType[]).map((t) => (
            <button key={t} onClick={() => set("type", t)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all border ${
                form.type === t
                  ? t === "income" ? "bg-income text-black border-income" : "bg-expense text-black border-expense"
                  : "bg-transparent text-muted border-border"
              }`}>
              {t === "income" ? "💰 Ingreso" : "💸 Gasto"}
            </button>
          ))}
        </div>
        {fields.map((f) => (
          <div key={f.key} className="mb-4">
            <label className="block text-xs text-muted mb-1">{f.label}</label>
            <input
              type={f.type}
              placeholder={f.placeholder}
              value={form[f.key]}
              onChange={(e) => set(f.key, e.target.value as FormState[typeof f.key])}
              className="w-full min-w-0 max-w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors appearance-none"
            />
          </div>
        ))}
        {form.type === "expense" && (
          <div className="mb-5">
            <label className="block text-xs text-muted mb-1">Categoría</label>
            <select
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-accent"
            >
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        )}
        {err && <p className="text-expense text-xs mb-4">{err}</p>}
        <button onClick={handleSubmit} disabled={saving || scanning}
          className={`w-full py-2.5 rounded-lg text-sm font-bold transition-opacity ${
            form.type === "income" ? "bg-income" : "bg-accent"
          } text-black ${saving || scanning ? "opacity-50 cursor-not-allowed" : "hover:opacity-90"}`}>
          {saving ? "Guardando..." : "Añadir transacción"}
        </button>
      </div>
    </div>
  )
}

export default AddTransactionModal

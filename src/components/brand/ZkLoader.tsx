import { useEffect, useState, type CSSProperties, type ReactNode } from "react"
import vectors from "./zk-vectors.json"
import { ZK_VIEWBOX } from "./ZkLogo"

// Pantalla de carga con el logo ZK (portada de Mi-tcg, components/zk-loader.tsx):
// las aspas y las letras se ensamblan en el centro y, cuando termina de cargar, el logo vuela
// hasta el logo de la app (#navbar-brand-logo) mientras la cortina se abre en círculo.
// Si ese logo no está visible (móvil, sin barra lateral), se desvanece en el centro.

const LOGO_SIZE = 180
const MIN_ASSEMBLE_MS = 1700
const FLY_MS = 1050

interface Target {
  x: number
  y: number
  size: number
}

const findTarget = (): Target | null => {
  const el = document.getElementById("navbar-brand-logo")
  if (!el) return null
  const rect = el.getBoundingClientRect()
  if (!rect.width || !rect.height) return null // oculto (p. ej. barra lateral en móvil)
  return { x: rect.left, y: rect.top, size: rect.width }
}

export function ZkLoader({ children, isLoading = false }: { children: ReactNode; isLoading?: boolean }) {
  const [phase, setPhase] = useState<"assembling" | "flying" | "done">("assembling")
  const [minTimeElapsed, setMinTimeElapsed] = useState(false)
  const [target, setTarget] = useState<Target | null>(null)
  const [center, setCenter] = useState<{ x: number; y: number } | null>(null)

  // Mientras dura, el logo real de la app se oculta (ver index.css) para que no se vea duplicado
  useEffect(() => {
    document.documentElement.classList.add("zk-loading")
    return () => document.documentElement.classList.remove("zk-loading")
  }, [])

  useEffect(() => {
    if (phase === "done") document.documentElement.classList.remove("zk-loading")
  }, [phase])

  useEffect(() => {
    // Centro en píxeles absolutos para que la transición hasta el destino sea fluida
    setCenter({ x: window.innerWidth / 2 - LOGO_SIZE / 2, y: window.innerHeight / 2 - LOGO_SIZE / 2 })
    const t = setTimeout(() => setMinTimeElapsed(true), MIN_ASSEMBLE_MS)
    return () => clearTimeout(t)
  }, [])

  // Solo vuela cuando ya se ensambló y terminó de cargar la sesión
  useEffect(() => {
    if (!minTimeElapsed || isLoading || phase !== "assembling") return
    setTarget(findTarget())
    setPhase("flying")
  }, [minTimeElapsed, isLoading, phase])

  // Fin del vuelo en un efecto aparte: si el temporizador viviera en el efecto de arriba, su limpieza
  // (que corre al cambiar `phase` a "flying") lo cancelaría y el loader no terminaría nunca
  useEffect(() => {
    if (phase !== "flying") return
    const t = setTimeout(() => setPhase("done"), FLY_MS)
    return () => clearTimeout(t)
  }, [phase])

  if (phase === "done") return <>{children}</>

  const isFlying = phase === "flying"
  const focusX = target ? target.x + target.size / 2 : window.innerWidth / 2
  const focusY = target ? target.y + target.size / 2 : window.innerHeight / 2

  const logoStyle: CSSProperties = isFlying
    ? target
      ? {
          top: `${target.y}px`,
          left: `${target.x}px`,
          width: `${target.size}px`,
          height: `${target.size}px`,
          transition: "all 0.9s cubic-bezier(0.16, 1, 0.3, 1)",
        }
      : {
          top: `${center?.y ?? 0}px`,
          left: `${center?.x ?? 0}px`,
          width: `${LOGO_SIZE}px`,
          height: `${LOGO_SIZE}px`,
          opacity: 0,
          transition: "opacity 0.9s ease-in-out",
        }
    : center
      ? { top: `${center.y}px`, left: `${center.x}px`, width: `${LOGO_SIZE}px`, height: `${LOGO_SIZE}px` }
      : { top: "50%", left: "50%", width: `${LOGO_SIZE}px`, height: `${LOGO_SIZE}px`, transform: "translate(-50%, -50%)" }

  return (
    <>
      {/* La app se monta detrás (invisible) para poder medir dónde está su logo */}
      <div className={isFlying ? "transition-opacity duration-500 opacity-100" : "invisible pointer-events-none select-none"}>
        {children}
      </div>

      {/* Cortina oscura con halo cian; se abre en círculo desde el logo de destino */}
      <div
        className="fixed inset-0 z-[100] pointer-events-none"
        style={{
          backgroundColor: "#07090e",
          backgroundImage: "radial-gradient(circle at center, #0a2a33 0%, #07090e 100%)",
          opacity: isFlying ? 0 : 1,
          clipPath: isFlying ? `circle(180% at ${focusX}px ${focusY}px)` : "circle(100% at center)",
          transition: "clip-path 1.05s cubic-bezier(0.16, 1, 0.3, 1), opacity 1.05s ease-in-out",
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={`w-96 h-96 rounded-full blur-3xl transition-opacity duration-700 ${isFlying ? "opacity-0" : "opacity-100 animate-pulse"}`}
            style={{ backgroundColor: "rgba(34, 211, 238, 0.22)" }}
          />
        </div>
      </div>

      {/* Logo ZK: ensamblado y volador */}
      <div className="fixed z-[101] pointer-events-none flex items-center justify-center text-white zk-animating" style={logoStyle}>
        <svg
          viewBox={ZK_VIEWBOX}
          className="w-full h-full overflow-visible"
          style={{ filter: "drop-shadow(0 0 24px rgba(34, 211, 238, 0.65))" }}
        >
          {vectors.blades.map((d, idx) => (
            <path
              key={idx}
              className="zk-blade"
              style={{ ["--rot" as string]: `${idx * 45 - 90}deg`, animationDelay: `${(idx * 0.08).toFixed(2)}s` }}
              d={d}
            />
          ))}
          <path className="zk-letter" style={{ animationDelay: "0.70s" }} d={vectors.z} />
          <path className="zk-letter" style={{ animationDelay: "0.85s" }} d={vectors.k} />
        </svg>
      </div>
    </>
  )
}

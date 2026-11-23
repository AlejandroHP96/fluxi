import vectors from "./zk-vectors.json"

// Recorte cuadrado alrededor del logo (las aspas ocupan ~191-888 del lienzo de 1080).
// El loader usa el mismo viewBox para que el logo volador aterrice encima sin saltos.
export const ZK_VIEWBOX = "165 165 750 750"

interface ZkLogoProps {
  id?: string
  className?: string
  title?: string
}

// Logo ZK estático (el mismo que ensambla ZkLoader)
export const ZkLogo = ({ id, className = "", title = "Fluxi" }: ZkLogoProps) => (
  <svg
    id={id}
    viewBox={ZK_VIEWBOX}
    role="img"
    aria-label={title}
    className={`text-white overflow-visible ${className}`}
    style={{ filter: "drop-shadow(0 0 6px rgb(var(--acc-400) / 0.55))" }}
  >
    {vectors.blades.map((d, idx) => (
      <path key={idx} d={d} fill="currentColor" />
    ))}
    <path d={vectors.z} fill="currentColor" />
    <path d={vectors.k} fill="currentColor" />
  </svg>
)

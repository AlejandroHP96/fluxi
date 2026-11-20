import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "@fontsource/dm-sans/400.css"
import "@fontsource/dm-sans/500.css"
import "@fontsource/dm-sans/600.css"
import "@fontsource/dm-sans/700.css"
import "@fontsource/dm-sans/800.css"
import "./index.css"

// Tras un despliegue nuevo, una pestaña abierta puede pedir un trozo de JS que ya no existe: se recarga la página
window.addEventListener("vite:preloadError", () => window.location.reload())

// Cuando el service worker nuevo toma el control tras un despliegue, se recarga una vez para usar la versión nueva
// (solo si ya había uno antes: en la primera visita no hace falta)
if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
  let reloaded = false
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloaded) return
    reloaded = true
    window.location.reload()
  })
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

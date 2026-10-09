import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import './styles.css'

registerSW({ immediate: true })

const elementRacine = document.getElementById('racine')

if (elementRacine === null) {
  throw new Error("Élément racine introuvable.")
}

createRoot(elementRacine).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

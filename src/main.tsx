import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import './styles.css'
import { capturerInvitationDansLaPage } from './partage/invitation'
import { initialiserTheme } from './themes'

registerSW({ immediate: true })
initialiserTheme()
capturerInvitationDansLaPage()

const elementRacine = document.getElementById('racine')

if (elementRacine === null) {
  throw new Error("Élément racine introuvable.")
}

createRoot(elementRacine).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

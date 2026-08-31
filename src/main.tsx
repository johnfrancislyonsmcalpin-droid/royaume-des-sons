import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/andika/latin-400.css'
import '@fontsource/andika/latin-ext-400.css'
import './index.css'
import App from './App.tsx'
import { registerServiceWorker } from './app/serviceWorker'

// PWA / service worker (SPEC §3, leaf F2) : enregistré au démarrage de l'app,
// jamais bloquant (voir src/app/serviceWorker.ts pour la dégradation silencieuse).
registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

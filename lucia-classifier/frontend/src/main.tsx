import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register';

// Registra o Service Worker imediatamente para modo offline
registerSW({ immediate: true });

import './index.css'
import App from './App.tsx'

// Renderização principal do React
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

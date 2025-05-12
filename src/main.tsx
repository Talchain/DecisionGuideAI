// src/main.tsx

// —————————————————————————————————————————————————————————————————————————————
// Dev‐only: Unregister any service workers to avoid Bolt/WebContainer SW stalls
// —————————————————————————————————————————————————————————————————————————————
if (import.meta.env.DEV && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then(registrations => {
      registrations.forEach(reg => {
        console.warn('[SW] Unregistering service worker at scope:', reg.scope)
        reg.unregister()
      })
    })
    .catch(err => {
      console.error('[SW] Error unregistering service workers:', err)
    })
}

import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter as Router } from 'react-router-dom'

import { AuthProvider } from './contexts/AuthContext'
import { GuestProvider } from './contexts/GuestContext'
import { DecisionProvider } from './contexts/DecisionContext'
import { TeamsProvider } from './contexts/TeamsContext'

import App from './App'
import './index.css'

const container = document.getElementById('root')
if (!container) throw new Error('Failed to find root element')

createRoot(container).render(
  <StrictMode>
    <Router>
      <AuthProvider>
        <GuestProvider>
          <TeamsProvider>
            <DecisionProvider>
              <App />
            </DecisionProvider>
          </TeamsProvider>
        </GuestProvider>
      </AuthProvider>
    </Router>
  </StrictMode>
)
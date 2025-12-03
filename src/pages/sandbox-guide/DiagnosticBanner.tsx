/**
 * Diagnostic Banner - Temporary debugging component
 * Shows why guide is/isn't loading
 */

import { useEffect, useState } from 'react'

export function DiagnosticBanner() {
  const [diagnostics, setDiagnostics] = useState({
    envVar: import.meta.env.VITE_COPILOT_ENABLED,
    route: window.location.hash,
    timestamp: new Date().toISOString()
  })

  useEffect(() => {
    console.log('🔍 [DIAGNOSTIC] Guide variant loaded!', {
      envVar: import.meta.env.VITE_COPILOT_ENABLED,
      allEnvVars: import.meta.env,
      route: window.location.hash,
      pathname: window.location.pathname,
      href: window.location.href
    })
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        background: '#10b981',
        color: 'white',
        padding: '12px',
        zIndex: 99999,
        fontFamily: 'monospace',
        fontSize: '12px',
        borderBottom: '3px solid #059669'
      }}
    >
      <strong>✅ GUIDE VARIANT LOADED!</strong>
      <br />
      Route: {diagnostics.route} |
      Env: {diagnostics.envVar} |
      Time: {new Date().toLocaleTimeString()}
    </div>
  )
}

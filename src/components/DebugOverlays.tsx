// Debug overlays for diagnosing pointer event issues
// Enable with VITE_PLOT_DEBUG_OVERLAYS="1"

export default function DebugOverlays() {
  const enabled = String(import.meta.env?.VITE_PLOT_DEBUG_OVERLAYS) === '1'
  
  if (!enabled) return null

  const overlayStyle = {
    position: 'fixed' as const,
    pointerEvents: 'none' as const,
    border: '2px solid',
    zIndex: 99999
  }

  return (
    <>
      {/* Canvas root outline */}
      <div
        style={{
          ...overlayStyle,
          inset: 0,
          borderColor: '#10b981',
          background: 'rgba(16, 185, 129, 0.05)'
        }}
        title="plot-canvas-root (z:10)"
      />
      
      {/* Right rail outline */}
      <div
        style={{
          ...overlayStyle,
          top: 'var(--topbar-h, 56px)',
          right: 0,
          bottom: 0,
          width: '360px',
          borderColor: '#ef4444',
          background: 'rgba(239, 68, 68, 0.1)'
        }}
        title="plot-right-rail (z:20)"
      />
      
      {/* Chrome layer outline */}
      <div
        style={{
          ...overlayStyle,
          inset: 0,
          borderColor: '#f59e0b',
          background: 'rgba(245, 158, 11, 0.05)'
        }}
        title="plot-chrome (z:15)"
      />
      
      {/* Whiteboard layer outline */}
      <div
        style={{
          ...overlayStyle,
          inset: 0,
          borderColor: '#8b5cf6',
          background: 'rgba(139, 92, 246, 0.03)'
        }}
        title="whiteboard-layer (z:1)"
      />
      
      {/* Legend */}
      <div
        style={{
          position: 'fixed',
          bottom: 8,
          left: 8,
          zIndex: 99999,
          background: 'rgba(0,0,0,0.8)',
          color: '#fff',
          padding: '8px 12px',
          borderRadius: 6,
          fontSize: 11,
          fontFamily: 'monospace',
          pointerEvents: 'none'
        }}
      >
        <div style={{ fontWeight: 'bold', marginBottom: 4 }}>DEBUG OVERLAYS</div>
        <div style={{ color: '#10b981' }}>█ canvas-root (z:10)</div>
        <div style={{ color: '#ef4444' }}>█ right-rail (z:20)</div>
        <div style={{ color: '#f59e0b' }}>█ chrome (z:15)</div>
        <div style={{ color: '#8b5cf6' }}>█ whiteboard (z:1)</div>
      </div>
    </>
  )
}

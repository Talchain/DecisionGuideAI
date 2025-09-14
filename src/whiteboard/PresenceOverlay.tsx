import * as React from 'react'
import { usePresence } from '@/sandbox/presence/PresenceProvider'

export function PresenceOverlay({ getEditor }: { getEditor?: () => any }) {
  const { participants, local } = usePresence()
  const editor = getEditor?.()
  const remotes = Object.values(participants).filter(p => p.userId !== local.id)
  // Periodic re-render to reflect time-based idle transitions without transport events
  const [, setTick] = React.useState(0)
  React.useEffect(() => {
    const onTestTick = () => setTick(t => (t + 1) % 1_000_000)
    window.addEventListener('dgai:presence:tick', onTestTick as any)
    const isVitest = typeof import.meta !== 'undefined' && !!(import.meta as any).vitest
    const id = isVitest ? null : (window.setInterval(() => setTick(t => (t + 1) % 1_000_000), 1000) as unknown as number)
    return () => {
      if (id !== null) { try { window.clearInterval(id as unknown as number) } catch {} }
      try { window.removeEventListener('dgai:presence:tick', onTestTick as any) } catch {}
    }
  }, [])

  return (
    <div className="pointer-events-none absolute inset-0 z-[980]" data-dg-presence-overlay>
      {remotes.map(p => (
        <React.Fragment key={p.userId}>
          {p.cursor && (
            <div
              data-testid={`presence-cursor-${p.userId}`}
              aria-label={`Cursor of ${p.name}`}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: p.cursor.x, top: p.cursor.y }}
            >
              {(() => {
                const idle = (Date.now() - (p.ts || 0)) > 45000
                const name = idle ? `${p.name} (idle)` : p.name
                const fadeCls = idle ? 'opacity-50' : ''
                return (
                  <div data-dg-presence={idle ? 'idle' : 'active'} className={`inline-flex items-center ${fadeCls}`} title={idle ? 'Idle' : undefined}>
                    <span className="inline-block w-2.5 h-2.5 rounded-full border border-white shadow" style={{ background: p.color }} title={p.name} />
                    <span className="ml-1 text-[10px] px-1 rounded bg-white/90 border" style={{ borderColor: p.color }}>{name}</span>
                  </div>
                )
              })()}
            </div>
          )}
          {(p.selectionShapeIds || []).map((sid) => {
            let rect: { left: number; top: number; width: number; height: number } | null = null
            try {
              const shp = editor?.getShapeById?.(sid)
              if (shp && typeof shp.x === 'number') {
                const w = (shp.props?.w ?? shp.w ?? 48)
                const h = (shp.props?.h ?? shp.h ?? 24)
                rect = { left: shp.x, top: shp.y, width: w, height: h }
              }
            } catch {}
            return (
              <div
                key={`${p.userId}:${sid}`}
                data-testid={`presence-select-${p.userId}-${sid}`}
                aria-label={`Selection by ${p.name}`}
                className="absolute border-2 border-dashed rounded-sm"
                style={{
                  left: rect?.left ?? 4,
                  top: rect?.top ?? 4,
                  width: rect?.width ?? 12,
                  height: rect?.height ?? 12,
                  borderColor: p.color,
                }}
              />
            )
          })}
        </React.Fragment>
      ))}
    </div>
  )
}

// TEST ONLY: emit a synthetic tick to force PresenceOverlay to re-render time-based states
export function __TEST__presenceOverlayTick() {
  try { window.dispatchEvent(new Event('dgai:presence:tick')) } catch {}
}

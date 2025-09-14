import React from 'react'
import { createPresenceTransport, type PresenceTransport, type PresencePayload } from './service'
import { useTelemetry } from '@/lib/useTelemetry'

export type PresenceUser = { id: string; name: string; color: string }

export type PresenceContextType = {
  local: PresenceUser
  participants: Record<string, PresencePayload>
  updateLocal: (p: { cursor?: { x: number; y: number }; selectionShapeIds?: string[] }) => void
}

const PresenceContext = React.createContext<PresenceContextType | null>(null)

export function usePresence(): PresenceContextType {
  const ctx = React.useContext(PresenceContext)
  if (!ctx) throw new Error('usePresence must be used within PresenceProvider')
  return ctx
}

export function PresenceProvider({
  decisionId,
  user,
  children,
  transport: injected,
  getEditor,
}: {
  decisionId: string
  user: PresenceUser
  children: React.ReactNode
  transport?: PresenceTransport
  getEditor?: () => any
}) {
  const { track } = useTelemetry()
  const transportRef = React.useRef<PresenceTransport>(injected || createPresenceTransport())
  const localRef = React.useRef<PresenceUser>(user)
  const [participants, setParticipants] = React.useState<Record<string, PresencePayload>>({})
  const subsRef = React.useRef<null | (() => void)>(null)
  const disconnectRef = React.useRef<null | (() => void)>(null)
  const rafRef = React.useRef<number | null>(null)
  const cursorLastSentRef = React.useRef<number>(0)
  const pendingCursorRef = React.useRef<{ x: number; y: number } | null>(null)
  const selTimerRef = React.useRef<number | null>(null)
  const lastCursorTelemetryRef = React.useRef<number>(0)
  // Idle/active telemetry state
  const sessionIdRef = React.useRef<string>(Math.random().toString(36).slice(2))
  const lastActivityRef = React.useRef<number>(Date.now())
  const idleTimerRef = React.useRef<number | null>(null)
  const isIdleRef = React.useRef<boolean>(false)
  const lastIdleEmitRef = React.useRef<number>(0)
  const lastActiveEmitRef = React.useRef<number>(0)

  // __TEST__ controls registry
  const TEST_REGISTRY: Map<string, { resetIdleTimer: () => void }> = (globalThis as any).__dgai_presence_test_registry || new Map()
  if (!(globalThis as any).__dgai_presence_test_registry) { (globalThis as any).__dgai_presence_test_registry = TEST_REGISTRY }

  // Join/leave lifecycle
  React.useEffect(() => {
    const t = transportRef.current
    disconnectRef.current = t.connect(decisionId, { userId: user.id, name: user.name, color: user.color } as any)
    // Subscribe
    subsRef.current = t.subscribe((p) => {
      setParticipants(prev => {
        const next = { ...prev, [p.userId]: p }
        return next
      })
    })
    try { track('sandbox_presence_join', { decisionId, route: 'combined' }) } catch {}
    return () => {
      if (subsRef.current) { try { subsRef.current() } catch {}; subsRef.current = null }
      if (disconnectRef.current) { try { disconnectRef.current() } catch {}; disconnectRef.current = null }
      try { track('sandbox_presence_leave', { decisionId, route: 'combined' }) } catch {}
    }
  }, [decisionId, user.id, user.name, user.color, track])

  // Stale cleanup (client-side) every 5s
  React.useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now()
      setParticipants(prev => {
        let changed = false
        const next: Record<string, PresencePayload> = {}
        for (const [uid, p] of Object.entries(prev)) {
          if (now - (p.ts || 0) <= 120000) next[uid] = p
          else changed = true
        }
        return changed ? next : prev
      })
    }, 5000) as unknown as number
    return () => { window.clearInterval(id) }
  }, [])

  // Idle/active detector: listens on document-level activity and emits telemetry (rate-limited)
  React.useEffect(() => {
    const resetIdleTimer = () => {
      const now = Date.now()
      lastActivityRef.current = now
      if (idleTimerRef.current) { try { window.clearTimeout(idleTimerRef.current) } catch {} }
      idleTimerRef.current = window.setTimeout(() => {
        // Transition to idle
        if (!isIdleRef.current) {
          isIdleRef.current = true
          const tNow = Date.now()
          if (!lastIdleEmitRef.current || (tNow - lastIdleEmitRef.current > 60000)) {
            lastIdleEmitRef.current = tNow
            try { track('sandbox_presence_idle', { decisionId, route: 'combined', sessionId: sessionIdRef.current }) } catch {}
          }
        }
      }, 45000) as unknown as number
      // If we were idle, transition to active immediately and rate-limit
      if (isIdleRef.current) {
        const tNow = Date.now()
        if (!lastActiveEmitRef.current || (tNow - lastActiveEmitRef.current > 60000)) {
          lastActiveEmitRef.current = tNow
          try { track('sandbox_presence_active', { decisionId, route: 'combined', sessionId: sessionIdRef.current }) } catch {}
        }
        isIdleRef.current = false
      }
    }
    const onAny = () => resetIdleTimer()
    document.addEventListener('pointermove', onAny, { passive: true })
    document.addEventListener('keydown', onAny)
    document.addEventListener('wheel', onAny, { passive: true })
    document.addEventListener('mousedown', onAny)
    document.addEventListener('focusin', onAny)
    // Start timer initially
    resetIdleTimer()
    // Register test control
    try { TEST_REGISTRY.set(decisionId, { resetIdleTimer }) } catch {}
    return () => {
      document.removeEventListener('pointermove', onAny)
      document.removeEventListener('keydown', onAny)
      document.removeEventListener('wheel', onAny)
      document.removeEventListener('mousedown', onAny)
      document.removeEventListener('focusin', onAny)
      if (idleTimerRef.current) { try { window.clearTimeout(idleTimerRef.current) } catch {}; idleTimerRef.current = null }
      try { TEST_REGISTRY.delete(decisionId) } catch {}
    }
  }, [decisionId, track])


  const publish = React.useCallback((partial: { cursor?: { x: number; y: number }; selectionShapeIds?: string[] }) => {
    const t = transportRef.current
    const base = localRef.current
    const payload: PresencePayload = {
      userId: base.id,
      name: base.name,
      color: base.color,
      cursor: partial.cursor,
      selectionShapeIds: partial.selectionShapeIds,
      ts: Date.now(),
    }
    t.publish(payload)
  }, [])

  const updateLocal = React.useCallback((p: { cursor?: { x: number; y: number }; selectionShapeIds?: string[] }) => {
    // Cursor throttle to <=20Hz; coalesce with rAF
    const now = performance.now()
    if (p.cursor) {
      pendingCursorRef.current = p.cursor
      const since = now - cursorLastSentRef.current
      const send = () => {
        cursorLastSentRef.current = performance.now()
        const cur = pendingCursorRef.current
        pendingCursorRef.current = null
        if (cur) publish({ cursor: cur })
        // Telemetry sample: at most every 2s
        const tNow = Date.now()
        if (tNow - lastCursorTelemetryRef.current > 2000) {
          lastCursorTelemetryRef.current = tNow
          try { track('sandbox_presence_cursor', { decisionId, route: 'combined' }) } catch {}
        }
      }
      if (since >= 50) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        rafRef.current = requestAnimationFrame(() => { rafRef.current = null; send() })
      } else if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => { rafRef.current = null; send() })
      }
    }
    if (p.selectionShapeIds) {
      if (selTimerRef.current) window.clearTimeout(selTimerRef.current)
      selTimerRef.current = window.setTimeout(() => {
        publish({ selectionShapeIds: p.selectionShapeIds })
        try { track('sandbox_presence_select', { decisionId, route: 'combined', count: p.selectionShapeIds?.length || 0 }) } catch {}
      }, 150) as unknown as number
    }
  }, [decisionId, publish, track])

  const value = React.useMemo<PresenceContextType>(() => ({
    local: user,
    participants,
    updateLocal,
  }), [participants, updateLocal, user])

  // Cancel timers on unmount
  React.useEffect(() => {
    return () => {
      if (selTimerRef.current) { try { window.clearTimeout(selTimerRef.current) } catch {}; selTimerRef.current = null }
      if (rafRef.current) { try { cancelAnimationFrame(rafRef.current) } catch {}; rafRef.current = null }
    }
  }, [])

  // Hook into TL editor pointer and selection if provided
  React.useEffect(() => {
    if (!getEditor) return
    const editor = getEditor()
    if (!editor) return
    // Pointer move from window to support full-area overlay
    const onPointer = (e: PointerEvent) => {
      try {
        const screen = { x: e.clientX, y: e.clientY }
        const page = typeof editor.screenToPage === 'function' ? editor.screenToPage(screen) : screen
        updateLocal({ cursor: { x: page.x, y: page.y } })
      } catch {}
    }
    window.addEventListener('pointermove', onPointer, { passive: true })
    // Selection tracking from TL store
    let unsub: null | (() => void) = null
    try {
      const store = editor?.store
      if (store?.listen) {
        unsub = store.listen(() => {
          try {
            const sel = (editor?.getSelectedShapeIds?.() || editor?.getSelectedShapes?.()?.map((s: any) => s.id) || []) as string[]
            if (sel && sel.length >= 0) updateLocal({ selectionShapeIds: sel })
          } catch {}
        }, { scope: 'document' })
      }
    } catch {}
    return () => {
      window.removeEventListener('pointermove', onPointer)
      if (unsub) { try { unsub() } catch {} }
    }
  }, [getEditor, updateLocal])

  return (
    <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>
  )
}

// TEST ONLY: expose a way for tests to trigger idle timer reset deterministically
export function __TEST__getPresenceControls(decisionId: string): { resetIdleTimer: () => void } | undefined {
  const reg: Map<string, { resetIdleTimer: () => void }> = (globalThis as any).__dgai_presence_test_registry || new Map()
  return reg.get(decisionId)
}

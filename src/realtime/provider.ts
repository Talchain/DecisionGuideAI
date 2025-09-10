import * as Y from 'yjs'
import React from 'react'
import { isSandboxRealtimeEnabled } from '@/lib/config'
import { mark } from '@/lib/perf'

export type AwarenessLike = {
  on: (ev: string, cb: (...args: any[]) => void) => void
  off: (ev: string, cb: (...args: any[]) => void) => void
  getLocalState: () => any
  setLocalState: (state: any) => void
  states: Map<number, any>
}

export function computeProviderParams(_boardId: string, token?: string): { url: string; params: Record<string, string> } {
  const testBase = (globalThis as any).__TEST_YJS_BASE_URL__
  const base = testBase || (import.meta as any).env?.VITE_YJS_PROVIDER_URL || (import.meta as any).env?.VITE_REALTIME_WS_URL || 'wss://example.invalid'
  let u: URL
  try { u = new URL(base) } catch { u = new URL('wss://example.invalid') }
  if (token) {
    try { u.searchParams.set('token', token) } catch {}
  }
  const url = u.toString()
  const params: Record<string, string> = {}
  return { url, params }
}

// Redact token for safe logging. Does not mutate the original URL string.
export function maskToken(input: URL | string): string {
  try {
    const u = typeof input === 'string' ? new URL(input) : new URL(input.toString())
    if (u.searchParams.has('token')) {
      u.searchParams.set('token', '***')
    }
    return u.toString()
  } catch {
    return String(input)
  }
}

export type RealtimeConnection = {
  doc: Y.Doc
  awareness: AwarenessLike
  disconnect: () => void
}

// Simple event-based awareness for mock provider
function createMockAwareness(): AwarenessLike {
  const listeners = new Map<string, Set<(...args: any[]) => void>>()
  const local: { state: any } = { state: {} }
  const states = new Map<number, any>()
  const on = (ev: string, cb: (...args: any[]) => void) => {
    if (!listeners.has(ev)) listeners.set(ev, new Set())
    listeners.get(ev)!.add(cb)
  }
  const off = (ev: string, cb: (...args: any[]) => void) => {
    listeners.get(ev)?.delete(cb)
  }
  const emit = (ev: string, ...args: any[]) => {
    listeners.get(ev)?.forEach(cb => cb(...args))
  }
  return {
    on,
    off,
    getLocalState: () => local.state,
    setLocalState: (s: any) => { local.state = s; emit('change', [{ added: [], updated: [], removed: [] }]) },
    states,
  }
}

export async function connect(boardId: string, token?: string): Promise<RealtimeConnection> {
  // Share a single Y.Doc per boardId in mock mode to simulate multi-client sync in tests/dev
  const mockPool: Map<string, { doc: Y.Doc; awareness: AwarenessLike; refs: number }> = (globalThis as any).__OLUMI_MOCK_POOL__ || new Map()
  ;(globalThis as any).__OLUMI_MOCK_POOL__ = mockPool
  // For dev/tests always return mock provider to avoid any network
  if (!import.meta.env.PROD) {
    let entry = mockPool.get(boardId)
    if (!entry) {
      entry = { doc: new Y.Doc(), awareness: createMockAwareness(), refs: 0 }
      mockPool.set(boardId, entry)
    }
    entry.refs += 1
    const disconnect = () => {
      entry!.refs -= 1
      if (entry!.refs <= 0) {
        try { entry!.doc.destroy() } catch {}
        mockPool.delete(boardId)
      }
    }
    return { doc: entry.doc, awareness: entry.awareness, disconnect }
  }
  // In prod, if flag is disabled return local mock as well (no network)
  if (!isSandboxRealtimeEnabled()) {
    let entry = mockPool.get(boardId)
    if (!entry) {
      entry = { doc: new Y.Doc(), awareness: createMockAwareness(), refs: 0 }
      mockPool.set(boardId, entry)
    }
    entry.refs += 1
    const disconnect = () => {
      entry!.refs -= 1
      if (entry!.refs <= 0) {
        try { entry!.doc.destroy() } catch {}
        mockPool.delete(boardId)
      }
    }
    return { doc: entry.doc, awareness: entry.awareness, disconnect }
  }
  // Lazy-import y-websocket if we ever wire a backend; fall back to mock on failure
  try {
    const mod = 'y-websocket'
    // @vite-ignore to prevent pre-transform and resolution in test/dev when module is not present
    const { WebsocketProvider } = await import(/* @vite-ignore */ mod) as any
    const { url, params } = computeProviderParams(boardId, token)
    const doc = new Y.Doc()
    const provider = new WebsocketProvider(url, boardId, doc, { params })
    const awareness = provider.awareness as AwarenessLike
    return {
      doc,
      awareness,
      disconnect: () => { try { provider.destroy() } catch {}; doc.destroy() },
    }
  } catch {
    const doc = new Y.Doc()
    const awareness = createMockAwareness()
    return { doc, awareness, disconnect: () => { doc.destroy() } }
  }
}

// React context for providing a realtime Y.Doc to the sandbox
export const RealtimeDocContext = React.createContext<Y.Doc | null>(null)

export const RealtimeProvider: React.FC<{ decisionId: string; children: React.ReactNode }> = ({ decisionId, children }) => {
  const [doc, setDoc] = React.useState<Y.Doc | null>(null)
  React.useEffect(() => {
    let disposed = false
    let disconnect: (() => void) | null = null
    let snapTimer: number | null = null
    if (!isSandboxRealtimeEnabled()) {
      setDoc(null)
      return () => {}
    }
    ;(async () => {
      const conn = await connect(decisionId)
      if (!disposed) {
        setDoc(conn.doc)
        disconnect = conn.disconnect
      } else {
        conn.disconnect()
      }
    })()
    return () => {
      disposed = true
      if (disconnect) {
        try { disconnect() } catch {}
      }
      if (snapTimer) { try { clearInterval(snapTimer) } catch {} }
    }
  }, [decisionId])
  React.useEffect(() => {
    let timer: number | null = null
    if (doc && isSandboxRealtimeEnabled()) {
      try {
        timer = window.setInterval(() => {
          try { mark('y_snapshot') } catch {}
        }, 30000)
      } catch {}
    }
    return () => { if (timer) { try { clearInterval(timer) } catch {} } }
  }, [doc])
  return React.createElement(RealtimeDocContext.Provider, { value: doc }, children)
}

export function useRealtimeDoc(): Y.Doc | undefined {
  const d = React.useContext(RealtimeDocContext)
  return d ?? undefined
}

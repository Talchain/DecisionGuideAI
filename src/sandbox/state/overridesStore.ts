import React, { createContext, useContext, useMemo, useRef } from 'react'
import type { Graph } from '@/domain/graph'

type OverridesAPI = {
  focusOnNodeId: string | null
  setFocusOn: (id: string | null) => void
  toggleNodeDisabled: (nodeId: string) => void
  hasOverrides: boolean
  version: number
  effectiveGraph: (g: Graph) => Graph
}

const Ctx = createContext<OverridesAPI | null>(null)

export function OverridesProvider({ children }: { children: React.ReactNode }) {
  const focusRef = useRef<string | null>(null)
  const versionRef = useRef(0)
  const value = useMemo<OverridesAPI>(() => ({
    focusOnNodeId: focusRef.current,
    setFocusOn: (id: string | null) => { focusRef.current = id; versionRef.current++ },
    toggleNodeDisabled: (_id: string) => { versionRef.current++ },
    hasOverrides: false,
    get version() { return versionRef.current },
    effectiveGraph: (g: Graph) => g,
  }) as any, [])
  // Provide a stable object; simple stub behavior is sufficient for tests/consumers
  return React.createElement(Ctx.Provider, { value, children })
}

export function useOverrides(): OverridesAPI {
  const v = useContext(Ctx)
  if (!v) throw new Error('useOverrides must be used within OverridesProvider')
  return v
}

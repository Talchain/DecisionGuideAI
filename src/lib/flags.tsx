import React, { createContext, useContext, useMemo } from 'react'

export type SandboxFlags = {
  // Core flags used by Sandbox UI
  sandbox: boolean
  strategyBridge: boolean
  voting: boolean
  realtime: boolean
  deltaReapplyV2: boolean
  // Additional feature flags consumed by UI components
  projections: boolean
  scenarioSnapshots: boolean
  optionHandles: boolean
  decisionCTA: boolean
  sandboxMapping: boolean
  sandboxCompare: boolean
  sandboxAIDraft: boolean
  sandboxScore: boolean
  sandboxPresence: boolean
  sandboxWhatIf: boolean
  sandboxExplain: boolean
  // IO controls and advanced import modes
  sandboxIO: boolean
  sandboxIODnD: boolean
  sandboxTemplates: boolean
}

const defaultFlags: SandboxFlags = {
  sandbox: false,
  strategyBridge: false,
  voting: false,
  realtime: false,
  deltaReapplyV2: false,
  projections: false,
  scenarioSnapshots: false,
  optionHandles: false,
  decisionCTA: false,
  sandboxMapping: false,
  sandboxCompare: false,
  sandboxAIDraft: false,
  sandboxScore: false,
  sandboxPresence: false,
  sandboxWhatIf: false,
  sandboxExplain: false,
  sandboxIO: false,
  sandboxIODnD: false,
  sandboxTemplates: false,
}

const FlagsContext = createContext<SandboxFlags>(defaultFlags)

export function FlagsProvider({ value, children }: { value?: Partial<SandboxFlags>, children: React.ReactNode }) {
  const v = useMemo(() => ({ ...defaultFlags, ...(value || {}) }), [value])
  return <FlagsContext.Provider value={v}>{children}</FlagsContext.Provider>
}

export function useFlags() { return useContext(FlagsContext) }

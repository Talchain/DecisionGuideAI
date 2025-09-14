import * as React from 'react'

// Minimal stub to satisfy imports in CombinedSandboxRoute for surgical IO branch
export function OverridesProvider({ children }: { children: React.ReactNode }) {
  return React.createElement(React.Fragment, null, children)
}

export function useOverrides() {
  return {
    focusOnNodeId: null as string | null,
    setFocusOn: (_id: string | null) => {},
  }
}

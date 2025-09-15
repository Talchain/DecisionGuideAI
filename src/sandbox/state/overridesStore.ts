// TEST-ONLY STUB — remove when real store lands
import * as React from 'react'

export function OverridesProvider({ decisionId, children }: { decisionId?: string; children: React.ReactNode }) {
  void decisionId
  return React.createElement(React.Fragment, null, children)
}

export function useOverrides() {
  return {
    focusOnNodeId: null as string | null,
    setFocusOn: (_id: string | null) => {},
    toggleNodeDisabled: (_id?: string | null) => {},
  }
}

import React from 'react'

export type TldrawProps = {
  persistenceKey?: string
  onMount?: (editor: any) => void
}

export const Tldraw: React.FC<TldrawProps> = ({ onMount }) => {
  const store = {
    loadSnapshot: (_: any) => {},
    getSnapshot: () => ({ shapes: [], bindings: [] }),
    listen: (_cb: () => void) => () => {},
  }
  const editor = { store }
  React.useEffect(() => {
    onMount?.(editor)
  }, [])
  return null
}

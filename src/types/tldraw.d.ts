declare module '@tldraw/tldraw' {
  import * as React from 'react'
  export interface TldrawProps {
    persistenceKey?: string
    onMount?: (editor: any) => void
  }
  export const Tldraw: React.FC<TldrawProps>
}

declare module '@tldraw/tldraw/tldraw.css' {}

/** Test seam: React Flow's edge-label layer for an edge rendered without a whole canvas (EdgeLabelRenderer portals into it). */
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { useStoreApi } from '@xyflow/react'

export function EdgeLabelLayer({ children }: { children: ReactNode }): JSX.Element {
  const api = useStoreApi()
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => { api.setState({ domNode: ref.current }) }, [api])
  return <div ref={ref}><div className="react-flow__edgelabel-renderer" />{children}</div>
}

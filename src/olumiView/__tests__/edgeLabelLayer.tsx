/** Test seam: React Flow's edge and portal scopes for an edge rendered without a whole canvas. */
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { useStoreApi } from '@xyflow/react'

export function EdgeLabelLayer({ children }: { children: ReactNode }): JSX.Element {
  const api = useStoreApi()
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => { api.setState({ domNode: ref.current }) }, [api])
  return <div ref={ref} className="olumi-look"><div className="react-flow__edgelabel-renderer" /><div className="react-flow__edge" tabIndex={0}>{children}</div></div>
}

import { useMemo } from 'react'
import type { Node } from '@xyflow/react'
import { useCanvasStore } from '../store'
import { switchFactorNodes } from '../domain/switchFactors'

/** A reactive display projection, kept outside the model and its mutation/persistence paths. */
type SwitchNode = { id: string; type?: string; data?: Record<string, unknown> }
const EMPTY_NODES: readonly Node[] = []
/** With no argument it projects the store's nodes; otherwise the supplied list, keeping its element type. */
export function useSwitchFactorNodes<T extends SwitchNode = Node>(suppliedNodes?: readonly T[]): T[] {
  const storedNodes = useCanvasStore(s => s.nodes ?? EMPTY_NODES)
  const ceeAnalysisReady = useCanvasStore(s => s.ceeAnalysisReady)
  const servedSwitchFactorIds = useCanvasStore(s => s.servedSwitchFactorIds)
  const nodes = suppliedNodes ?? (storedNodes as readonly SwitchNode[] as readonly T[])
  return useMemo(() => switchFactorNodes(nodes, { ceeAnalysisReady, servedSwitchFactorIds }),
    [nodes, ceeAnalysisReady, servedSwitchFactorIds])
}

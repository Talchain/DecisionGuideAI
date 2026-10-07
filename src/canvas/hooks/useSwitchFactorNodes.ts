import { useMemo } from 'react'
import type { Node } from '@xyflow/react'
import { useCanvasStore } from '../store'
import { switchFactorNodes } from '../domain/switchFactors'

/** A reactive display projection, kept outside the model and its mutation/persistence paths. */
type SwitchNode = { id: string; type?: string; data?: Record<string, unknown> }
const EMPTY_NODES: readonly Node[] = []
export function useSwitchFactorNodes(): Node[]
export function useSwitchFactorNodes<T extends SwitchNode>(suppliedNodes: readonly T[]): T[]
export function useSwitchFactorNodes(suppliedNodes?: readonly SwitchNode[]): SwitchNode[] {
  const storedNodes = useCanvasStore(s => s.nodes ?? EMPTY_NODES)
  const ceeAnalysisReady = useCanvasStore(s => s.ceeAnalysisReady)
  const servedSwitchFactorIds = useCanvasStore(s => s.servedSwitchFactorIds)
  const nodes = suppliedNodes ?? storedNodes
  return useMemo(() => switchFactorNodes(nodes, { ceeAnalysisReady, servedSwitchFactorIds }),
    [nodes, ceeAnalysisReady, servedSwitchFactorIds])
}

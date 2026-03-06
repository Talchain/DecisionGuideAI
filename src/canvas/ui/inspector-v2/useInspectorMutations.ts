/**
 * Inspector v2 — typed mutation hooks
 *
 * All panels use these instead of raw store calls.
 * Single interception point for validate-patch migration.
 */

import { useCallback } from 'react'
import { useCanvasStore } from '../../store'

// ─── Node mutations ────────────────────────────────────────────────
export function useNodeMutations(nodeId: string) {
  const updateNode = useCanvasStore(s => s.updateNode)
  const getNode = useCallback(() => {
    return useCanvasStore.getState().nodes.find(n => n.id === nodeId)
  }, [nodeId])

  const setLabel = useCallback((value: string) => {
    const node = getNode()
    if (!node) return
    const trimmed = value.trim().slice(0, 100)
    if (trimmed && trimmed !== node.data?.label) {
      updateNode(nodeId, { data: { ...node.data, label: trimmed } })
    }
  }, [nodeId, updateNode, getNode])

  const setDescription = useCallback((value: string) => {
    const node = getNode()
    if (!node) return
    const trimmed = value.trim().slice(0, 500)
    if (trimmed !== node.data?.description) {
      updateNode(nodeId, { data: { ...node.data, description: trimmed || undefined } })
    }
  }, [nodeId, updateNode, getNode])

  const setThreshold = useCallback((raw: number, unit: string) => {
    const node = getNode()
    if (!node) return
    updateNode(nodeId, {
      data: {
        ...node.data,
        goal_threshold_raw: raw,
        goal_threshold_unit: unit,
      },
    })
  }, [nodeId, updateNode, getNode])

  const setObservedValue = useCallback((value: number) => {
    const node = getNode()
    if (!node) return
    const existing = (node.data as Record<string, unknown>)?.observedState as Record<string, unknown> | undefined
    updateNode(nodeId, {
      data: {
        ...node.data,
        observedState: { ...existing, value },
      },
    })
  }, [nodeId, updateNode, getNode])

  const setIntervention = useCallback((factorId: string, value: number) => {
    const node = getNode()
    if (!node) return
    const existing = (node.data as Record<string, unknown>)?.interventions as Record<string, number> | undefined
    updateNode(nodeId, {
      data: {
        ...node.data,
        interventions: { ...existing, [factorId]: value },
      },
    })
  }, [nodeId, updateNode, getNode])

  const removeIntervention = useCallback((factorId: string) => {
    const node = getNode()
    if (!node) return
    const existing = { ...((node.data as Record<string, unknown>)?.interventions as Record<string, number> | undefined) }
    delete existing[factorId]
    updateNode(nodeId, {
      data: {
        ...node.data,
        interventions: existing,
      },
    })
  }, [nodeId, updateNode, getNode])

  const setPriorRange = useCallback((min: number, max: number) => {
    const node = getNode()
    if (!node) return
    const existing = (node.data as Record<string, unknown>)?.prior as Record<string, unknown> | undefined
    updateNode(nodeId, {
      data: {
        ...node.data,
        prior: { ...existing, range_min: min, range_max: max },
      },
    })
  }, [nodeId, updateNode, getNode])

  return { setLabel, setDescription, setThreshold, setObservedValue, setIntervention, removeIntervention, setPriorRange }
}

// ─── Edge mutations ────────────────────────────────────────────────
export function useEdgeMutations(edgeId: string) {
  const updateEdge = useCanvasStore(s => s.updateEdge)
  const getEdge = useCallback(() => {
    return useCanvasStore.getState().edges.find(e => e.id === edgeId)
  }, [edgeId])

  const setStrength = useCallback((mean: number) => {
    const edge = getEdge()
    if (!edge) return
    const absWeight = Math.abs(mean)
    const direction = mean >= 0 ? 'positive' : 'negative'
    updateEdge(edgeId, { data: { ...edge.data, weight: absWeight, direction } })
  }, [edgeId, updateEdge, getEdge])

  const setStd = useCallback((std: number) => {
    const edge = getEdge()
    if (!edge) return
    updateEdge(edgeId, { data: { ...edge.data, strengthStd: std } })
  }, [edgeId, updateEdge, getEdge])

  const setExistsProbability = useCallback((ep: number) => {
    const edge = getEdge()
    if (!edge) return
    updateEdge(edgeId, { data: { ...edge.data, beliefExists: ep } })
  }, [edgeId, updateEdge, getEdge])

  const setLabel = useCallback((value: string) => {
    const edge = getEdge()
    if (!edge) return
    updateEdge(edgeId, { data: { ...edge.data, label: value || undefined } })
  }, [edgeId, updateEdge, getEdge])

  return { setStrength, setStd, setExistsProbability, setLabel }
}

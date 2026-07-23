/**
 * Inspector v2 — typed mutation hooks
 *
 * All panels use these instead of raw store calls.
 * Single interception point for validate-patch migration.
 */

import { useCallback } from 'react'
import { useCanvasStore } from '../../store'
import type { RiskImpact } from '../../domain/nodes'

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
    // Cast to `unknown` (not `number`) — existing intervention map may contain
    // V3 objects ({ value, source, ... }) under other keys. The spread below
    // preserves heterogeneous values; downstream display paths route every
    // read through `unwrapInterventionValue` (see labelUtils.ts).
    const existing = (node.data as Record<string, unknown>)?.interventions as Record<string, unknown> | undefined
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
    const existing = { ...((node.data as Record<string, unknown>)?.interventions as Record<string, unknown> | undefined) }
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

  // ── observedState sub-field mutations ──

  const setObservedField = useCallback((field: string, val: unknown) => {
    const node = getNode()
    if (!node) return
    const existing = (node.data as Record<string, unknown>)?.observedState as Record<string, unknown> | undefined
    updateNode(nodeId, {
      data: { ...node.data, observedState: { ...existing, [field]: val } },
    })
  }, [nodeId, updateNode, getNode])

  const setObservedRawValue = useCallback((v: number) => setObservedField('raw_value', v), [setObservedField])
  const setObservedUnit = useCallback((v: string) => setObservedField('unit', v || undefined), [setObservedField])
  const setObservedCap = useCallback((v: number) => setObservedField('cap', v), [setObservedField])
  const setObservedBaseline = useCallback((v: number) => setObservedField('baseline', v), [setObservedField])
  const setObservedStd = useCallback((v: number) => setObservedField('std', v), [setObservedField])
  const setObservedSource = useCallback((v: string) => setObservedField('source', v || undefined), [setObservedField])

  // ── classification mutations ──

  const setCategory = useCallback((category: 'controllable' | 'observable' | 'external') => {
    const node = getNode()
    if (!node) return
    updateNode(nodeId, { data: { ...node.data, category } })
  }, [nodeId, updateNode, getNode])

  const setExtractionType = useCallback((extractionType: 'explicit' | 'inferred') => {
    const node = getNode()
    if (!node) return
    updateNode(nodeId, { data: { ...node.data, extractionType } })
  }, [nodeId, updateNode, getNode])

  const setFactorType = useCallback((factor_type: string) => {
    const node = getNode()
    if (!node) return
    updateNode(nodeId, { data: { ...node.data, factor_type: factor_type || undefined } })
  }, [nodeId, updateNode, getNode])

  // ── normalisation range ──

  const setStateSpaceRange = useCallback((min: number, max: number) => {
    const node = getNode()
    if (!node) return
    const existing = (node.data as Record<string, unknown>)?.state_space as Record<string, unknown> | undefined
    const range = (existing?.range as Record<string, unknown>) ?? {}
    updateNode(nodeId, {
      data: { ...node.data, state_space: { ...existing, range: { ...range, min, max } } },
    })
  }, [nodeId, updateNode, getNode])

  // ── uncertainty drivers ──

  const setUncertaintyDrivers = useCallback((drivers: string[]) => {
    const node = getNode()
    if (!node) return
    updateNode(nodeId, { data: { ...node.data, uncertainty_drivers: drivers } })
  }, [nodeId, updateNode, getNode])

  // ── goal cap ──

  const setGoalCap = useCallback((cap: number) => {
    const node = getNode()
    if (!node) return
    updateNode(nodeId, { data: { ...node.data, goal_threshold_cap: cap } })
  }, [nodeId, updateNode, getNode])

  // ── risk probability × impact (P1.7) ──
  // Canonical scales (RiskNodeDataSchema): probability is a 0-1 number, impact is
  // the RiskImpact enum. Callers pass values already on those scales — the panel
  // owns any percentage↔decimal conversion. The clamp here is defensive
  // normalisation only (same class as the observed/belief clamps).

  const setProbability = useCallback((probability: number) => {
    const node = getNode()
    if (!node) return
    if (Number.isNaN(probability)) return
    const clamped = Math.min(1, Math.max(0, probability))
    updateNode(nodeId, { data: { ...node.data, probability: clamped } })
  }, [nodeId, updateNode, getNode])

  const setImpact = useCallback((impact: RiskImpact) => {
    const node = getNode()
    if (!node) return
    updateNode(nodeId, { data: { ...node.data, impact } })
  }, [nodeId, updateNode, getNode])

  return {
    setLabel, setDescription, setThreshold, setObservedValue,
    setIntervention, removeIntervention, setPriorRange,
    setObservedRawValue, setObservedUnit, setObservedCap,
    setObservedBaseline, setObservedStd, setObservedSource,
    setCategory, setExtractionType, setFactorType,
    setStateSpaceRange, setUncertaintyDrivers, setGoalCap,
    setProbability, setImpact,
  }
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

  const setDirection = useCallback((direction: 'positive' | 'negative') => {
    const edge = getEdge()
    if (!edge) return
    updateEdge(edgeId, { data: { ...edge.data, direction } })
  }, [edgeId, updateEdge, getEdge])

  return { setStrength, setStd, setExistsProbability, setLabel, setDirection }
}

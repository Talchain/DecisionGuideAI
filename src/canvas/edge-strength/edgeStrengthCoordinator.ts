/**
 * Canonical edge-strength edit coordinator.
 *
 * One scenario-scoped state machine owns debounce, first-before/latest-after
 * coalescing, transport dispatch, authoritative receipt validation, optimistic
 * reconciliation and the Run barrier. It deliberately uses the conversation
 * sender supplied by `useGraphEditEvents`; it is not a second HTTP client or a
 * second graph writer.
 */

import type { BoundaryError, OlumiResponse } from '@talchain/schemas/boundary'
import { GraphV3Schema } from '@talchain/schemas'
import type { Edge } from '@xyflow/react'

import type { WireSystemEvent } from '../conversation/types'
import type { EdgeData } from '../domain/edges'
import {
  EMPTY_EDGE_STRENGTH_SYNC,
  useCanvasStore,
  type EdgeStrengthRecoverySummary,
  type EdgeStrengthRecoverySummaryKind,
  type EdgeStrengthSyncIssue,
} from '../store'
import { normaliseV5AnalysisReady } from '../../v5/applyV5State'
import {
  canvasAnalyticallyMatchesCanonicalGraph,
  reconcileCanvasWithCanonicalGraph,
  type CanonicalEdgeFieldProtection,
  type CanonicalGraphReconciliationResult,
  type CanonicalNodeFieldProtection,
} from './graphAuthority'

export const EDGE_STRENGTH_DEBOUNCE_MS = 1500

export type EffectDirection = 'positive' | 'negative'

export interface EdgeStrengthTuple {
  mean: number
  effectDirection: EffectDirection
  std?: number
}

export interface EdgeStrengthObservation {
  edgeId: string
  from: string
  to: string
  tuple: EdgeStrengthTuple
  data: Record<string, unknown>
}

export interface EdgeStrengthAttempt {
  id: string
  scenarioId: string
  edgeId: string
  from: string
  to: string
  expected: EdgeStrengthTuple
  target: EdgeStrengthTuple
  directionIntent: 'preserve' | EffectDirection
  intent: 'set' | 'confirm_current'
  localRevision: number
  scenarioRevision: number
  graphHashBefore: string | null
  graphHashAtRunBefore: string | null
  freshnessBefore: 'fresh' | 'stale' | 'unknown' | 'none' | null
}

export interface CanonicalEdgeReadback extends EdgeStrengthTuple {
  existsProbability?: number
  provenanceSource: 'user_specified'
  provenanceDisplay: 'user_set'
}

export type EdgeStrengthReceiptVerdict =
  | {
      kind: 'applied'
      readback: CanonicalEdgeReadback
      graphHash: string
      freshness: 'fresh' | 'stale' | 'unknown' | 'none'
      graphHashAtRun: string | null
      analysisReady: Record<string, unknown>
      draftGraph: Record<string, unknown>
    }
  | { kind: 'invalid'; reason: string }

export type EdgeStrengthSender = (
  event: WireSystemEvent,
  attemptId: string,
) => Promise<'send_deferred' | 'send_blocked' | undefined>

interface PendingEdit {
  scenarioId: string
  edgeId: string
  from: string
  to: string
  expected: EdgeStrengthTuple
  target: EdgeStrengthTuple
  directionIntent: 'preserve' | EffectDirection
  intent: 'set' | 'confirm_current'
  localRevision: number
}

export interface EdgeStrengthRecoveryRecord {
  cause: 'conflict' | 'conflict_refresh_required' | 'unconfirmed'
  edgeId: string
  from: string
  to: string
  expected: EdgeStrengthTuple
  attempted: EdgeStrengthTuple
  sharedCurrent?: EdgeStrengthTuple
  at: number
}

export type EdgeStrengthEndpointStatus =
  | { kind: 'idle' }
  | { kind: 'queued' | 'saving'; edgeId: string }
  | { kind: 'saved' | 'confirmed' | 'shared_value_refreshed'; at: number; edgeId: string }
  | { kind: 'conflict' | 'unconfirmed'; recovery: EdgeStrengthRecoveryRecord }

interface ScenarioLane {
  pending: Map<string, PendingEdit>
  active: EdgeStrengthAttempt | null
  issues: Map<string, EdgeStrengthSyncIssue>
  issueEndpoints: Map<string, IssueEndpoint>
  conflictCurrent: Map<string, EdgeStrengthTuple>
  recoveries: Map<string, EdgeStrengthRecoveryRecord>
  unsupportedRevisions: Map<string, number>
  hydration: 'idle' | 'pending' | 'settled' | 'unconfirmed'
  lastHydratedRevision: number | null
  lastOutcome: {
    kind: 'saved' | 'confirmed' | 'shared_value_refreshed' | 'review_required'
    edgeId: string
    from: string
    to: string
    at: number
  } | null
  waiters: Set<(result: EdgeStrengthFlushResult) => void>
}

interface IssueEndpoint {
  from: string
  to: string
}

export interface EdgeStrengthFlushResult {
  ok: boolean
  reason?: string
}

const lanes = new Map<string, ScenarioLane>()
const scenarioRevisions = new Map<string, number>()
const pairRevisions = new Map<string, number>()
let openScenarioId: string | null = null
let sender: EdgeStrengthSender | null = null
let senderOwner: symbol | null = null
type EdgeStrengthAuthorityRefresher = (
  scenarioId: string,
  opts?: { replaceLocalGraph?: boolean },
) => Promise<boolean>
let authorityRefresher: EdgeStrengthAuthorityRefresher | null = null
let authorityRefresherOwner: symbol | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let blockedRetryTimer: ReturnType<typeof setTimeout> | null = null
let publishedRevision = 0

const issuePriority: readonly EdgeStrengthSyncIssue[] = [
  'unconfirmed',
  'conflict',
  'unsupported_fields',
  'unsupported_value',
  'unconfirmed_structure',
]

function laneFor(scenarioId: string): ScenarioLane {
  let lane = lanes.get(scenarioId)
  if (!lane) {
    lane = {
      pending: new Map(),
      active: null,
      issues: new Map(),
      issueEndpoints: new Map(),
      conflictCurrent: new Map(),
      recoveries: new Map(),
      unsupportedRevisions: new Map(),
      hydration: 'idle',
      lastHydratedRevision: null,
      lastOutcome: null,
      waiters: new Set(),
    }
    lanes.set(scenarioId, lane)
  }
  return lane
}

const EDGE_STRENGTH_RECOVERY_SUMMARY_LIMIT = 3

function setIssue(
  lane: ScenarioLane,
  key: string,
  issue: EdgeStrengthSyncIssue,
  endpoint: IssueEndpoint,
): void {
  lane.issues.set(key, issue)
  lane.issueEndpoints.set(key, endpoint)
}

function clearIssue(lane: ScenarioLane, key: string): void {
  lane.issues.delete(key)
  lane.issueEndpoints.delete(key)
}

function recoverySummaryFor(lane: ScenarioLane): EdgeStrengthRecoverySummary {
  const byPair = new Map<string, {
    from: string
    to: string
    kind: EdgeStrengthRecoverySummaryKind
    order: number
  }>()
  let order = 0
  const add = (from: string, to: string, kind: EdgeStrengthRecoverySummaryKind): void => {
    if (!validEndpointId(from) || !validEndpointId(to)) return
    const key = pairKey(from, to)
    if (!byPair.has(key)) byPair.set(key, { from, to, kind, order: order++ })
  }

  // Sticky issues are the most actionable blockers and therefore lead the
  // bounded list. Multiple unsupported fields on one endpoint collapse to one
  // relationship instead of leaking the coordinator's internal issue keys.
  for (const issue of issuePriority) {
    for (const [key, candidate] of lane.issues) {
      if (candidate !== issue) continue
      const endpoint = lane.issueEndpoints.get(key)
      const recovery = lane.recoveries.get(key)
      if (endpoint) add(endpoint.from, endpoint.to, issue)
      else if (recovery) add(recovery.from, recovery.to, issue)
    }
  }
  if (lane.active) add(lane.active.from, lane.active.to, 'saving')
  for (const pending of lane.pending.values()) add(pending.from, pending.to, 'queued')

  const canvas = useCanvasStore.getState()
  const labels = new Map(canvas.nodes.flatMap((node) => {
    const label = (node.data as { label?: unknown } | undefined)?.label
    return typeof label === 'string' && label.trim().length > 0
      ? [[node.id, label.trim()] as const]
      : []
  }))
  const graphEdges = canvas.edges
  const all = [...byPair.values()]
    .sort((a, b) => a.order - b.order)
    .map(({ from, to, kind }) => {
      const fromLabel = labels.get(from) ?? from
      const toLabel = labels.get(to) ?? to
      return {
        from,
        to,
        label: `${fromLabel} → ${toLabel}`,
        kind,
        relationshipExists: graphEdges.filter(
          (edge) => edge.source === from && edge.target === to,
        ).length === 1,
      }
    })
  const items = all.slice(0, EDGE_STRENGTH_RECOVERY_SUMMARY_LIMIT)
  return { items, total: all.length, remaining: all.length - items.length }
}

function pairKey(from: string, to: string): string {
  return `${from}\u0000${to}`
}

function currentIssue(lane: ScenarioLane): EdgeStrengthSyncIssue | null {
  for (const candidate of issuePriority) {
    if ([...lane.issues.values()].includes(candidate)) return candidate
  }
  return null
}

function runReason(issue: EdgeStrengthSyncIssue | null, queued: number, inFlight: number): string | undefined {
  switch (issue) {
    case 'conflict':
      return 'This relationship changed elsewhere. Review the latest shared value, then try your change again.'
    case 'unconfirmed':
      return 'We could not verify that this relationship change was saved. Refresh the model before running analysis.'
    case 'unsupported_fields':
      return 'Relationship likelihood or uncertainty changed locally, but analysis cannot verify those fields yet. Restore the shared value before running analysis.'
    case 'unsupported_value':
      return 'This relationship strength is outside the range the shared analysis model can verify. Choose a value from 0 to 1.'
    case 'unconfirmed_structure':
      return 'A relationship was added, removed, or reconnected only on this device. Check the shared model before running analysis.'
    default:
      return queued > 0 || inFlight > 0
        ? 'Wait for this relationship to finish saving before running analysis.'
        : undefined
  }
}

function resultFor(lane: ScenarioLane): EdgeStrengthFlushResult | null {
  if (lane.active !== null) return null
  const issue = currentIssue(lane)
  if (issue !== null) return { ok: false, reason: runReason(issue, lane.pending.size, 0) }
  if (lane.pending.size > 0) return null
  if (lane.hydration === 'idle' || lane.hydration === 'pending') {
    return { ok: false, reason: 'Checking the shared model before analysis…' }
  }
  if (lane.hydration === 'unconfirmed') {
    return { ok: false, reason: 'We could not verify which shared model analysis would use. Check the shared model before analysing.' }
  }
  return { ok: true }
}

function publish(scenarioId: string, opts: { settleWaiters?: boolean } = {}): void {
  const lane = laneFor(scenarioId)
  const issue = currentIssue(lane)
  if (openScenarioId === scenarioId) {
    useCanvasStore.getState().setEdgeStrengthSync({
      scenarioId,
      revision: ++publishedRevision,
      hydration: lane.hydration,
      queued: lane.pending.size,
      inFlight: lane.active === null ? 0 : 1,
      issue,
      recoverySummary: recoverySummaryFor(lane),
      lastOutcome: lane.lastOutcome,
    })
  }
  if (opts.settleWaiters === false) return
  const terminal = resultFor(lane)
  if (terminal) {
    for (const resolve of lane.waiters) resolve(terminal)
    lane.waiters.clear()
  }
}

function bumpRevision(scenarioId: string, endpointKey?: string): number {
  scenarioRevisions.set(scenarioId, (scenarioRevisions.get(scenarioId) ?? 0) + 1)
  if (!endpointKey) return scenarioRevisions.get(scenarioId)!
  const scoped = `${scenarioId}\u0000${endpointKey}`
  const next = (pairRevisions.get(scoped) ?? 0) + 1
  pairRevisions.set(scoped, next)
  return next
}

export function getEdgeStrengthEditRevision(scenarioId: string): number {
  return scenarioRevisions.get(scenarioId) ?? 0
}

export function beginEdgeStrengthHydration(scenarioId: string): number {
  const lane = laneFor(scenarioId)
  lane.hydration = 'pending'
  publish(scenarioId)
  return getEdgeStrengthEditRevision(scenarioId)
}

export function edgeStrengthHydrationCanApply(
  scenarioId: string,
  startedAtRevision: number,
): boolean {
  const lane = laneFor(scenarioId)
  return getEdgeStrengthEditRevision(scenarioId) === startedAtRevision &&
    lane.active === null &&
    (lane.pending.size === 0 || currentIssue(lane) !== null)
}

export function finishEdgeStrengthHydration(args: {
  scenarioId: string
  startedAtRevision: number
  usable: boolean
}): void {
  const lane = laneFor(args.scenarioId)
  if (!edgeStrengthHydrationCanApply(args.scenarioId, args.startedAtRevision)) {
    // A strict writer receipt may already have supplied newer full-graph
    // authority. Never downgrade it because an older boot read finished late.
    if (lane.hydration !== 'settled') lane.hydration = 'unconfirmed'
  } else if (args.usable) {
    const recoveries = [...lane.recoveries.values()]
    lane.hydration = 'settled'
    lane.lastHydratedRevision = args.startedAtRevision
    lane.pending.clear()
    lane.issues.clear()
    lane.issueEndpoints.clear()
    lane.conflictCurrent.clear()
    lane.recoveries.clear()
    lane.unsupportedRevisions.clear()
    lane.lastOutcome = recoveries.length === 1 ? {
      kind: 'shared_value_refreshed',
      edgeId: recoveries[0]!.edgeId,
      from: recoveries[0]!.from,
      to: recoveries[0]!.to,
      at: Date.now(),
    } : null
  } else {
    lane.hydration = 'unconfirmed'
  }
  publish(args.scenarioId)
}

function getPairRevision(scenarioId: string, endpointKey: string): number {
  return pairRevisions.get(`${scenarioId}\u0000${endpointKey}`) ?? 0
}

export function setOpenEdgeStrengthScenario(scenarioId: string | null): void {
  if (openScenarioId === scenarioId) return
  const previousScenarioId = openScenarioId
  if (previousScenarioId) {
    const previous = lanes.get(previousScenarioId)
    if (previous) {
      for (const resolve of previous.waiters) {
        resolve({ ok: false, reason: 'The open scenario changed. Analysis has not started.' })
      }
      previous.waiters.clear()
    }
  }
  openScenarioId = scenarioId
  if (debounceTimer) clearTimeout(debounceTimer)
  if (blockedRetryTimer) clearTimeout(blockedRetryTimer)
  debounceTimer = null
  blockedRetryTimer = null
  if (scenarioId === null) {
    useCanvasStore.getState().setEdgeStrengthSync(EMPTY_EDGE_STRENGTH_SYNC)
    return
  }
  publish(scenarioId)
  scheduleDispatch()
}

export function registerEdgeStrengthSender(next: EdgeStrengthSender): () => void {
  const owner = Symbol('edge-strength-sender')
  senderOwner = owner
  sender = next
  scheduleDispatch()
  return () => {
    if (senderOwner !== owner) return
    senderOwner = null
    sender = null
  }
}

/** Register the existing authenticated server-graph reader as recovery owner. */
export function registerEdgeStrengthAuthorityRefresher(
  next: EdgeStrengthAuthorityRefresher,
): () => void {
  const owner = Symbol('edge-strength-authority-refresher')
  authorityRefresherOwner = owner
  authorityRefresher = next
  return () => {
    if (authorityRefresherOwner !== owner) return
    authorityRefresherOwner = null
    authorityRefresher = null
  }
}

/** Explicit read/reconcile action. It never replays a rejected or uncertain write. */
export async function refreshEdgeStrengthAuthority(
  scenarioId: string,
  opts?: { replaceLocalGraph?: boolean },
): Promise<boolean> {
  if (
    !authorityRefresher ||
    openScenarioId !== scenarioId ||
    useCanvasStore.getState().currentScenarioId !== scenarioId
  ) return false
  return await authorityRefresher(scenarioId, opts)
}

export function notifyEdgeStrengthTransportAvailable(): void {
  if (blockedRetryTimer) {
    clearTimeout(blockedRetryTimer)
    blockedRetryTimer = null
  }
  void dispatchNext()
}

function validEndpointId(value: string): boolean {
  return value.length > 0 &&
    value === value.trim() &&
    !value.includes('→') &&
    !value.includes('->')
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function direction(value: unknown): EffectDirection | null {
  return value === 'positive' || value === 'negative' ? value : null
}

export function observeEdgeStrength(edge: Pick<Edge<EdgeData>, 'id' | 'source' | 'target' | 'data'>): EdgeStrengthObservation | null {
  const data = (edge.data ?? {}) as Record<string, unknown>
  const magnitude = finiteNumber(data.weight)
  const effectDirection = direction(data.direction)
  if (
    magnitude === null || effectDirection === null || magnitude < 0 ||
    !validEndpointId(edge.source) || !validEndpointId(edge.target)
  ) return null
  const std = finiteNumber(data.strengthStd)
  return {
    edgeId: edge.id,
    from: edge.source,
    to: edge.target,
    tuple: {
      mean: magnitude === 0 ? 0 : effectDirection === 'negative' ? -magnitude : magnitude,
      effectDirection,
      ...(std !== null && data.strengthStdSource === 'cee' ? { std } : {}),
    },
    data,
  }
}

function tupleScientificEqual(a: EdgeStrengthTuple, b: EdgeStrengthTuple): boolean {
  return a.mean === b.mean && a.effectDirection === b.effectDirection
}

function eventFromAttempt(attempt: EdgeStrengthAttempt): WireSystemEvent {
  return {
    type: 'edge_strength_edit',
    payload: {
      from: attempt.from,
      to: attempt.to,
      magnitude: Math.abs(attempt.target.mean),
      direction_intent: attempt.directionIntent,
      expected: {
        mean: attempt.expected.mean,
        effect_direction: attempt.expected.effectDirection,
      },
      intent: attempt.intent,
    },
  }
}

function userConfirmationChanged(before: EdgeStrengthObservation, after: EdgeStrengthObservation): boolean {
  if (!tupleScientificEqual(before.tuple, after.tuple)) return false
  const keys = ['weightSource', 'directionSource', 'provenanceDisplay', 'userReviewedStrength'] as const
  return keys.some((key) => before.data[key] !== after.data[key]) &&
    (after.data.weightSource === 'user' ||
      after.data.provenanceDisplay === 'user_set' ||
      after.data.userReviewedStrength === true)
}

/** Record one local strength/direction mutation immediately after the store write. */
export function recordEdgeStrengthMutation(args: {
  scenarioId: string
  before: EdgeStrengthObservation
  after: EdgeStrengthObservation
}): void {
  const { scenarioId, before, after } = args
  const lane = laneFor(scenarioId)
  const key = pairKey(after.from, after.to)
  const revision = bumpRevision(scenarioId, key)

  if (
    before.from !== after.from ||
    before.to !== after.to ||
    Math.abs(after.tuple.mean) > 1
  ) {
    setIssue(lane, key, 'unsupported_value', {
      from: after.from,
      to: after.to,
    })
    lane.lastOutcome = null
    publish(scenarioId)
    return
  }

  const endpointMatches = useCanvasStore.getState().edges.filter(
    (edge) => edge.source === after.from && edge.target === after.to,
  )
  if (endpointMatches.length !== 1) {
    setIssue(lane, key, 'conflict', {
      from: after.from,
      to: after.to,
    })
    lane.recoveries.set(key, {
      cause: 'conflict_refresh_required',
      edgeId: after.edgeId,
      from: after.from,
      to: after.to,
      expected: before.tuple,
      attempted: after.tuple,
      at: Date.now(),
    })
    lane.lastOutcome = null
    publish(scenarioId)
    return
  }

  const isConfirmation = userConfirmationChanged(before, after)
  if (tupleScientificEqual(before.tuple, after.tuple) && !isConfirmation) return

  // A new edit can clear a tuple conflict only when the exact current tuple was
  // authoritatively applied to the canvas first. Ambiguous delivery remains a
  // hard hold: there is no truthful expected base for another write.
  const priorIssue = lane.issues.get(key)
  if (priorIssue === 'unconfirmed') {
    const recovery = lane.recoveries.get(key)
    if (recovery) {
      lane.recoveries.set(key, { ...recovery, attempted: after.tuple, at: Date.now() })
    }
    publish(scenarioId)
    return
  }
  if (priorIssue === 'conflict' && !lane.conflictCurrent.has(key)) {
    const recovery = lane.recoveries.get(key)
    if (recovery) {
      lane.recoveries.set(key, { ...recovery, attempted: after.tuple, at: Date.now() })
    }
    publish(scenarioId)
    return
  }
  clearIssue(lane, key)
  lane.recoveries.delete(key)
  lane.lastOutcome = null

  const activeForPair = lane.active && pairKey(lane.active.from, lane.active.to) === key
    ? lane.active
    : null
  const existing = lane.pending.get(key)
  const expected = existing?.expected ?? activeForPair?.target ?? before.tuple
  const target = after.tuple
  const returnsToExpected = tupleScientificEqual(expected, target)
  const directionIntent =
    isConfirmation || returnsToExpected || before.tuple.effectDirection === target.effectDirection
      ? 'preserve'
      : target.effectDirection

  lane.pending.set(key, {
    scenarioId,
    edgeId: after.edgeId,
    from: after.from,
    to: after.to,
    expected,
    target,
    directionIntent,
    intent: isConfirmation || returnsToExpected ? 'confirm_current' : 'set',
    localRevision: revision,
  })
  if (!isConfirmation) useCanvasStore.getState().markAnalysisFreshnessDirty()
  publish(scenarioId)
  scheduleDispatch()
}

/** Track 0.42-unsupported uncertainty edits so canonical Run cannot bless them. */
export function recordUnsupportedEdgeMutation(args: {
  scenarioId: string
  edgeId: string
  from: string
  to: string
  field: 'strengthStd' | 'beliefExists' | 'belief' | 'beliefStrength' | 'confidence' | 'exists_probability'
  before: unknown
  after: unknown
}): void {
  const { scenarioId, edgeId, from, to, field } = args
  const revision = bumpRevision(scenarioId)
  const lane = laneFor(scenarioId)
  const key = `${edgeId}:${field}`
  if (JSON.stringify(args.before) === JSON.stringify(args.after)) return
  setIssue(lane, key, 'unsupported_fields', { from, to })
  lane.unsupportedRevisions.set(key, revision)
  lane.lastOutcome = null
  useCanvasStore.getState().markAnalysisFreshnessDirty()
  publish(scenarioId)
}

/**
 * A contested-edge adjudication is persisted as an `edge_adjudication` fact,
 * not as an `adjust_edge_strength` graph write. When that fact also changes
 * the locally displayed strength (accept pass 2 / override), keep the two
 * contracts separate: do not silently emit a second value writer, and do not
 * let canonical Run imply that the local value reached the shared graph.
 */
export function recordUnconfirmedAdjudicatedEdgeStrength(args: {
  scenarioId: string
  before: EdgeStrengthObservation
  after: EdgeStrengthObservation
}): void {
  const { scenarioId, before, after } = args
  const lane = laneFor(scenarioId)
  const key = pairKey(after.from, after.to)
  bumpRevision(scenarioId, key)
  lane.pending.delete(key)
  setIssue(lane, key, 'unconfirmed', {
    from: after.from,
    to: after.to,
  })
  lane.conflictCurrent.delete(key)
  lane.recoveries.set(key, {
    cause: 'unconfirmed',
    edgeId: after.edgeId,
    from: after.from,
    to: after.to,
    expected: before.tuple,
    attempted: after.tuple,
    at: Date.now(),
  })
  lane.lastOutcome = null
  useCanvasStore.getState().markAnalysisFreshnessDirty()
  publish(scenarioId)
}

/** Structural edge edits have no canonical writer in the 0.42 transport. */
export function recordUnconfirmedEdgeStructure(args: {
  scenarioId: string
  edgeId: string
  from: string
  to: string
  operation: 'add' | 'remove' | 'reconnect'
}): void {
  const lane = laneFor(args.scenarioId)
  const revision = bumpRevision(args.scenarioId)
  const key = `${args.edgeId}:structure`
  setIssue(lane, key, 'unconfirmed_structure', {
    from: args.from,
    to: args.to,
  })
  lane.unsupportedRevisions.set(key, revision)
  lane.lastOutcome = null
  useCanvasStore.getState().markAnalysisFreshnessDirty()
  publish(args.scenarioId)
}

/** Reject an unencodable local strength write and restore only its strength fields. */
export function rejectInvalidEdgeStrengthMutation(args: {
  scenarioId: string
  edgeId: string
  beforeEdge: Edge<EdgeData>
}): void {
  const { scenarioId, edgeId, beforeEdge } = args
  const key = pairKey(beforeEdge.source, beforeEdge.target)
  bumpRevision(scenarioId, key)
  const lane = laneFor(scenarioId)
  lane.pending.delete(key)
  const prior = observeEdgeStrength(beforeEdge)
  if (prior && Math.abs(prior.tuple.mean) <= 1) clearIssue(lane, key)
  else setIssue(lane, key, 'unsupported_value', {
    from: beforeEdge.source,
    to: beforeEdge.target,
  })
  lane.lastOutcome = null
  const store = useCanvasStore.getState()
  store.beginExternalGraphMutation('patch_apply')
  try {
    useCanvasStore.setState((state) => ({
      edges: state.edges.map((edge) => {
        if (edge.id !== edgeId) return edge
        const beforeData = beforeEdge.data ?? {}
        const data = { ...(edge.data ?? {}) } as Record<string, unknown>
        for (const field of [
          'weight', 'direction', 'strength_mean', 'weightSource',
          'directionSource', 'provenanceDisplay', 'userReviewedStrength',
        ] as const) {
          if (field in beforeData) data[field] = (beforeData as Record<string, unknown>)[field]
          else delete data[field]
        }
        return { ...edge, data: data as EdgeData }
      }),
    }))
  } finally {
    useCanvasStore.getState().endExternalGraphMutation()
  }
  publish(scenarioId)
}

/** Explicit no-value-change seam for the #714 confirmation affordance. */
export function requestEdgeStrengthConfirmation(scenarioId: string, edgeId: string): boolean {
  const matches = useCanvasStore.getState().edges.filter((edge) => edge.id === edgeId)
  if (matches.length !== 1) return false
  const observed = observeEdgeStrength(matches[0] as Edge<EdgeData>)
  if (!observed || Math.abs(observed.tuple.mean) > 1) return false
  const endpointKey = pairKey(observed.from, observed.to)
  if (useCanvasStore.getState().edges.filter(
    (edge) => edge.source === observed.from && edge.target === observed.to,
  ).length !== 1) return false
  const revision = bumpRevision(scenarioId, endpointKey)
  const lane = laneFor(scenarioId)
  const issue = lane.issues.get(endpointKey)
  if (issue === 'unconfirmed') return false
  if (issue === 'conflict') {
    const current = lane.conflictCurrent.get(endpointKey)
    if (!current || !tupleScientificEqual(current, observed.tuple)) return false
  }
  clearIssue(lane, endpointKey)
  lane.recoveries.delete(endpointKey)
  lane.lastOutcome = null
  lane.pending.set(endpointKey, {
    scenarioId,
    edgeId,
    from: observed.from,
    to: observed.to,
    expected: observed.tuple,
    target: observed.tuple,
    directionIntent: 'preserve',
    intent: 'confirm_current',
    localRevision: revision,
  })
  publish(scenarioId)
  scheduleDispatch()
  return true
}

function scheduleDispatch(): void {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void dispatchNext()
  }, EDGE_STRENGTH_DEBOUNCE_MS)
}

function buildAttempt(edit: PendingEdit): EdgeStrengthAttempt {
  const freshness = useCanvasStore.getState().analysisFreshness
  return {
    id: crypto.randomUUID(),
    scenarioId: edit.scenarioId,
    edgeId: edit.edgeId,
    from: edit.from,
    to: edit.to,
    expected: edit.expected,
    target: edit.target,
    directionIntent: edit.directionIntent,
    intent: edit.intent,
    localRevision: edit.localRevision,
    scenarioRevision: getEdgeStrengthEditRevision(edit.scenarioId),
    graphHashBefore: freshness?.currentGraphHash ?? null,
    graphHashAtRunBefore: freshness?.graphHashAtRun ?? null,
    freshnessBefore: freshness?.freshness ?? null,
  }
}

async function dispatchNext(): Promise<void> {
  const scenarioId = openScenarioId
  if (!scenarioId) return
  const lane = laneFor(scenarioId)
  if (lane.active || lane.pending.size === 0 || currentIssue(lane) !== null) return
  if (!sender) {
    publish(scenarioId)
    return
  }
  const first = lane.pending.entries().next().value as [string, PendingEdit] | undefined
  if (!first) return
  const [key, edit] = first
  lane.pending.delete(key)
  const attempt = buildAttempt(edit)
  lane.active = attempt
  publish(scenarioId)

  try {
    const outcome = await sender(eventFromAttempt(attempt), attempt.id)
    if (outcome === 'send_blocked' || outcome === 'send_deferred') {
      if (lane.active?.id === attempt.id) lane.active = null
      const current = lane.pending.get(key)
      lane.pending.set(key, current ? { ...current, expected: attempt.expected } : edit)
      publish(scenarioId)
      // Lock contention is proof no request was sent, not a transport retry.
      // Wait for the conversation host to announce availability; this bounded
      // fallback covers a missed React transition without spinning.
      if (!blockedRetryTimer) {
        blockedRetryTimer = setTimeout(() => {
          blockedRetryTimer = null
          void dispatchNext()
        }, 250)
      }
      return
    }
    // A normally-resolved send must already have been settled at the parsed
    // response seam. If it was not, the receipt path is corrupt/absent.
    if (lane.active?.id === attempt.id) {
      settleUnconfirmed(attempt, 'response_not_settled')
    }
    publish(scenarioId)
    void dispatchNext()
  } catch {
    if (lane.active?.id === attempt.id) settleUnconfirmed(attempt, 'transport_or_server_failure')
    publish(scenarioId)
  }
}

function recordObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function tupleFromWire(value: unknown): EdgeStrengthTuple | null {
  const raw = recordObject(value)
  const strength = recordObject(raw?.strength)
  const mean = finiteNumber(strength?.mean)
  const effectDirection = direction(raw?.effect_direction)
  const std = finiteNumber(strength?.std)
  if (
    !raw || mean === null || effectDirection === null || std === null ||
    mean < -1 || mean > 1 || std <= 0 ||
    (mean > 0 && effectDirection !== 'positive') ||
    (mean < 0 && effectDirection !== 'negative')
  ) return null
  return { mean, effectDirection, std }
}

function wireTupleMatches(value: unknown, tuple: EdgeStrengthTuple): boolean {
  const read = tupleFromWire(value)
  if (!read) return false
  return read.mean === tuple.mean &&
    read.effectDirection === tuple.effectDirection &&
    (tuple.std === undefined || read.std === tuple.std)
}

function canonicalReadback(value: unknown): CanonicalEdgeReadback | null {
  const raw = recordObject(value)
  const tuple = tupleFromWire(value)
  const provenance = recordObject(raw?.provenance)
  if (
    !raw || !tuple ||
    provenance?.source !== 'user_specified' ||
    raw.provenance_display !== 'user_set'
  ) return null
  const existsProbability = finiteNumber(raw.exists_probability)
  // GraphV3 requires the existence probability. Treating it as optional would
  // let a strength receipt clear an unsupported existence edit without ever
  // proving which value the shared analysis model holds.
  if (existsProbability === null || existsProbability < 0 || existsProbability > 1) return null
  return {
    ...tuple,
    existsProbability,
    provenanceSource: 'user_specified',
    provenanceDisplay: 'user_set',
  }
}

const FRESHNESS_VALUES = new Set(['fresh', 'stale', 'unknown', 'none'])

function canonicalDraftGraphIsUsable(graph: Record<string, unknown>): boolean {
  // OlumiResponse deliberately types draft_graph edge elements as unknown.
  // Parse the nested authority against GraphV3 itself before reconciling it.
  // The additional identity checks below pin unique endpoint-pair semantics,
  // which ReactFlow ids cannot prove.
  if (!GraphV3Schema.safeParse(graph).success) {
    return false
  }
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : null
  const edges = Array.isArray(graph.edges) ? graph.edges : null
  if (!nodes || !edges) return false
  if (
    !Number.isInteger(graph.node_count) || graph.node_count !== nodes.length ||
    !Number.isInteger(graph.edge_count) || graph.edge_count !== edges.length
  ) return false
  const nodeIds = new Set<string>()
  for (const candidate of nodes) {
    const node = recordObject(candidate)
    if (!node || typeof node.id !== 'string' || !validEndpointId(node.id) || nodeIds.has(node.id)) {
      return false
    }
    nodeIds.add(node.id)
  }
  const pairs = new Set<string>()
  for (const candidate of edges) {
    const edge = recordObject(candidate)
    if (!edge || typeof edge.from !== 'string' || typeof edge.to !== 'string') return false
    if (!validEndpointId(edge.from) || !validEndpointId(edge.to)) return false
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) return false
    const tuple = tupleFromWire(edge)
    const exists = finiteNumber(edge.exists_probability)
    if (!tuple || exists === null || exists < 0 || exists > 1) return false
    const key = pairKey(edge.from, edge.to)
    if (pairs.has(key)) return false
    pairs.add(key)
  }
  return true
}

/** Pure, fail-closed evaluator for the deployed 4775 CEE receipt shapes. */
export function evaluateEdgeStrengthReceipt(
  attempt: EdgeStrengthAttempt,
  response: OlumiResponse,
): EdgeStrengthReceiptVerdict {
  if (response.blocks.length !== 1 || response.blocks[0]?.type !== 'graph_patch') {
    return { kind: 'invalid', reason: 'missing_or_ambiguous_patch' }
  }
  // The package's response block union does not currently discriminate the
  // graph_patch fields after an indexed lookup. Re-validate as a plain record
  // before reading the operation-specific receipt bytes.
  const patch = recordObject(response.blocks[0])
  if (!patch) return { kind: 'invalid', reason: 'missing_or_ambiguous_patch' }
  if (patch.operation !== 'adjust_edge_strength') {
    return { kind: 'invalid', reason: 'patch_operation_mismatch' }
  }
  if (patch.target_id !== `${attempt.from}→${attempt.to}`) {
    return { kind: 'invalid', reason: 'patch_target_mismatch' }
  }
  const expectedStatus = attempt.intent === 'confirm_current' ? 'noop' : 'applied'
  if (patch.status !== expectedStatus) return { kind: 'invalid', reason: 'patch_status_mismatch' }
  if (!wireTupleMatches(patch.before, attempt.expected)) {
    return { kind: 'invalid', reason: 'patch_before_mismatch' }
  }
  if (!wireTupleMatches(patch.after, attempt.target)) {
    return { kind: 'invalid', reason: 'patch_after_mismatch' }
  }
  const beforeRaw = recordObject(patch.before)
  const afterRaw = recordObject(patch.after)
  if (
    beforeRaw?.from !== attempt.from || beforeRaw.to !== attempt.to ||
    afterRaw?.from !== attempt.from || afterRaw.to !== attempt.to
  ) return { kind: 'invalid', reason: 'patch_endpoint_mismatch' }
  if (attempt.intent === 'confirm_current' && !tupleScientificEqual(attempt.expected, attempt.target)) {
    return { kind: 'invalid', reason: 'confirmation_changed_tuple' }
  }

  const graph = recordObject(response.draft_graph)
  if (!graph || !canonicalDraftGraphIsUsable(graph)) {
    return { kind: 'invalid', reason: 'draft_graph_missing_or_invalid' }
  }
  const edges = Array.isArray(graph?.edges) ? graph.edges : null
  if (!edges) return { kind: 'invalid', reason: 'draft_graph_missing' }
  const matches = edges.filter((candidate) => {
    const edge = recordObject(candidate)
    return edge?.from === attempt.from && edge?.to === attempt.to
  })
  if (matches.length !== 1) return { kind: 'invalid', reason: 'draft_edge_missing_or_ambiguous' }
  const readback = canonicalReadback(matches[0])
  if (!readback || !tupleScientificEqual(readback, attempt.target)) {
    return { kind: 'invalid', reason: 'draft_edge_readback_mismatch' }
  }
  const provenReadback = readback
  const patchAfter = tupleFromWire(patch.after)
  const patchBefore = tupleFromWire(patch.before)
  if (
    !patchBefore || !patchAfter ||
    patchBefore.std !== patchAfter.std ||
    patchAfter.std !== readback.std
  ) {
    return { kind: 'invalid', reason: 'draft_edge_std_mismatch' }
  }

  const graphHash = typeof response.graph_hash === 'string' && response.graph_hash.length > 0
    ? response.graph_hash
    : null
  const analysisReady = recordObject(response.analysis_ready)
  const currentGraphHash = typeof analysisReady?.current_graph_hash === 'string'
    ? analysisReady.current_graph_hash
    : null
  const freshness = typeof analysisReady?.freshness === 'string' && FRESHNESS_VALUES.has(analysisReady.freshness)
    ? analysisReady.freshness as 'fresh' | 'stale' | 'unknown' | 'none'
    : null
  const computedAt = typeof analysisReady?.computed_at === 'string' && analysisReady.computed_at.length > 0
    ? analysisReady.computed_at
    : null
  if (!graphHash || !analysisReady || currentGraphHash !== graphHash || !freshness || !computedAt) {
    return { kind: 'invalid', reason: 'hash_or_freshness_missing' }
  }
  const graphHashAtRun = typeof analysisReady.graph_hash_at_run === 'string'
    ? analysisReady.graph_hash_at_run
    : null

  const freshnessHashesCoherent =
    (freshness === 'fresh' && graphHashAtRun === graphHash) ||
    (freshness === 'stale' && graphHashAtRun !== null && graphHashAtRun !== graphHash) ||
    ((freshness === 'none' || freshness === 'unknown') && graphHashAtRun === null)
  if (!freshnessHashesCoherent) {
    return { kind: 'invalid', reason: 'freshness_hash_incoherent' }
  }

  // A noop patch plus an internally coherent full-graph/readiness receipt is
  // the authority for confirm_current. Freshness describes the most recent
  // analysis fact, not whether this persistence turn committed. First-run
  // `none`, degraded `unknown`, and prior-run `stale` are therefore all valid
  // when their hash shapes are internally coherent; the UI preserves that
  // verdict and only releases its local dirty overlay for `fresh` below.
  if (attempt.intent !== 'confirm_current' && attempt.graphHashBefore !== null && graphHash === attempt.graphHashBefore) {
    return { kind: 'invalid', reason: 'set_hash_unchanged' }
  }

  if (!normaliseV5AnalysisReady(analysisReady)) {
    return { kind: 'invalid', reason: 'analysis_ready_invalid' }
  }

  return {
    kind: 'applied',
    readback: provenReadback,
    graphHash,
    freshness,
    graphHashAtRun,
    analysisReady,
    draftGraph: graph,
  }
}

function liveEdgeFor(attempt: EdgeStrengthAttempt): Edge<EdgeData> | null {
  const matches = useCanvasStore.getState().edges.filter(
    (edge) => edge.source === attempt.from && edge.target === attempt.to,
  )
  return matches.length === 1 ? matches[0] as Edge<EdgeData> : null
}

function localStillEqualsTarget(attempt: EdgeStrengthAttempt): boolean {
  const edge = liveEdgeFor(attempt)
  const observed = edge ? observeEdgeStrength(edge) : null
  return observed !== null && tupleScientificEqual(observed.tuple, attempt.target)
}

function reconcileReadback(attempt: EdgeStrengthAttempt, readback: CanonicalEdgeReadback): void {
  if (
    useCanvasStore.getState().currentScenarioId !== attempt.scenarioId ||
    getPairRevision(attempt.scenarioId, pairKey(attempt.from, attempt.to)) !== attempt.localRevision ||
    !localStillEqualsTarget(attempt)
  ) return
  const edge = liveEdgeFor(attempt)
  if (!edge) return
  const store = useCanvasStore.getState()
  store.beginExternalGraphMutation('patch_apply', { suppressHistory: true })
  try {
    useCanvasStore.setState((state) => ({
      edges: state.edges.map((candidate) => {
        if (candidate.id !== edge.id) return candidate
        const data = {
          ...candidate.data,
          weight: Math.abs(readback.mean),
          direction: readback.effectDirection,
          strengthStd: readback.std,
          weightSource: 'user',
          directionSource: 'user',
          strengthStdSource: 'shared',
          ...(readback.existsProbability !== undefined
            ? {
                beliefExists: readback.existsProbability,
                exists_probability: readback.existsProbability,
                beliefExistsSource: 'shared',
              }
            : {}),
          provenance_source: readback.provenanceSource,
          provenanceDisplay: readback.provenanceDisplay,
          userReviewedStrength: true,
        } as EdgeData & { strength_mean?: number }
        delete data.strength_mean
        return { ...candidate, data }
      }),
    }))
  } finally {
    useCanvasStore.getState().endExternalGraphMutation()
  }
}

const OPTIMISTIC_EDGE_FIELDS = [
  'weight', 'direction', 'strength_mean', 'weightSource', 'directionSource',
  'provenanceDisplay', 'provenance_source', 'userReviewedStrength',
] as const

/** Reconcile the full authoritative receipt while retaining newer local drafts. */
function reconcileReceiptGraph(
  attempt: EdgeStrengthAttempt,
  lane: ScenarioLane,
  draftGraph: Record<string, unknown>,
  protectedFactorNodeIds: readonly string[] = [],
): CanonicalGraphReconciliationResult {
  const failed = (
    reason: NonNullable<CanonicalGraphReconciliationResult['reason']>,
  ): CanonicalGraphReconciliationResult => ({
    ok: false,
    changed: false,
    hasProtections: false,
    reason,
  })
  if (useCanvasStore.getState().currentScenarioId !== attempt.scenarioId) {
    return failed('analytical_projection_mismatch')
  }
  const hasNewerStructuralDraft = [...lane.unsupportedRevisions].some(
    ([issueKey, revision]) => issueKey.endsWith(':structure') && revision > attempt.scenarioRevision,
  )
  if (hasNewerStructuralDraft) return failed('protected_element_missing')

  const edgeProtections: CanonicalEdgeFieldProtection[] = []
  let protectionMissing = false
  for (const pending of lane.pending.values()) {
    const edge = useCanvasStore.getState().edges.find((candidate) => candidate.id === pending.edgeId)
    if (!edge || edge.source !== pending.from || edge.target !== pending.to) {
      protectionMissing = true
      const key = pairKey(pending.from, pending.to)
      setIssue(lane, key, 'conflict', { from: pending.from, to: pending.to })
      lane.recoveries.set(key, {
        cause: 'conflict_refresh_required',
        edgeId: pending.edgeId,
        from: pending.from,
        to: pending.to,
        expected: pending.expected,
        attempted: pending.target,
        at: Date.now(),
      })
      continue
    }
    edgeProtections.push({
      from: pending.from,
      to: pending.to,
      fields: OPTIMISTIC_EDGE_FIELDS,
      data: { ...(edge.data ?? {}) },
    })
  }

  for (const [issueKey, revision] of lane.unsupportedRevisions) {
    if (revision <= attempt.scenarioRevision) continue
    const separator = issueKey.lastIndexOf(':')
    const edgeId = issueKey.slice(0, separator)
    const field = issueKey.slice(separator + 1)
    if (field === 'structure') continue
    const edge = useCanvasStore.getState().edges.find((candidate) => candidate.id === edgeId)
    if (!edge) {
      protectionMissing = true
      continue
    }
    const fields = field === 'strengthStd'
      ? ['strengthStd', 'strengthStdSource']
      : field === 'beliefExists'
        ? ['beliefExists', 'beliefExistsSource']
        : [field]
    edgeProtections.push({
      from: edge.source,
      to: edge.target,
      fields,
      data: { ...(edge.data ?? {}) },
    })
  }

  // A factor_value_edit can be queued behind this edge writer after the edge
  // request has left. Preserve only that writer's optimistic value fields while
  // reconciling the otherwise-authoritative full graph; the global Run barrier
  // still waits for the factor receipt before licensing analysis.
  const nodeProtections: CanonicalNodeFieldProtection[] = []
  for (const nodeId of protectedFactorNodeIds) {
    const node = useCanvasStore.getState().nodes.find((candidate) => candidate.id === nodeId)
    if (!node) {
      protectionMissing = true
      continue
    }
    nodeProtections.push({
      nodeId,
      fields: ['observedState', 'observed_state', 'display_value'],
      data: { ...(node.data ?? {}) },
    })
  }
  if (protectionMissing) return failed('protected_element_missing')

  const result = reconcileCanvasWithCanonicalGraph(draftGraph, {
    nodes: nodeProtections,
    edges: edgeProtections,
  })
  if (!result.ok) {
    const canonicalPairs = new Set(
      (Array.isArray(draftGraph.edges) ? draftGraph.edges : []).flatMap((candidate) => {
        const edge = recordObject(candidate)
        return typeof edge?.from === 'string' && typeof edge.to === 'string'
          ? [pairKey(edge.from, edge.to)]
          : []
      }),
    )
    for (const pending of lane.pending.values()) {
      if (canonicalPairs.has(pairKey(pending.from, pending.to))) continue
      const key = pairKey(pending.from, pending.to)
      setIssue(lane, key, 'conflict', { from: pending.from, to: pending.to })
      lane.recoveries.set(key, {
        cause: 'conflict_refresh_required',
        edgeId: pending.edgeId,
        from: pending.from,
        to: pending.to,
        expected: pending.expected,
        attempted: pending.target,
        at: Date.now(),
      })
    }
    return result
  }

  for (const [issueKey, revision] of [...lane.unsupportedRevisions]) {
    if (revision > attempt.scenarioRevision) continue
    // A GraphV3 strength receipt authoritatively carries std and existence
    // probability, so those local-only fields were genuinely restored above.
    // It does NOT carry the legacy belief/confidence channels. Leaving those
    // values on the canvas while clearing their Run hold would claim a shared
    // persistence contract that 0.42 does not have.
    const field = issueKey.slice(issueKey.lastIndexOf(':') + 1)
    if (
      field === 'strengthStd' ||
      field === 'beliefExists' ||
      field === 'exists_probability'
    ) {
      lane.unsupportedRevisions.delete(issueKey)
      clearIssue(lane, issueKey)
    }
  }
  return result
}

function settleApplied(
  attempt: EdgeStrengthAttempt,
  verdict: Extract<EdgeStrengthReceiptVerdict, { kind: 'applied' }>,
  protectedFactorNodeIds: readonly string[],
): void {
  const lane = laneFor(attempt.scenarioId)
  if (lane.active?.id !== attempt.id) return
  const key = pairKey(attempt.from, attempt.to)
  // Clear only the attempt's prior state before the full reconcile. That
  // reconcile can discover a NEW successor conflict (for example, a pending
  // edge was deleted remotely), and its finding must survive settlement.
  clearIssue(lane, key)
  lane.conflictCurrent.delete(key)
  lane.recoveries.delete(key)
  const reconciliation = reconcileReceiptGraph(
    attempt,
    lane,
    verdict.draftGraph,
    protectedFactorNodeIds,
  )
  if (!reconciliation.ok) {
    settleUnconfirmed(attempt, reconciliation.reason ?? 'receipt_reconcile_failed')
    return
  }
  reconcileReadback(attempt, verdict.readback)
  const rawCanonicalExact = canvasAnalyticallyMatchesCanonicalGraph(verdict.draftGraph)
  const storeAfterReconcile = useCanvasStore.getState()
  const protectedProjectionHasHold =
    lane.pending.size > 0 ||
    currentIssue(lane) !== null ||
    storeAfterReconcile.pendingEmittedEdits > 0 ||
    storeAfterReconcile.activeEmittedEdits > 0 ||
    storeAfterReconcile.unconfirmedEmittedEdits > 0
  // A mounted canvas can settle only when it is either the exact raw receipt,
  // or an exact canonical-plus-protection projection with a separately-owned
  // writer/issue that keeps Run closed. A caller-provided protection without
  // such a hold is not authority and fails closed.
  if (
    !rawCanonicalExact &&
    (!reconciliation.hasProtections || !protectedProjectionHasHold)
  ) {
    settleUnconfirmed(attempt, 'receipt_exactness_failed')
    return
  }
  lane.active = null
  lane.lastOutcome = {
    kind: attempt.intent === 'confirm_current' ? 'confirmed' : 'saved',
    edgeId: attempt.edgeId,
    from: attempt.from,
    to: attempt.to,
    at: Date.now(),
  }
  lane.hydration = 'settled'
  lane.lastHydratedRevision = bumpRevision(attempt.scenarioId)

  // A later optimistic edit was based on this attempt's target. Now that the
  // receipt proves the exact canonical after tuple, use the readback as its
  // expected base. If the later edit has returned to the persisted value, no
  // second write is needed.
  const pending = lane.pending.get(key)
  if (pending) {
    if (tupleScientificEqual(pending.target, verdict.readback) && pending.intent === 'set') {
      lane.pending.delete(key)
    } else {
      lane.pending.set(key, { ...pending, expected: verdict.readback })
    }
  }

  // Ingest only the validated authority fields; generic graph-patch/full-graph
  // application is explicitly bypassed for this event in useConversation.
  // Publish the zero-in-flight state before applying freshness, but do not
  // resolve Run waiters until every authoritative field has committed.
  publish(attempt.scenarioId, { settleWaiters: false })
  const store = useCanvasStore.getState()
  store.setCeeAnalysisReady(normaliseV5AnalysisReady(verdict.analysisReady) ?? null)
  store.setAnalysisFreshness(verdict.analysisReady, {
    preserveDirty:
      attempt.intent === 'confirm_current' && verdict.freshness !== 'fresh',
  })
  // T0→T1→T0 coalesces to confirm_current, but the first movement already
  // raised the local dirty hold. A valid noop can echo byte-identical readiness,
  // in which case setAnalysisFreshness correctly performs no state update and
  // therefore cannot clear that hold itself. The receipt proves the unchanged
  // shared tuple; clear only when no successor/issue remains. The store guard
  // additionally refuses while any factor writer is active or queued.
  if (
    attempt.intent === 'confirm_current' &&
    verdict.freshness === 'fresh' &&
    !lane.pending.has(key) &&
    currentIssue(lane) === null
  ) store.clearAnalysisFreshnessDirty()
}

function settleUnconfirmed(attempt: EdgeStrengthAttempt, _reason: string): void {
  const lane = laneFor(attempt.scenarioId)
  if (lane.active?.id !== attempt.id) return
  lane.active = null
  const key = pairKey(attempt.from, attempt.to)
  const pending = lane.pending.get(key)
  setIssue(lane, key, 'unconfirmed', {
    from: attempt.from,
    to: attempt.to,
  })
  lane.recoveries.set(key, {
    cause: 'unconfirmed',
    edgeId: attempt.edgeId,
    from: attempt.from,
    to: attempt.to,
    expected: attempt.expected,
    attempted: pending?.target ?? attempt.target,
    at: Date.now(),
  })
  lane.lastOutcome = null
  publish(attempt.scenarioId, { settleWaiters: false })
}

function parseConflictCurrent(boundaryError: BoundaryError): EdgeStrengthTuple | null {
  const details = recordObject(boundaryError.details)
  if (
    boundaryError.error !== 'GRAPH_DIVERGED' ||
    details?.recovery_action !== 'refresh_and_reconfirm'
  ) return null
  const edge = recordObject(details.edge)
  const current = recordObject(edge?.current)
  const mean = finiteNumber(current?.mean)
  const std = finiteNumber(current?.std)
  const effectDirection = direction(current?.effect_direction)
  return mean !== null && mean >= -1 && mean <= 1 &&
    std !== null && std > 0 && effectDirection !== null &&
    !(mean > 0 && effectDirection !== 'positive') &&
    !(mean < 0 && effectDirection !== 'negative')
    ? { mean, std, effectDirection }
    : null
}

function applySharedTuple(args: {
  scenarioId: string
  edgeId: string
  from: string
  to: string
  current: EdgeStrengthTuple
}): boolean {
  const { scenarioId, edgeId, from, to, current } = args
  if (
    useCanvasStore.getState().currentScenarioId !== scenarioId
  ) return false
  const matches = useCanvasStore.getState().edges.filter(
    (edge) => edge.id === edgeId && edge.source === from && edge.target === to,
  )
  if (matches.length !== 1) return false
  const store = useCanvasStore.getState()
  const observed = observeEdgeStrength(matches[0] as Edge<EdgeData>)
  if (!observed || !tupleScientificEqual(observed.tuple, current)) store.pushHistory()
  store.beginExternalGraphMutation('patch_apply')
  try {
    useCanvasStore.setState((state) => ({
      edges: state.edges.map((candidate) => candidate.id !== edgeId ? candidate : {
        ...candidate,
        data: {
          ...candidate.data,
          weight: Math.abs(current.mean),
          direction: current.effectDirection,
          strength_mean: undefined,
          strengthStd: current.std,
          weightSource: 'shared',
          directionSource: 'shared',
          strengthStdSource: 'shared',
          provenance: undefined,
          provenance_source: undefined,
          provenanceDisplay: undefined,
          userReviewedStrength: false,
        } as EdgeData,
      }),
    }))
  } finally {
    useCanvasStore.getState().endExternalGraphMutation()
  }
  return true
}

function reconcileConflictCurrent(attempt: EdgeStrengthAttempt, current: EdgeStrengthTuple): boolean {
  return applySharedTuple({
    scenarioId: attempt.scenarioId,
    edgeId: attempt.edgeId,
    from: attempt.from,
    to: attempt.to,
    current,
  })
}

/** Called once by useConversation while the exact parsed response is available. */
export function settleEdgeStrengthResponse(args: {
  attemptId: string
  response?: OlumiResponse
  boundaryError?: BoundaryError
  protectedFactorNodeIds?: readonly string[]
}): boolean {
  let lane: ScenarioLane | null = null
  let attempt: EdgeStrengthAttempt | null = null
  for (const candidate of lanes.values()) {
    if (candidate.active?.id !== args.attemptId) continue
    lane = candidate
    attempt = candidate.active
    break
  }
  if (!attempt) return false
  if (args.response) {
    const verdict = evaluateEdgeStrengthReceipt(attempt, args.response)
    if (verdict.kind === 'applied') {
      settleApplied(attempt, verdict, args.protectedFactorNodeIds ?? [])
    }
    else settleUnconfirmed(attempt, verdict.reason)
    return true
  }
  if (args.boundaryError) {
    const details = recordObject(args.boundaryError.details)
    if (
      args.boundaryError.error === 'GRAPH_DIVERGED' &&
      details?.recovery_action === 'refresh_and_reconfirm'
    ) {
      const current = parseConflictCurrent(args.boundaryError)
      const key = pairKey(attempt.from, attempt.to)
      const successor = lane!.pending.get(key)
      const attempted = successor?.target ?? attempt.target
      // Revert only when the canvas still shows this exact sent edit. A newer
      // local successor is retained as a reviewable draft and is never sent on
      // the stale expected base.
      const canAdoptImmediately = current !== null && localStillEqualsTarget(attempt) && !successor
      if (canAdoptImmediately) reconcileConflictCurrent(attempt, current)
      lane!.active = null
      setIssue(lane!, key, 'conflict', {
        from: attempt.from,
        to: attempt.to,
      })
      if (current) {
        lane!.conflictCurrent.set(key, current)
        if (successor) lane!.pending.set(key, { ...successor, expected: current })
      } else {
        lane!.conflictCurrent.delete(key)
      }
      lane!.recoveries.set(key, {
        cause: current ? 'conflict' : 'conflict_refresh_required',
        edgeId: successor?.edgeId ?? attempt.edgeId,
        from: attempt.from,
        to: attempt.to,
        expected: attempt.expected,
        attempted,
        ...(current ? { sharedCurrent: current } : {}),
        at: Date.now(),
      })
      lane!.lastOutcome = canAdoptImmediately ? {
        kind: 'shared_value_refreshed',
        edgeId: attempt.edgeId,
        from: attempt.from,
        to: attempt.to,
        at: Date.now(),
      } : {
        kind: 'review_required',
        edgeId: successor?.edgeId ?? attempt.edgeId,
        from: attempt.from,
        to: attempt.to,
        at: Date.now(),
      }
      publish(attempt.scenarioId, { settleWaiters: false })
      return true
    }
  }
  settleUnconfirmed(attempt, 'typed_error')
  return true
}

export function abandonEdgeStrengthAttempt(attemptId: string): void {
  for (const lane of lanes.values()) {
    if (lane.active?.id === attemptId) {
      settleUnconfirmed(lane.active, 'abandoned')
      return
    }
  }
}

export function discardEdgeStrengthAttemptForScenarioChange(attemptId: string): void {
  for (const [scenarioId, lane] of lanes) {
    if (lane.active?.id !== attemptId) continue
    const attempt = lane.active
    lane.active = null
    const key = pairKey(attempt.from, attempt.to)
    const successor = lane.pending.get(key)
    setIssue(lane, key, 'unconfirmed', {
      from: attempt.from,
      to: attempt.to,
    })
    lane.recoveries.set(key, {
      cause: 'unconfirmed',
      edgeId: successor?.edgeId ?? attempt.edgeId,
      from: attempt.from,
      to: attempt.to,
      expected: attempt.expected,
      attempted: successor?.target ?? attempt.target,
      at: Date.now(),
    })
    lane.lastOutcome = null
    publish(scenarioId)
    return
  }
}

export function getEdgeStrengthEndpointStatus(
  scenarioId: string | null | undefined,
  from: string,
  to: string,
): EdgeStrengthEndpointStatus {
  if (!scenarioId) return { kind: 'idle' }
  const lane = lanes.get(scenarioId)
  if (!lane) return { kind: 'idle' }
  const key = pairKey(from, to)
  if (lane.active && pairKey(lane.active.from, lane.active.to) === key) {
    return { kind: 'saving', edgeId: lane.active.edgeId }
  }
  const pending = lane.pending.get(key)
  const recovery = lane.recoveries.get(key)
  const issue = lane.issues.get(key)
  if (issue === 'conflict' && recovery) return { kind: 'conflict', recovery }
  if (issue === 'unconfirmed' && recovery) return { kind: 'unconfirmed', recovery }
  if (pending) return { kind: 'queued', edgeId: pending.edgeId }
  const outcome = lane.lastOutcome
  if (outcome && outcome.from === from && outcome.to === to) {
    if (outcome.kind === 'review_required') {
      return recovery ? { kind: 'conflict', recovery } : { kind: 'idle' }
    }
    return { kind: outcome.kind, edgeId: outcome.edgeId, at: outcome.at }
  }
  return { kind: 'idle' }
}

/**
 * Bounded public projection for global Run blockers. This is intentionally a
 * fresh display read, not another queue: the coordinator remains the sole
 * owner and exposes only canonical endpoint pairs, human labels, status and
 * whether the relationship can currently be opened.
 */
export function getEdgeStrengthRecoverySummary(
  scenarioId: string | null | undefined,
): EdgeStrengthRecoverySummary {
  if (!scenarioId) return { items: [], total: 0, remaining: 0 }
  const lane = lanes.get(scenarioId)
  return lane ? recoverySummaryFor(lane) : { items: [], total: 0, remaining: 0 }
}

/** Native-button target for the bounded global recovery list. */
export function openEdgeStrengthRecoveryRelationship(
  scenarioId: string,
  from: string,
  to: string,
): boolean {
  if (
    scenarioId !== openScenarioId ||
    useCanvasStore.getState().currentScenarioId !== scenarioId
  ) return false
  const summary = getEdgeStrengthRecoverySummary(scenarioId)
  if (!summary.items.some((item) => item.from === from && item.to === to)) return false
  const matches = useCanvasStore.getState().edges.filter(
    (edge) => edge.source === from && edge.target === to,
  )
  if (matches.length !== 1) return false
  const store = useCanvasStore.getState()
  store.selectEdgeWithoutHistory(matches[0]!.id)
  store.setShowInspectorPanel(true)
  return true
}

/**
 * Explicit conflict choice: show the witnessed tuple, then prove the complete
 * shared graph with a fresh read. A tuple-only 409 is not authority for
 * unrelated nodes/edges, so Run remains blocked unless that refresh reconciles
 * an analytically equivalent full graph.
 */
export async function acceptSharedEdgeStrengthValue(
  scenarioId: string,
  from: string,
  to: string,
): Promise<boolean> {
  const lane = laneFor(scenarioId)
  const key = pairKey(from, to)
  const recovery = lane.recoveries.get(key)
  if (!recovery?.sharedCurrent || lane.issues.get(key) !== 'conflict') return false
  if (!applySharedTuple({
    scenarioId,
    edgeId: recovery.edgeId,
    from,
    to,
    current: recovery.sharedCurrent,
  })) return false
  lane.pending.delete(key)
  lane.hydration = 'unconfirmed'
  lane.recoveries.set(key, {
    ...recovery,
    cause: 'conflict_refresh_required',
    sharedCurrent: recovery.sharedCurrent,
  })
  lane.lastOutcome = {
    kind: 'review_required',
    edgeId: recovery.edgeId,
    from,
    to,
    at: Date.now(),
  }
  publish(scenarioId)
  return await refreshEdgeStrengthAuthority(scenarioId)
}

/** Explicit conflict choice: create a NEW CAS write from shared current to the held draft. */
export function applyMyEdgeStrengthValue(
  scenarioId: string,
  from: string,
  to: string,
): boolean {
  const lane = laneFor(scenarioId)
  const key = pairKey(from, to)
  const recovery = lane.recoveries.get(key)
  const current = recovery?.sharedCurrent
  if (!recovery || !current || lane.issues.get(key) !== 'conflict') return false
  const revision = bumpRevision(scenarioId, key)
  if (!applySharedTuple({
    scenarioId,
    edgeId: recovery.edgeId,
    from,
    to,
    current: recovery.attempted,
  })) return false
  lane.pending.set(key, {
    scenarioId,
    edgeId: recovery.edgeId,
    from,
    to,
    expected: current,
    target: recovery.attempted,
    directionIntent:
      current.effectDirection === recovery.attempted.effectDirection
        ? 'preserve'
        : recovery.attempted.effectDirection,
    intent: 'set',
    localRevision: revision,
  })
  clearIssue(lane, key)
  lane.conflictCurrent.delete(key)
  lane.recoveries.delete(key)
  lane.lastOutcome = null
  useCanvasStore.getState().markAnalysisFreshnessDirty()
  publish(scenarioId)
  scheduleDispatch()
  return true
}

/** Force-build/send debounced work and await an applied/verified-noop receipt. */
export async function flushEdgeStrengthEditsBeforeRun(
  scenarioId: string | null | undefined,
): Promise<EdgeStrengthFlushResult> {
  if (!scenarioId) {
    return { ok: false, reason: 'Open a saved scenario before running analysis.' }
  }
  if (
    useCanvasStore.getState().currentScenarioId !== scenarioId ||
    openScenarioId !== scenarioId
  ) {
    return { ok: false, reason: 'The open scenario changed. Review it before running analysis.' }
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  const lane = laneFor(scenarioId)
  if (!sender && (lane.pending.size > 0 || lane.active !== null)) {
    return {
      ok: false,
      reason: 'Relationship saving is not ready yet. Wait a moment, then try again.',
    }
  }
  const terminal = resultFor(lane)
  if (terminal) return terminal
  void dispatchNext()
  const result = await new Promise<EdgeStrengthFlushResult>((resolve) => {
    lane.waiters.add(resolve)
  })
  if (
    useCanvasStore.getState().currentScenarioId !== scenarioId ||
    openScenarioId !== scenarioId
  ) {
    return { ok: false, reason: 'The open scenario changed. Analysis has not started.' }
  }
  return result
}

export function edgeStrengthRunBarrierState(scenarioId: string | null | undefined): EdgeStrengthFlushResult {
  if (!scenarioId) return { ok: false, reason: 'Open a saved scenario before running analysis.' }
  if (
    useCanvasStore.getState().currentScenarioId !== scenarioId ||
    openScenarioId !== scenarioId
  ) return { ok: false, reason: 'The open scenario changed. Review it before running analysis.' }
  const lane = laneFor(scenarioId)
  const terminal = resultFor(lane)
  return terminal ?? {
    ok: false,
    reason: runReason(currentIssue(lane), lane.pending.size, lane.active ? 1 : 0),
  }
}

/** Reset helper for focused tests; never called by production code. */
export function __resetEdgeStrengthCoordinatorForTests(): void {
  if (debounceTimer) clearTimeout(debounceTimer)
  if (blockedRetryTimer) clearTimeout(blockedRetryTimer)
  lanes.clear()
  scenarioRevisions.clear()
  pairRevisions.clear()
  openScenarioId = null
  sender = null
  senderOwner = null
  authorityRefresher = null
  authorityRefresherOwner = null
  debounceTimer = null
  blockedRetryTimer = null
  publishedRevision = 0
  useCanvasStore.getState().setEdgeStrengthSync(EMPTY_EDGE_STRENGTH_SYNC)
}

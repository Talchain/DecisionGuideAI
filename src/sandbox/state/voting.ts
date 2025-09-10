import { track } from '@/lib/analytics'
import { subscribeRecompute, getRecompute } from '@/sandbox/state/recompute'

export type VoteRow = { id: string; p: number; c: number }
export type Vote = { voterId: string; version: number; rows: VoteRow[]; ts: number }

const votesByDecision = new Map<string, Vote[]>()
const lastVersionByVoter = new Map<string, Map<string, number>>() // decisionId -> (voterId -> version)

export type AlignmentState = { score: number; version: number; ts: number }
const alignmentByDecision = new Map<string, AlignmentState>()
const listeners = new Map<string, Set<(s: AlignmentState) => void>>()

function emitAlignment(decisionId: string, s: AlignmentState) {
  alignmentByDecision.set(decisionId, s)
  const set = listeners.get(decisionId)
  if (set) set.forEach(cb => cb(s))
}

export function subscribeAlignment(decisionId: string, cb: (s: AlignmentState) => void): () => void {
  if (!listeners.has(decisionId)) listeners.set(decisionId, new Set())
  const set = listeners.get(decisionId)!
  set.add(cb)
  const cur = alignmentByDecision.get(decisionId)
  if (cur) cb(cur)
  return () => { set.delete(cb) }
}

export function getAlignment(decisionId: string): AlignmentState | null {
  return alignmentByDecision.get(decisionId) ?? null
}


export function submitVotes(decisionId: string, voterId: string, rows: VoteRow[], version?: number): boolean {
  const s = getRecompute(decisionId)
  const v = version ?? s?.version ?? 0
  const lastByVoter = lastVersionByVoter.get(decisionId) ?? new Map<string, number>()
  lastVersionByVoter.set(decisionId, lastByVoter)
  if (lastByVoter.get(voterId) === v) return false // once per cycle
  lastByVoter.set(voterId, v)

  const list = votesByDecision.get(decisionId) ?? []
  votesByDecision.set(decisionId, list)
  const vote: Vote = { voterId, version: v, rows, ts: Date.now() }
  list.push(vote)
  track('sandbox_vote', { op: 'submit', decisionId, fields: ['p', 'c'], ts: vote.ts })
  // compute alignment now for latest version
  computeAlignment(decisionId)
  return true
}

// --- PRD Alignment ---
// Max std dev for N values in [0,1] (population): occurs when floor(N/2) zeros and ceil(N/2) ones
export function maxStdDev01(n: number): number {
  if (n <= 1) return 0
  const a = Math.floor(n / 2) // zeros
  const b = Math.ceil(n / 2)  // ones
  const m = b / n
  const variance = (a * (m ** 2) + b * ((1 - m) ** 2)) / n
  return Math.sqrt(variance)
}

function clamp01(x: number): number { return Math.max(0, Math.min(1, x)) }

export function computeAlignmentPRD(probVotes: number[], confVotes: number[]): { scoreProb: number; scoreConf: number; score: number } {
  const sd = (xs: number[]) => {
    const n = xs.length
    if (n <= 1) return 0
    const mean = xs.reduce((a, b) => a + b, 0) / n
    const v = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / n
    return Math.sqrt(v)
  }
  const normalize = (xs: number[]) => xs.map(clamp01)
  const p = normalize(probVotes)
  const c = normalize(confVotes)
  const sdp = sd(p)
  const sdc = sd(c)
  const mp = maxStdDev01(p.length)
  const mc = maxStdDev01(c.length)
  const scoreFrom = (sdx: number, md: number) => {
    if (md === 0) return 100
    const ratio = sdx / md
    const raw = 100 * (1 - ratio)
    return Math.round(Math.max(0, Math.min(100, raw)))
  }
  const scoreProb = scoreFrom(sdp, mp)
  const scoreConf = scoreFrom(sdc, mc)
  const score = Math.min(scoreProb, scoreConf)
  return { scoreProb, scoreConf, score }
}

export function computeAlignment(decisionId: string): AlignmentState {
  const s = getRecompute(decisionId)
  const version = s?.version ?? 0
  const list = (votesByDecision.get(decisionId) ?? []).filter(v => v.version === version)
  const probVotes: number[] = []
  const confVotes: number[] = []
  for (const v of list) {
    for (const r of v.rows) { probVotes.push(r.p); confVotes.push(r.c) }
  }
  const now = Date.now()
  const { scoreProb, scoreConf, score } = computeAlignmentPRD(probVotes, confVotes)
  const state: AlignmentState = { score, version, ts: now }
  emitAlignment(decisionId, state)
  const bucket = alignmentBucket(score)
  track('sandbox_alignment', { decisionId, scoreProb, scoreConf, score, bucket, ts: now })
  return state
}

// Recompute-coupled alignment recalculation
const wired = new Set<string>()
export function wireAlignmentToRecompute(decisionId: string) {
  if (wired.has(decisionId)) return
  wired.add(decisionId)
  subscribeRecompute(decisionId, () => computeAlignment(decisionId))
}

export function alignmentBucket(score: number): 'Low' | 'Medium' | 'High' {
  if (score < 40) return 'Low'
  if (score < 70) return 'Medium'
  return 'High'
}

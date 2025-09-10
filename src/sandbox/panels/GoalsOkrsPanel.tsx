import React from 'react'
import * as Y from 'yjs'
import { loadSeed } from '@/sandbox/bridge/contracts'
import { KRCard } from '../components/KRCard'
import { useFlags } from '@/lib/flags'
import { useBoardState } from '@/sandbox/state/boardState'
import { notifyRecompute } from '@/sandbox/state/recompute'
import { useRealtimeDoc } from '@/realtime/provider'
import { submitVotes, subscribeAlignment, getAlignment, alignmentBucket } from '@/sandbox/state/voting'

type ProbRow = { id: string; label: string; value: number }

export const GoalsOkrsPanel: React.FC<{ decisionId?: string }> = ({ decisionId = 'debug-test-board' }) => {
  const flags = useFlags()
  const enabled = flags.projections
  const seed = React.useMemo(() => loadSeed(decisionId), [decisionId])
  const realDoc = useRealtimeDoc()
  const { getCurrentDocument } = useBoardState(decisionId, realDoc)

  // Helper: read probRows from Y doc
  const readProbRows = React.useCallback((): ProbRow[] => {
    try {
      const d = getCurrentDocument?.()
      if (!d) return []
      const mock = d.getMap('sandboxMock') as Y.Map<unknown>
      const yProbs = mock.get('probRows') as Y.Array<Y.Map<unknown>>
      if (!yProbs) return []
      return yProbs.toArray().map(m => ({ id: String(m.get('id')), label: String(m.get('label')), value: Number(m.get('value')) || 0 }))
    } catch {
      return []
    }
  }, [getCurrentDocument])

  // Progressive recompute on mount and on Y updates
  React.useEffect(() => {
    if (!enabled) return
    const d = getCurrentDocument?.()
    const fire = (reason: 'seed' | 'prob_edit') => {
      const rows = readProbRows()
      const options = (rows.length ? rows : [{ id: 'a', label: 'A', value: 0.5 }, { id: 'b', label: 'B', value: 0.5 }]).map(r => ({ id: r.id, p: r.value, c: 1 }))
      notifyRecompute(decisionId, reason, options)
      // progressive render simulated elsewhere by cards
    }
    // Seed recompute on the next frame; cancel if unmounted before it runs
    let rafId = window.requestAnimationFrame(() => fire('seed'))
    let off: (() => void) | null = null
    if (d) {
      const onUpdate = () => fire('prob_edit')
      d.on('update', onUpdate)
      off = () => d.off('update', onUpdate)
    }
    return () => { if (off) off(); if (rafId) { cancelAnimationFrame(rafId) } }
  }, [decisionId, enabled, getCurrentDocument, readProbRows])

  const canVote = flags.voting
  const [alignment, setAlignment] = React.useState<number | null>(null)
  React.useEffect(() => {
    if (!canVote) return
    const cur = getAlignment(decisionId)
    if (cur) setAlignment(cur.score)
    const unsub = subscribeAlignment(decisionId, (s) => setAlignment(s.score))
    return () => { unsub() }
  }, [decisionId, canVote])
  const onSubmitVote = React.useCallback(() => {
    if (!canVote) return
    const rows = readProbRows().map(r => ({ id: r.id, p: r.value, c: 1 }))
    const key = 'olumi:voterId'
    let voterId = ''
    try { voterId = window.localStorage.getItem(key) || '' } catch {}
    if (!voterId) {
      voterId = `v_${Math.random().toString(36).slice(2)}`
      try { window.localStorage.setItem(key, voterId) } catch {}
    }
    submitVotes(decisionId, voterId, rows)
  }, [canVote, decisionId, readProbRows])

  return (
    <section role="region" aria-label="Goals and OKRs" className="p-4 overflow-auto">
      <div role="tablist" aria-label="Goals and OKRs Tabs" className="mb-3 hidden" />
      <h3 className="text-sm font-semibold mb-2">Goals & OKRs</h3>
      {!enabled ? (
        <div className="text-xs text-gray-600">Projections are disabled.</div>
      ) : (
        <div className="space-y-2">
          {canVote && (
            <div className="mb-2">
              <button className="px-3 py-1 text-xs bg-indigo-600 text-white rounded" onClick={onSubmitVote}>Submit Vote</button>
              <span className="ml-3 text-xs text-gray-700">Alignment (lower of prob/conf): {alignment !== null ? `${alignment}%` : '—'}</span>
              {alignment !== null && (
                (() => {
                  const bucket = alignmentBucket(alignment)
                  const cls = bucket === 'High' ? 'bg-emerald-100 text-emerald-700' : bucket === 'Medium' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700'
                  return <span data-testid="alignment-badge" aria-label={`Alignment: ${bucket}`} className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${cls}`}>{bucket}</span>
                })()
              )}
            </div>
          )}
          {seed.keyResults.map(kr => (
            <KRCard key={kr.id} decisionId={decisionId} krId={kr.id} krTitle={kr.title} objectiveTitle={seed.objectives.find(o => o.id === kr.objectiveId)?.title || ''} />
          ))}
        </div>
      )}
    </section>
  )
}

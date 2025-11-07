import { useState, useEffect } from 'react'
import { ArrowLeft, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react'
import { loadRuns, type StoredRun } from '../store/runHistory'
import { compareRuns, formatDeltaPercent, formatEdgeValue, type EdgeDiff } from '../utils/compareScenarios'

interface CompareViewProps {
  onOpenInCanvas: (runId: string) => void
  onBack: () => void
  selectedRunIds: string[]
  onSelectionChange: (runIds: string[]) => void
}

export function CompareView({ onOpenInCanvas, onBack, selectedRunIds, onSelectionChange }: CompareViewProps) {
  const [runs, setRuns] = useState<StoredRun[]>([])
  const [runA, setRunA] = useState<StoredRun | null>(null)
  const [runB, setRunB] = useState<StoredRun | null>(null)
  const [edgeDiffs, setEdgeDiffs] = useState<EdgeDiff[]>([])

  useEffect(() => setRuns(loadRuns()), [])
  useEffect(() => {
    if (selectedRunIds.length === 0) {
      setRunA(null)
      setRunB(null)
      return
    }

    const [idA, idB] = selectedRunIds
    const nextRunA = idA ? runs.find(r => r.id === idA) ?? null : null
    const nextRunB = idB ? runs.find(r => r.id === idB) ?? null : null

    setRunA(prev => (prev?.id === nextRunA?.id ? prev : nextRunA))
    setRunB(prev => (prev?.id === nextRunB?.id ? prev : nextRunB))
  }, [runs, selectedRunIds])

  useEffect(() => {
    if (runA && runB) setEdgeDiffs(compareRuns(runA, runB, 5))
    else setEdgeDiffs([])
  }, [runA, runB])

  const handleSelectRun = (slot: 'A' | 'B', runId: string) => {
    let nextRunA = runA
    let nextRunB = runB

    if (slot === 'A') {
      nextRunA = runId ? runs.find(r => r.id === runId) ?? null : null
    } else {
      nextRunB = runId ? runs.find(r => r.id === runId) ?? null : null
    }

    if (nextRunA && nextRunB && nextRunA.id === nextRunB.id) {
      if (slot === 'A') {
        nextRunB = null
      } else {
        nextRunA = null
      }
    }

    setRunA(nextRunA)
    setRunB(nextRunB)

    const ids = [nextRunA?.id, nextRunB?.id].filter((id): id is string => Boolean(id))
    onSelectionChange(ids)
  }

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors" type="button">
          <ArrowLeft className="w-4 h-4" />Back to Results
        </button>
        <h2 className="text-lg font-semibold text-gray-900">Compare Runs</h2>
        <div className="w-20" />
      </div>

      <div className="p-4 grid grid-cols-2 gap-4 border-b border-gray-200 bg-gray-50">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Run A</label>
          <select
            value={runA?.id || ''}
            onChange={(e) => handleSelectRun('A', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-info-500"
          >
            <option value="">Select run...</option>
            {runs.map(r => <option key={r.id} value={r.id}>Seed {r.seed} - {formatTimestamp(r.ts)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Run B</label>
          <select
            value={runB?.id || ''}
            onChange={(e) => handleSelectRun('B', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-info-500"
          >
            <option value="">Select run...</option>
            {runs.map(r => <option key={r.id} value={r.id}>Seed {r.seed} - {formatTimestamp(r.ts)}</option>)}
          </select>
        </div>
      </div>

      {runA && runB ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <RunSummaryCard run={runA} label="Run A" onOpen={() => onOpenInCanvas(runA.id)} />
            <RunSummaryCard run={runB} label="Run B" onOpen={() => onOpenInCanvas(runB.id)} />
          </div>

          {edgeDiffs.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Top 5 Edge Differences</h3>
              <div className="space-y-2">
                {edgeDiffs.map((diff, i) => (
                  <EdgeDiffCard key={diff.edgeId} diff={diff} rank={i + 1} />
                ))}
              </div>
            </div>
          )}
          {edgeDiffs.length === 0 && (
            <div className="text-center py-8 text-sm text-gray-500">No edge differences found</div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          Select two runs to compare
        </div>
      )}
    </div>
  )
}

function RunSummaryCard({ run, label, onOpen }: { run: StoredRun; label: string; onOpen: () => void }) {
  const report = run.report
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
        <button onClick={onOpen} className="text-xs text-info-600 hover:text-info-700 font-medium" type="button">
          Open →
        </button>
      </div>
      <div className="space-y-1 mb-4 pb-4 border-b border-gray-100">
        <div className="text-sm"><span className="text-gray-600">Seed:</span> <span className="font-mono font-medium">{run.seed}</span></div>
        {run.hash && <div className="text-sm"><span className="text-gray-600">Hash:</span> <span className="font-mono text-xs">{run.hash.slice(0, 12)}...</span></div>}
        <div className="text-xs text-gray-500">{formatTimestamp(run.ts)}</div>
      </div>
      {report?.summary ? (
        <div>
          <div className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Probability Bands</div>
          <div className="space-y-1.5">
            <BandRow label="p10" value={report.summary.conservative} unit={report.summary.units} />
            <BandRow label="p50" value={report.summary.likely} unit={report.summary.units} />
            <BandRow label="p90" value={report.summary.optimistic} unit={report.summary.units} />
          </div>
        </div>
      ) : <div className="text-xs text-gray-500">No data</div>}
    </div>
  )
}

function BandRow({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-600 font-medium">{label}:</span>
      <span className="font-semibold text-gray-900">{value.toFixed(1)} <span className="text-xs text-gray-500 font-normal">{unit}</span></span>
    </div>
  )
}

function EdgeDiffCard({ diff, rank }: { diff: EdgeDiff; rank: number }) {
  const isIncrease = diff.runB.value > diff.runA.value
  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-white hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-info-100 text-info-700 text-xs font-bold flex items-center justify-center">{rank}</span>
          <span className="text-sm font-medium text-gray-900">{diff.label}</span>
        </div>
        <div className="flex items-center gap-1">
          {isIncrease ? <TrendingUp className="w-4 h-4 text-success-600" /> : <TrendingDown className="w-4 h-4 text-danger-600" />}
          <span className={`text-sm font-semibold ${isIncrease ? 'text-success-600' : 'text-danger-600'}`}>{formatDeltaPercent(diff.deltaPercent)}</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 text-xs">
        <div><div className="text-gray-500 mb-1 font-medium">Run A</div><div className="font-mono font-semibold text-gray-900">{formatEdgeValue(diff.runA.value)}</div></div>
        <div className="flex items-center justify-center"><ArrowRight className="w-3 h-3 text-gray-400" /></div>
        <div><div className="text-gray-500 mb-1 font-medium">Run B</div><div className="font-mono font-semibold text-gray-900">{formatEdgeValue(diff.runB.value)}</div></div>
      </div>
      {(diff.runA.provenance || diff.runB.provenance) && (
        <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-600">
          {diff.runA.provenance && <div className="mb-1"><span className="font-semibold">A:</span> {diff.runA.provenance}</div>}
          {diff.runB.provenance && <div><span className="font-semibold">B:</span> {diff.runB.provenance}</div>}
        </div>
      )}
    </div>
  )
}

function formatTimestamp(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  if (m > 0) return `${m}m ago`
  return 'just now'
}

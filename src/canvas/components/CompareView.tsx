import { useState, useEffect } from 'react'
import { ArrowLeft, Download } from 'lucide-react'
import { loadRuns, type StoredRun } from '../store/runHistory'
import { typography } from '../../styles/typography'
import { useCanvasStore } from '../store'
import { EdgeDiffTable } from '../compare/EdgeDiffTable'
import { CompareSummary } from '../compare/CompareSummary'
import { exportDecisionBrief } from '../export/decisionBrief'

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
  const [rationale, setRationale] = useState('')
  const [title, setTitle] = useState('Decision Comparison')
  const scenarioTitle = useCanvasStore(s => s.currentScenarioFraming?.title ?? null)

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

  const handleExportBrief = () => {
    if (!runA || !runB) return
    exportDecisionBrief({
      title,
      runA,
      runB,
      rationale: rationale || undefined
    })
  }

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <button onClick={onBack} className={`flex items-center gap-2 ${typography.body} text-gray-600 hover:text-gray-900 transition-colors`} type="button">
          <ArrowLeft className="w-4 h-4" />Back to Results
        </button>
        <h2 className="text-lg font-semibold text-gray-900">Compare Runs</h2>
        <div className="w-20" />
      </div>

      {scenarioTitle && (
        <div
          className={`px-4 py-2 ${typography.caption} text-gray-500`}
          data-testid="compare-view-scenario-context"
        >
          Current decision:{' '}
          <span className="font-medium text-gray-900">{scenarioTitle}</span>
        </div>
      )}

      <div className="p-4 grid grid-cols-2 gap-4 border-b border-gray-200 bg-gray-50">
        <div>
          <label className={`block ${typography.label} text-gray-700 mb-2`}>Run A</label>
          <select
            value={runA?.id || ''}
            onChange={(e) => handleSelectRun('A', e.target.value)}
            className={`w-full px-3 py-2 ${typography.body} border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-info-500`}
          >
            <option value="">Select run...</option>
            {runs.map(r => <option key={r.id} value={r.id}>Seed {r.seed} - {formatTimestamp(r.ts)}</option>)}
          </select>
        </div>
        <div>
          <label className={`block ${typography.label} text-gray-700 mb-2`}>Run B</label>
          <select
            value={runB?.id || ''}
            onChange={(e) => handleSelectRun('B', e.target.value)}
            className={`w-full px-3 py-2 ${typography.body} border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-info-500`}
          >
            <option value="">Select run...</option>
            {runs.map(r => <option key={r.id} value={r.id}>Seed {r.seed} - {formatTimestamp(r.ts)}</option>)}
          </select>
        </div>
      </div>

      {runA && runB ? (
        <>
          <CompareSummary runA={runA} runB={runB} />
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <RunSummaryCard run={runA} label="Run A" onOpen={() => onOpenInCanvas(runA.id)} />
              <RunSummaryCard run={runB} label="Run B" onOpen={() => onOpenInCanvas(runB.id)} />
            </div>

            <div>
              <h3 className={`${typography.label} text-gray-700 mb-3`}>Top 5 Edge Differences</h3>
              <EdgeDiffTable runA={runA} runB={runB} limit={5} />
            </div>

            <div>
              <h3 className={`${typography.label} text-gray-700 mb-2`}>Decision Rationale</h3>
              <textarea
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                placeholder="Document your reasoning for this decision..."
                className={`w-full px-3 py-2 ${typography.body} border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-info-500 min-h-[100px]`}
                aria-label="Decision rationale"
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Decision title..."
                className={`flex-1 px-3 py-2 ${typography.body} border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-info-500`}
                aria-label="Decision title"
              />
              <button
                onClick={handleExportBrief}
                className={`flex items-center gap-2 px-4 py-2 ${typography.button} text-white bg-info-600 rounded-lg hover:bg-info-700 transition-colors`}
                type="button"
                aria-label="Export decision brief"
              >
                <Download className="w-4 h-4" />
                Export Decision Brief
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className={`flex-1 flex items-center justify-center text-gray-500 ${typography.body}`}>
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
        <span className={`${typography.caption} font-semibold text-gray-500 uppercase tracking-wide`}>{label}</span>
        <button onClick={onOpen} className={`${typography.caption} text-info-600 hover:text-info-700 font-medium`} type="button">
          Open →
        </button>
      </div>
      <div className="space-y-1 mb-4 pb-4 border-b border-gray-100">
        <div className={typography.body}><span className="text-gray-600">Seed:</span> <span className="font-mono font-medium">{run.seed}</span></div>
        {run.hash && <div className={typography.body}><span className="text-gray-600">Hash:</span> <span className={`font-mono ${typography.caption}`}>{run.hash.slice(0, 12)}...</span></div>}
        <div className={`${typography.caption} text-gray-500`}>{formatTimestamp(run.ts)}</div>
      </div>
      {report?.summary ? (
        <div>
          <div className={`${typography.caption} font-semibold text-gray-700 mb-2 uppercase tracking-wide`}>Probability Bands</div>
          <div className="space-y-1.5">
            <BandRow label="p10" value={report.summary.conservative} unit={report.summary.units} />
            <BandRow label="p50" value={report.summary.likely} unit={report.summary.units} />
            <BandRow label="p90" value={report.summary.optimistic} unit={report.summary.units} />
          </div>
        </div>
      ) : <div className={`${typography.caption} text-gray-500`}>No data</div>}
    </div>
  )
}

function BandRow({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className={`flex items-center justify-between ${typography.body}`}>
      <span className="text-gray-600 font-medium">{label}:</span>
      <span className="font-semibold text-gray-900">{value.toFixed(1)} <span className={`${typography.caption} text-gray-500 font-normal`}>{unit}</span></span>
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

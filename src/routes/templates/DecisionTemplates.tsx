/**
 * Decision Templates - PLoT Phase A (Production Ready)
 */
import { useState, useEffect } from 'react'
import { runTemplate, fetchLimits, validateGraph, type RunResponse, type BeliefMode, type ApiLimits } from '../../lib/plotApi'
import { formatApiError } from '../../lib/plotErrors'
import { logPlotRun } from '../../lib/plotTelemetry'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { DeterminismTool } from './DeterminismTool'
import { OfflineBanner } from './components/OfflineBanner'
import { EmptyState } from './components/EmptyState'

// Import templates
import pricingTemplate from './data/pricing-v1.json'
import hiringTemplate from './data/hiring-v1.json'
import marketingTemplate from './data/marketing-v1.json'
import supplyTemplate from './data/supply-v1.json'
import featureTemplate from './data/feature-v1.json'
import investmentTemplate from './data/investment-v1.json'

const TEMPLATES = [
  pricingTemplate,
  hiringTemplate,
  marketingTemplate,
  supplyTemplate,
  featureTemplate,
  investmentTemplate
]

export function DecisionTemplates() {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [beliefMode, setBeliefMode] = useState<BeliefMode>('strict')
  const [seed, setSeed] = useState(42)
  const [result, setResult] = useState<RunResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [limits, setLimits] = useState<ApiLimits | null>(null)
  const [limitsLoading, setLimitsLoading] = useState(true)
  const isOnline = useOnlineStatus()

  const template = TEMPLATES.find(t => t.id === selectedTemplate)
  // TODO: Get token from session when auth is fully integrated
  const token = import.meta.env.VITE_PLOT_API_TOKEN || 'dev-token'
  
  const hasTemplates = TEMPLATES.length > 0

  // Fetch limits on mount
  useEffect(() => {
    const loadLimits = async () => {
      if (!token) {
        setLimitsLoading(false)
        return
      }
      
      try {
        const fetchedLimits = await fetchLimits(token)
        setLimits(fetchedLimits)
      } catch (err) {
        console.warn('[DecisionTemplates] Failed to fetch limits')
      } finally {
        setLimitsLoading(false)
      }
    }
    
    loadLimits()
  }, [token])

  const handleRun = async () => {
    if (!template || !token) return
    
    setLoading(true)
    setError(null)
    
    // Announce to screen readers
    const liveRegion = document.getElementById('plot-live-region')
    if (liveRegion) liveRegion.textContent = 'Running template…'
    
    try {
      // Validate against limits
      if (limits) {
        const validationError = validateGraph(template.graph as any, limits)
        if (validationError) {
          setError(formatApiError(validationError))
          if (liveRegion) liveRegion.textContent = formatApiError(validationError)
          return
        }
      }
      
      const response = await runTemplate({
        template_id: template.id,
        seed,
        belief_mode: beliefMode,
        graph: template.graph as any
      }, token)
      
      setResult(response)
      if (liveRegion) liveRegion.textContent = 'Results ready'
      
      // Telemetry (dev mode only, no PII)
      logPlotRun({
        template_id: response.meta.template_id,
        seed: response.meta.seed,
        belief_mode: beliefMode,
        response_hash: response.model_card.response_hash,
        elapsed_ms: response.meta.elapsed_ms
      })
    } catch (err: any) {
      const errorMessage = err.code ? formatApiError(err) : 'Something went wrong. Please try again.'
      setError(errorMessage)
      if (liveRegion) liveRegion.textContent = errorMessage
    } finally {
      setLoading(false)
    }
  }

  const handleCopyHash = () => {
    if (result) {
      navigator.clipboard.writeText(result.model_card.response_hash)
    }
  }

  const handleCopySeed = () => {
    navigator.clipboard.writeText(String(seed))
  }

  const handleCopyTemplateId = () => {
    if (template) {
      navigator.clipboard.writeText(template.id)
    }
  }

  const handleAddToNote = () => {
    if (!result || !template) return
    
    const block = `### Decision Result — ${template.id}
- Seed: ${seed}
- Response hash: ${result.model_card.response_hash}
- Bands: Conservative ${result.summary.bands.p10}, Likely ${result.summary.bands.p50}, Optimistic ${result.summary.bands.p90}
- Confidence: ${result.summary.confidence.level} (${result.summary.confidence.score})
`
    
    // TODO: Insert into Decision Note
    console.log('[AddToNote]', block)
    navigator.clipboard.writeText(block)
    alert('Copied to clipboard! Paste into your Decision Note.')
  }

  if (!token) {
    return (
      <div className="p-6" data-testid="decision-templates">
        <div className="bg-yellow-50 border border-yellow-300 rounded p-4">
          Sign in to run decision templates.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6" data-testid="decision-templates">
      <div id="plot-live-region" className="sr-only" aria-live="polite" aria-atomic="true"></div>
      
      <h1 className="text-2xl font-bold mb-2">Decision Templates</h1>
      <p className="text-gray-600 mb-6">Run deterministic analysis on canonical decision scenarios</p>
      
      {!isOnline && <OfflineBanner />}
      
      {limitsLoading && <div className="text-sm text-gray-500 mb-4">Loading limits…</div>}
      
      {!hasTemplates ? (
        <EmptyState onRetry={() => window.location.reload()} />
      ) : (
      <div className="grid grid-cols-2 gap-4 mb-6">
        {TEMPLATES.map(t => {
          const exceedsLimits = limits && (
            t.graph.nodes.length > limits.max_nodes ||
            t.graph.edges.length > limits.max_edges
          )
          
          return (
            <button
              key={t.id}
              onClick={() => setSelectedTemplate(t.id)}
              disabled={exceedsLimits}
              className={`p-4 border rounded text-left transition-colors ${
                selectedTemplate === t.id 
                  ? 'border-blue-500 bg-blue-50' 
                  : exceedsLimits
                  ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              data-testid={`template-${t.id}`}
              aria-label={`${t.name} template`}
            >
              <div className="font-semibold">{t.name}</div>
              <div className="text-sm text-gray-600">{t.graph.nodes.length} nodes · {t.graph.edges.length} edges</div>
              <div className="text-xs text-gray-500">{t.description}</div>
              {exceedsLimits && (
                <div className="text-xs text-red-600 mt-1">Exceeds limits</div>
              )}
            </button>
          )
        })}
      </div>
      )}

      {hasTemplates && template && (
        <div className="border rounded p-4 mb-4" data-testid="run-panel">
          <h2 className="font-semibold mb-3">Run Configuration</h2>
          
          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">Belief Mode</label>
            <div className="flex gap-2">
              <button
                onClick={() => setBeliefMode('strict')}
                className={`px-3 py-1 rounded text-sm ${beliefMode === 'strict' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                aria-pressed={beliefMode === 'strict'}
              >
                Strict
              </button>
              <button
                onClick={() => setBeliefMode('as_provided')}
                className={`px-3 py-1 rounded text-sm ${beliefMode === 'as_provided' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                aria-pressed={beliefMode === 'as_provided'}
              >
                Uncertainty
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {beliefMode === 'strict' ? 'Engine uses strict belief values' : 'Uses provided belief values'}
            </p>
          </div>

          <div className="mb-3">
            <label htmlFor="seed-input" className="block text-sm font-medium mb-1">Seed (for determinism)</label>
            <input
              id="seed-input"
              type="number"
              value={seed}
              onChange={e => setSeed(Number(e.target.value))}
              className="border rounded px-2 py-1 w-32"
              aria-label="Determinism seed"
            />
          </div>

          <button
            onClick={handleRun}
            disabled={loading || !isOnline}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="btn-run-template"
            aria-label={loading ? 'Running template' : !isOnline ? 'Offline - cannot run' : 'Run template'}
          >
            {loading ? 'Running…' : 'Run'}
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-300 rounded p-3 mb-4" role="alert" data-testid="error-message">
          {error}
        </div>
      )}

      {result && (
        <div className="border rounded p-4" data-testid="results-view">
          <h2 className="font-semibold mb-3">Results</h2>
          
          <div className="mb-4">
            <h3 className="text-sm font-medium mb-2">Bands</h3>
            <div className="space-y-1">
              <div className="text-sm"><span className="font-medium">Conservative (p10):</span> {result.summary.bands.p10}</div>
              <div className="text-sm"><span className="font-medium">Likely (p50):</span> {result.summary.bands.p50}</div>
              <div className="text-sm"><span className="font-medium">Optimistic (p90):</span> {result.summary.bands.p90}</div>
            </div>
          </div>

          <div className="mb-4">
            <h3 className="text-sm font-medium mb-2">Confidence</h3>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                result.summary.confidence.level === 'high' ? 'bg-green-100 text-green-800' :
                result.summary.confidence.level === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {result.summary.confidence.level}
              </span>
              <span className="text-sm text-gray-600">Score: {result.summary.confidence.score}</span>
            </div>
            {result.summary.confidence.reason && (
              <p className="text-xs text-gray-500 mt-1">{result.summary.confidence.reason}</p>
            )}
          </div>

          {result.critique.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium mb-2">Critique</h3>
              <ul className="space-y-1">
                {result.critique.map((c, i) => (
                  <li key={i} className="text-sm text-gray-700">• {c.text}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="border-t pt-4">
            <h3 className="text-sm font-medium mb-2">Reproduce</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">Template ID:</span>
                <code className="text-xs bg-gray-100 px-2 py-1 rounded">{template?.id}</code>
                <button onClick={handleCopyTemplateId} className="text-xs text-blue-600 hover:underline" aria-label="Copy template ID">
                  Copy
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">Seed:</span>
                <code className="text-xs bg-gray-100 px-2 py-1 rounded">{seed}</code>
                <button onClick={handleCopySeed} className="text-xs text-blue-600 hover:underline" aria-label="Copy seed">
                  Copy
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">Hash:</span>
                <code className="text-xs bg-gray-100 px-2 py-1 rounded">{result.model_card.response_hash.slice(0, 16)}...</code>
                <button onClick={handleCopyHash} className="text-xs text-blue-600 hover:underline" aria-label="Copy response hash">
                  Copy
                </button>
              </div>
            </div>
            
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => handleRun()}
                className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
                aria-label="Run again with same seed"
              >
                Run Again (Same Seed)
              </button>
              <button
                onClick={handleAddToNote}
                className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded"
                data-testid="btn-add-to-note"
                aria-label="Add to Decision Note"
              >
                Add to Decision Note
              </button>
            </div>
          </div>
        </div>
      )}
      
      {result && template && (
        <DeterminismTool
          request={{
            template_id: template.id,
            seed,
            belief_mode: beliefMode,
            graph: template.graph as any
          }}
          token={token}
        />
      )}
    </div>
  )
}

/**
 * Decision Templates - PLoT Phase A
 */
import { useState } from 'react'
import { runTemplate, fetchLimits, validateGraph, type RunResponse, type BeliefMode } from '../../lib/plotApi'

const TEMPLATES = [
  { id: 'pricing-v1', name: 'Pricing Decision', nodes: 8, edges: 12, goal: 'Maximize revenue' },
  { id: 'hiring-v1', name: 'Hiring Decision', nodes: 6, edges: 10, goal: 'Find best candidate' },
  { id: 'marketing-v1', name: 'Marketing Campaign', nodes: 7, edges: 11, goal: 'Increase conversions' },
  { id: 'supply-v1', name: 'Supply Chain', nodes: 9, edges: 14, goal: 'Minimize costs' },
  { id: 'feature-v1', name: 'Feature Trade-off', nodes: 5, edges: 8, goal: 'Ship fastest' },
  { id: 'investment-v1', name: 'Investment Choice', nodes: 6, edges: 9, goal: 'Maximize ROI' }
]

export function DecisionTemplates() {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [beliefMode, setBeliefMode] = useState<BeliefMode>('strict')
  const [seed, setSeed] = useState(42)
  const [result, setResult] = useState<RunResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleRun = async () => {
    if (!selectedTemplate) return
    
    setLoading(true)
    setError(null)
    
    try {
      // Stub: Replace with actual graph from template
      const graph = {
        goalNodeId: 'g1',
        nodes: [{ id: 'g1', kind: 'goal' as const, label: 'Test Goal' }],
        edges: []
      }
      
      const token = 'stub-token' // TODO: Get from auth
      const limits = await fetchLimits(token)
      const validationError = validateGraph(graph, limits)
      
      if (validationError) {
        setError(validationError.message)
        return
      }
      
      const response = await runTemplate({
        template_id: selectedTemplate,
        seed,
        belief_mode: beliefMode,
        graph
      }, token)
      
      setResult(response)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6" data-testid="decision-templates">
      <h1 className="text-2xl font-bold mb-6">Decision Templates</h1>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        {TEMPLATES.map(t => (
          <button
            key={t.id}
            onClick={() => setSelectedTemplate(t.id)}
            className={`p-4 border rounded ${selectedTemplate === t.id ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
            data-testid={`template-${t.id}`}
          >
            <div className="font-semibold">{t.name}</div>
            <div className="text-sm text-gray-600">{t.nodes} nodes · {t.edges} edges</div>
            <div className="text-xs text-gray-500">{t.goal}</div>
          </button>
        ))}
      </div>

      {selectedTemplate && (
        <div className="border rounded p-4 mb-4">
          <h2 className="font-semibold mb-3">Run Configuration</h2>
          
          <div className="mb-3">
            <label className="block text-sm mb-1">Belief Mode</label>
            <div className="flex gap-2">
              <button
                onClick={() => setBeliefMode('strict')}
                className={`px-3 py-1 rounded ${beliefMode === 'strict' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              >
                Strict
              </button>
              <button
                onClick={() => setBeliefMode('as_provided')}
                className={`px-3 py-1 rounded ${beliefMode === 'as_provided' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              >
                Uncertainty
              </button>
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-sm mb-1">Seed</label>
            <input
              type="number"
              value={seed}
              onChange={e => setSeed(Number(e.target.value))}
              className="border rounded px-2 py-1 w-24"
            />
          </div>

          <button
            onClick={handleRun}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
            data-testid="btn-run-template"
          >
            {loading ? 'Running...' : 'Run'}
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-300 rounded p-3 mb-4" role="alert">
          {error}
        </div>
      )}

      {result && (
        <div className="border rounded p-4">
          <h2 className="font-semibold mb-3">Results</h2>
          <div className="mb-3">
            <div className="text-sm text-gray-600">Conservative: {result.summary.bands.p10}</div>
            <div className="text-sm text-gray-600">Likely: {result.summary.bands.p50}</div>
            <div className="text-sm text-gray-600">Optimistic: {result.summary.bands.p90}</div>
          </div>
          <div className="text-xs text-gray-500">
            Hash: {result.model_card.response_hash.slice(0, 16)}...
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect, useCallback } from 'react'
import { plot } from '../../adapters/plot'
import type { TemplateDetail } from '../../adapters/plot'
import { useTemplatesRun } from '../templates/hooks/useTemplatesRun'
import { SummaryCard } from '../templates/components/SummaryCard'
import { WhyPanel } from '../templates/components/WhyPanel'
import { ReproduceShareCard } from '../templates/components/ReproduceShareCard'
import { ErrorBanner } from '../templates/components/ErrorBanner'
import { ProgressStrip } from '../templates/components/ProgressStrip'

export function CanvasPage(): JSX.Element {
  const [templates, setTemplates] = useState<TemplateDetail[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [seed, setSeed] = useState<string>('1337')
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  
  const { loading, result, error, run, clearError } = useTemplatesRun()
  
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId)

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const { items } = await plot.templates()
        const details = await Promise.all(items.map(item => plot.template(item.id)))
        setTemplates(details)
        if (details.length > 0) setSelectedTemplateId(details[0].id)
      } catch (err) {
        console.warn('[Canvas] Failed to load templates', err)
      }
    }
    loadTemplates()
    if (import.meta.env.DEV) console.debug('[Canvas] Adapter: mock')
  }, [])

  const handleRun = useCallback(async () => {
    if (!selectedTemplateId) return
    const seedNum = parseInt(seed, 10)
    if (isNaN(seedNum) || seedNum < 1) {
      setToastMessage('Please enter a valid seed (≥1)')
      return
    }
    await run({ template_id: selectedTemplateId, seed: seedNum })
  }, [selectedTemplateId, seed, run])

  const handleReset = useCallback(() => {
    clearError()
    setSeed('1337')
  }, [clearError])

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Templates Canvas</h1>
          <p className="text-sm text-gray-600">Answer-first decision templates powered by mock adapter</p>
        </header>

        {/* Dev Toolbar */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-yellow-800 uppercase tracking-wide">Dev Toolbar</span>
            <span className="text-xs bg-yellow-200 text-yellow-900 px-2 py-1 rounded font-mono">Adapter: Mock</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="template-select" className="block text-sm font-medium text-gray-700 mb-1">
                Template
              </label>
              <select
                id="template-select"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="seed-input" className="block text-sm font-medium text-gray-700 mb-1">
                Seed
              </label>
              <input
                id="seed-input"
                type="number"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={handleRun}
                disabled={loading || !selectedTemplateId}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Running…' : 'Run'}
              </button>
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Progress */}
        <ProgressStrip isVisible={loading} />

        {/* Error */}
        {error && (
          <div className="mb-6">
            <ErrorBanner error={error} onRetry={handleRun} onDismiss={clearError} />
          </div>
        )}

        {/* Results */}
        {result && selectedTemplate && (
          <div className="space-y-6">
            <SummaryCard 
              report={result} 
              onCopyHash={() => showToast('Verification hash copied.')}
            />
            <WhyPanel report={result} />
            <ReproduceShareCard
              report={result}
              template={selectedTemplate}
              seed={parseInt(seed, 10)}
              onCopySeed={() => showToast('Seed copied.')}
              onCopyHash={() => showToast('Verification hash copied.')}
              onAddToNote={() => showToast('Added to Note.')}
            />
          </div>
        )}

        {/* Toast */}
        {toastMessage && (
          <div 
            role="status" 
            aria-live="polite"
            className="fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg"
          >
            {toastMessage}
          </div>
        )}
      </div>
    </div>
  )
}

import { useState, useEffect, useCallback, useRef } from 'react'
import { plot } from '../../adapters/plot'
import type { TemplateDetail, RunRequest } from '../../adapters/plot'
import { useTemplatesRun } from './hooks/useTemplatesRun'
import { SummaryCard } from './components/SummaryCard'
import { WhyPanel } from './components/WhyPanel'
import { ReproduceShareCard } from './components/ReproduceShareCard'
import { ErrorBanner } from './components/ErrorBanner'
import { ProgressStrip } from './components/ProgressStrip'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { useFocusManagement } from '../../hooks/useFocusManagement'
import { useNotesStore } from '../../notes/notesStore'
import { Toast } from '../../components/Toast'

export function DecisionTemplates() {
  const [templates, setTemplates] = useState<TemplateDetail[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [seed, setSeed] = useState(1337)
  const [mode, setMode] = useState<'strict' | 'real'>('strict')
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null)
  
  const isOnline = useOnlineStatus()
  const headingRef = useFocusManagement('templates')
  const addBlock = useNotesStore(s => s.addBlock)
  const undo = useNotesStore(s => s.undo)
  
  const { loading, result, error, retryAfter, run, clearError } = useTemplatesRun()
  
  const template = templates.find(t => t.id === selectedTemplate)
  const hasTemplates = templates.length > 0

  // Load templates on mount
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const { items } = await plot.templates()
        const details = await Promise.all(
          items.map(item => plot.template(item.id))
        )
        setTemplates(details)
        if (details.length > 0 && !selectedTemplate) {
          setSelectedTemplate(details[0].id)
        }
      } catch (err) {
        console.warn('[DecisionTemplates] Failed to load templates')
      }
    }
    
    loadTemplates()
  }, [selectedTemplate])

  // Handle retry countdown
  useEffect(() => {
    if (retryAfter && retryAfter > 0) {
      setRetryCountdown(retryAfter)
      const interval = setInterval(() => {
        setRetryCountdown(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(interval)
            return null
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [retryAfter])

  // Handle keyboard shortcuts (⌘Z for undo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo])

  const handleRun = useCallback(async () => {
    if (!template || !isOnline) return
    
    const request: RunRequest = {
      template_id: template.id,
      seed,
      mode
    }
    
    await run(request)
  }, [template, seed, mode, isOnline, run])

  const handleCopyHash = useCallback(() => {
    if (result?.model_card?.response_hash) {
      navigator.clipboard.writeText(result.model_card.response_hash)
      setToastMessage('Verification hash copied')
    }
  }, [result])

  const handleCopySeed = useCallback(() => {
    setToastMessage('Seed copied')
  }, [])

  const handleAddToNote = useCallback(() => {
    if (!result || !template) return
    
    const block = {
      id: `plot-${Date.now()}`,
      type: 'plot_result' as const,
      timestamp: new Date().toISOString(),
      data: {
        template_id: template.id,
        seed,
        response_hash: result.model_card.response_hash,
        likely: result.results.likely,
        conservative: result.results.conservative,
        optimistic: result.results.optimistic,
        confidence: result.confidence.level,
        mode
      }
    }
    
    addBlock(block)
    setToastMessage('Added to Decision Note — press ⌘Z to undo')
  }, [result, template, seed, mode, addBlock])

  const handleRetry = useCallback(() => {
    if (retryCountdown === null || retryCountdown <= 0) {
      clearError()
      handleRun()
    }
  }, [retryCountdown, clearError, handleRun])

  return (
    <div className="p-6" data-testid="decision-templates">
      <div id="plot-live-region" className="sr-only" aria-live="polite" aria-atomic="true"></div>
      
      <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold mb-2 focus:outline-none">
        Decision Templates
      </h1>
      <p className="text-gray-600 mb-6">Run deterministic analysis on canonical decision scenarios</p>
      
      <ProgressStrip isVisible={loading} />
      
      {error && (
        <ErrorBanner
          error={error}
          retryAfter={retryCountdown}
          onRetry={handleRetry}
          onDismiss={clearError}
        />
      )}
      
      {!hasTemplates ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No templates available</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Refresh
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 mb-6">
            {templates.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedTemplate(t.id)}
                className={`p-4 border rounded text-left transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  selectedTemplate === t.id 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                data-testid={`template-${t.id}`}
                aria-label={`${t.name} template`}
              >
                <div className="font-semibold">{t.name}</div>
                <div className="text-xs text-gray-500">{t.description}</div>
              </button>
            ))}
          </div>

          {template && (
            <div className="border rounded p-4 mb-6" data-testid="run-panel">
              <h2 className="font-semibold mb-3">Run Configuration</h2>
              
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Mode</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMode('strict')}
                    className={`px-3 py-1 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
                      mode === 'strict' ? 'bg-blue-500 text-white' : 'bg-gray-200'
                    }`}
                    aria-pressed={mode === 'strict'}
                  >
                    Strict
                  </button>
                  <button
                    onClick={() => setMode('real')}
                    className={`px-3 py-1 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
                      mode === 'real' ? 'bg-blue-500 text-white' : 'bg-gray-200'
                    }`}
                    aria-pressed={mode === 'real'}
                  >
                    Real-world
                  </button>
                </div>
              </div>

              <div className="mb-3">
                <label htmlFor="seed-input" className="block text-sm font-medium mb-1">
                  Seed (for determinism)
                </label>
                <input
                  id="seed-input"
                  type="number"
                  value={seed}
                  onChange={e => setSeed(Number(e.target.value))}
                  className="border rounded px-2 py-1 w-32 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-1"
                  aria-label="Determinism seed"
                />
              </div>

              <button
                onClick={handleRun}
                disabled={loading || !isOnline}
                className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                data-testid="btn-run-template"
                aria-disabled={loading || !isOnline}
                aria-label={loading ? 'Running template' : !isOnline ? 'Offline - cannot run' : 'Run template'}
              >
                {loading ? 'Running…' : 'Run'}
              </button>
            </div>
          )}

          {result && template && (
            <div className="space-y-6">
              <SummaryCard report={result} onCopyHash={handleCopyHash} />
              <WhyPanel report={result} />
              <ReproduceShareCard
                report={result}
                template={template}
                seed={seed}
                onCopySeed={handleCopySeed}
                onCopyHash={handleCopyHash}
                onAddToNote={handleAddToNote}
              />
            </div>
          )}
        </>
      )}
      
      {toastMessage && (
        <Toast
          message={toastMessage}
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  )
}

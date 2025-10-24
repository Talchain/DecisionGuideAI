import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Search } from 'lucide-react'
import { plot } from '../../adapters/plot'
import { getAllBlueprints, getBlueprintById } from '../../templates/blueprints'
import type { Blueprint } from '../../templates/blueprints/types'
import { useTemplatesRun } from '../../routes/templates/hooks/useTemplatesRun'
import { SummaryCard } from '../../routes/templates/components/SummaryCard'
import { WhyPanel } from '../../routes/templates/components/WhyPanel'
import { ReproduceShareCard } from '../../routes/templates/components/ReproduceShareCard'
import { ErrorBanner } from '../../routes/templates/components/ErrorBanner'
import { ProgressStrip } from '../../routes/templates/components/ProgressStrip'
import { TemplateCard } from './TemplateCard'
import { TemplateAbout } from './TemplateAbout'

interface TemplatesPanelProps {
  isOpen: boolean
  onClose: () => void
  onInsertBlueprint?: (blueprint: Blueprint) => void
  onPinToCanvas?: (data: { template_id: string; seed: number; response_hash: string; likely_value: number }) => void
}

export function TemplatesPanel({ isOpen, onClose, onInsertBlueprint, onPinToCanvas }: TemplatesPanelProps): JSX.Element | null {
  const [blueprints] = useState(() => getAllBlueprints())
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBlueprintId, setSelectedBlueprintId] = useState<string | null>(null)
  const [showDevControls, setShowDevControls] = useState(false)
  const [seed, setSeed] = useState<string>('1337')
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  
  const { loading, result, error, run, clearError } = useTemplatesRun()
  
  const selectedBlueprint = selectedBlueprintId ? getBlueprintById(selectedBlueprintId) : null

  const filteredBlueprints = blueprints.filter(bp =>
    bp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    bp.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Focus management
  useEffect(() => {
    if (isOpen && panelRef.current) {
      const firstFocusable = panelRef.current.querySelector<HTMLElement>('button, input')
      firstFocusable?.focus()
    }
  }, [isOpen])

  const handleInsert = useCallback((templateId: string) => {
    const blueprint = getBlueprintById(templateId)
    if (blueprint && onInsertBlueprint) {
      onInsertBlueprint(blueprint)
      setSelectedBlueprintId(templateId)
      showToast('Inserted to canvas.')
    }
  }, [onInsertBlueprint])

  const handleRun = useCallback(async () => {
    if (!selectedBlueprintId) return
    const seedNum = parseInt(seed, 10)
    if (isNaN(seedNum) || seedNum < 1) {
      showToast('Please enter a valid seed (≥1)')
      return
    }
    await run({ template_id: selectedBlueprintId, seed: seedNum })
  }, [selectedBlueprintId, seed, run])

  const handleReset = useCallback(() => {
    clearError()
    setSeed('1337')
    setSelectedBlueprintId(null)
  }, [clearError])

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }, [])

  const handlePinToCanvas = useCallback(() => {
    if (result && selectedBlueprint && onPinToCanvas) {
      onPinToCanvas({
        template_id: selectedBlueprint.id,
        seed: parseInt(seed, 10),
        response_hash: result.model_card.response_hash,
        likely_value: result.results.likely
      })
      showToast('Pinned to canvas.')
    }
  }, [result, selectedBlueprint, seed, onPinToCanvas, showToast])

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  // Keyboard shortcut: Cmd/Ctrl+T to toggle, Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 't') {
        e.preventDefault()
        if (isOpen) handleClose()
      }
      if (e.key === 'Escape' && isOpen) {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleClose])

  if (!isOpen) return null

  return (
    <>
      {/* Overlay for mobile */}
      <div 
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={handleClose}
        aria-hidden="true"
      />
      
      {/* Panel */}
      <div
        ref={panelRef}
        role="complementary"
        aria-label="Templates"
        className="fixed right-0 top-0 h-full w-full md:w-96 bg-white shadow-2xl z-50 flex flex-col overflow-hidden"
        style={{ maxWidth: '420px' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
          <h2 className="text-lg font-semibold text-gray-900">Templates</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Close templates panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Template Browser */}
          {!selectedBlueprintId && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              
              <div className="space-y-3">
                {filteredBlueprints.map(bp => (
                  <TemplateCard
                    key={bp.id}
                    template={{ id: bp.id, name: bp.name, description: bp.description }}
                    onInsert={handleInsert}
                  />
                ))}
              </div>
            </>
          )}

          {/* About Section */}
          {selectedBlueprint && (
            <>
              <TemplateAbout blueprint={selectedBlueprint} />
              
              <button
                onClick={() => setSelectedBlueprintId(null)}
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                ← Back to templates
              </button>
            </>
          )}

          {/* Dev Controls Toggle */}
          {selectedBlueprintId && (
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <label htmlFor="dev-toggle" className="text-sm font-medium text-gray-700">
                Show dev controls
              </label>
              <button
                id="dev-toggle"
                role="switch"
                aria-checked={showDevControls}
                onClick={() => setShowDevControls(!showDevControls)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  showDevControls ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    showDevControls ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          )}

          {/* Dev Toolbar (collapsible) */}
          {showDevControls && selectedBlueprintId && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-yellow-800 uppercase tracking-wide">Dev Controls</span>
                <span className="text-xs bg-yellow-200 text-yellow-900 px-2 py-1 rounded font-mono">Adapter: Mock</span>
              </div>
              <div className="space-y-3">
                <div>
                  <label htmlFor="seed-input" className="block text-sm font-medium text-gray-700 mb-1">
                    Seed
                  </label>
                  <input
                    id="seed-input"
                    type="number"
                    value={seed}
                    onChange={(e) => setSeed(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleRun}
                    disabled={loading || !selectedBlueprintId}
                    className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Running…' : 'Run'}
                  </button>
                  <button
                    onClick={handleReset}
                    className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Progress */}
          <ProgressStrip isVisible={loading} />

          {/* Error */}
          {error && (
            <ErrorBanner error={error} onRetry={handleRun} onDismiss={clearError} />
          )}

          {/* Results */}
          {result && selectedBlueprint && (
            <div className="space-y-4">
              <SummaryCard 
                report={result} 
                onCopyHash={() => showToast('Verification hash copied.')}
              />
              <WhyPanel report={result} />
              <ReproduceShareCard
                report={result}
                template={{ 
                  id: selectedBlueprint.id,
                  name: selectedBlueprint.name,
                  version: '1.0',
                  description: selectedBlueprint.description,
                  default_seed: parseInt(seed, 10),
                  graph: {}
                }}
                seed={parseInt(seed, 10)}
                onCopySeed={() => showToast('Seed copied.')}
                onCopyHash={() => showToast('Verification hash copied.')}
                onAddToNote={() => showToast('Added to Note.')}
              />
              
              {/* Pin to Canvas button */}
              {onPinToCanvas && (
                <button
                  onClick={handlePinToCanvas}
                  className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  Pin to Canvas
                </button>
              )}
            </div>
          )}
        </div>

        {/* Toast */}
        {toastMessage && (
          <div 
            role="status" 
            aria-live="polite"
            className="absolute bottom-4 left-4 right-4 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg text-sm"
          >
            {toastMessage}
          </div>
        )}
      </div>
    </>
  )
}

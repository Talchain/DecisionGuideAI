import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, Layout } from 'lucide-react'
import { plot, adapterName } from '../../adapters/plot'
import type { Blueprint } from '../../templates/blueprints/types'
import { useTemplatesRun } from '../../routes/templates/hooks/useTemplatesRun'
import { SummaryCard } from '../../routes/templates/components/SummaryCard'
import { WhyPanel } from '../../routes/templates/components/WhyPanel'
import { ReproduceShareCard } from '../../routes/templates/components/ReproduceShareCard'
import { ErrorBanner } from '../../routes/templates/components/ErrorBanner'
import { ProgressStrip } from '../../routes/templates/components/ProgressStrip'
import { TemplateCard } from './TemplateCard'
import { TemplateAbout } from './TemplateAbout'
import { PlotHealthPill } from '../../adapters/plot/v1/components/PlotHealthPill'
import { AdapterStatusBanner } from './AdapterStatusBanner'
import { PanelShell } from './_shared/PanelShell'
import { PanelSection } from './_shared/PanelSection'

interface TemplatesPanelProps {
  isOpen: boolean
  onClose: () => void
  onInsertBlueprint?: (blueprint: Blueprint) => void
  onPinToCanvas?: (data: { template_id: string; seed: number; response_hash: string; likely_value: number }) => void
}

export function TemplatesPanel({ isOpen, onClose, onInsertBlueprint, onPinToCanvas }: TemplatesPanelProps): JSX.Element | null {
  const [blueprints, setBlueprints] = useState<Array<{ id: string; name: string; description: string }>>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBlueprintId, setSelectedBlueprintId] = useState<string | null>(null)
  const [selectedBlueprint, setSelectedBlueprint] = useState<Blueprint | null>(null)
  const [showDevControls, setShowDevControls] = useState(false)
  const [seed, setSeed] = useState<string>('1337')
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const { loading, progress, canCancel, result, error, run, cancel, clearError } = useTemplatesRun()

  // Load templates from adapter (supports both mock and httpv1)
  useEffect(() => {
    plot.templates()
      .then(list => {
        // Safety check: ensure items array exists
        if (!list || !Array.isArray(list.items)) {
          console.error('❌ Invalid templates response:', list)
          setBlueprints([])
          return
        }
        setBlueprints(list.items.map(t => ({
          id: t.id,
          name: t.name,
          description: t.description
        })))
      })
      .catch(err => {
        console.error('❌ Failed to load templates from PLoT engine:', err)
        // NO FALLBACK - fail loudly to surface issues
        setBlueprints([])
      })
  }, [])

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

  const handleInsert = useCallback(async (templateId: string) => {
    try {
      // Fetch template from API (works for both mock and httpv1)
      const templateDetail = await plot.template(templateId)

      // Convert to Blueprint format for canvas insertion
      const blueprint: Blueprint = {
        id: templateDetail.id,
        name: templateDetail.name,
        description: templateDetail.description,
        version: templateDetail.version,
        graph: templateDetail.graph,
      }

      if (onInsertBlueprint) {
        onInsertBlueprint(blueprint)
        setSelectedBlueprintId(templateId)
        setSelectedBlueprint(blueprint)
        setSeed(String(templateDetail.default_seed))
        showToast('Inserted to canvas.')
      }
    } catch (err) {
      console.error('Failed to load template:', err)
      showToast('Failed to load template.')
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
    setSelectedBlueprint(null)
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

  // Health chip
  const healthChip = (adapterName === 'httpv1' || adapterName === 'auto') ? (
    <PlotHealthPill pause={!isOpen} />
  ) : undefined

  // Footer with Run button (only show when template loaded and not running)
  const footer = selectedBlueprintId && !loading ? (
    <button
      onClick={handleRun}
      disabled={loading}
      className={`w-full px-6 py-3 text-base font-semibold rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 disabled:opacity-50 disabled:cursor-not-allowed ${
        result
          ? 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
          : 'text-white bg-blue-600 hover:bg-blue-700 shadow-sm hover:shadow-md'
      }`}
      type="button"
    >
      {loading ? 'Running Analysis…' : result ? 'Analyze again' : '▶ Run Analysis'}
    </button>
  ) : undefined

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[1999]"
        onClick={handleClose}
      />

      {/* Panel Shell */}
      <div className="fixed right-0 top-0 bottom-0 z-[2000]" ref={panelRef}>
        <PanelShell
          icon={<Layout className="w-5 h-5" />}
          title="Templates"
          chips={healthChip}
          onClose={handleClose}
          footer={footer}
          width="420px"
        >
          <div className="relative">
            {/* Adapter Status Banner (dev-only, shows when v1 unavailable) */}
            <AdapterStatusBanner visible={isOpen && adapterName === 'auto'} />
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
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--olumi-primary)]"
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
                onClick={() => {
                  setSelectedBlueprintId(null)
                  setSelectedBlueprint(null)
                }}
                className="text-sm font-medium"
                style={{ color: 'var(--olumi-primary)' }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--olumi-primary-700)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--olumi-primary)'}
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
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--olumi-primary)]"
                style={{ backgroundColor: showDevControls ? 'var(--olumi-primary)' : '#d1d5db' }}
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
                <span className="text-xs bg-yellow-200 text-yellow-900 px-2 py-1 rounded font-mono">Adapter: {adapterName}</span>
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
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--olumi-primary)]"
                    min="1"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleRun}
                    disabled={loading || !selectedBlueprintId}
                    className="flex-1 px-4 py-2 text-sm text-white rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--olumi-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: 'var(--olumi-primary)' }}
                    onMouseEnter={(e) => !loading && !selectedBlueprintId ? null : e.currentTarget.style.backgroundColor = 'var(--olumi-primary-700)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--olumi-primary)'}
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
          <ProgressStrip
            isVisible={loading}
            progress={progress}
            canCancel={canCancel}
            onCancel={cancel}
          />

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
                  className="w-full px-4 py-2 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--olumi-primary)]"
                  style={{ backgroundColor: 'var(--olumi-primary)' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--olumi-primary-700)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--olumi-primary)'}
                >
                  Pin to Canvas
                </button>
              )}
            </div>
          )}

            {/* Toast */}
            {toastMessage && (
              <div
                role="status"
                aria-live="polite"
                className="absolute bottom-4 left-0 right-0 mx-4 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg text-sm"
              >
                {toastMessage}
              </div>
            )}
          </div>
        </PanelShell>
      </div>
    </>
  )
}

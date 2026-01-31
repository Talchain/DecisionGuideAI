import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { useCanvasStore } from '../store'
import { DEFAULT_MODELS, formatTier, type ModelInfo, type OperationType } from '../../config/aiModels'
import { useAvailableModels } from '../../hooks/useAvailableModels'
import { typography } from '../../styles/typography'

interface ModelSettingsPopoverProps {
  isOpen: boolean
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement>
}

/**
 * Model Settings Popover - Progressive disclosure for AI model selection
 *
 * Displays three dropdowns for selecting models for different operations:
 * - Generation: Creates the initial draft graph
 * - Repair: Fixes structural issues in the graph
 * - Enrichment: Adds detail and context to nodes/edges
 *
 * Features:
 * - Dynamic model list fetched from CEE API
 * - Curated models by default with "Show all" toggle
 * - Only non-default selections are sent to the API
 */
export function ModelSettingsPopover({ isOpen, onClose, anchorRef }: ModelSettingsPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ top: 0, right: 0 })
  const [showAllModels, setShowAllModels] = useState(false)
  const [showEnrichment, setShowEnrichment] = useState(false)

  // Fetch available models from API
  const { getCuratedModels, getAllModels, getDefaultModelId, isLoading, isFallback } = useAvailableModels()

  // Get model selection state from store
  const selectedGenerationModel = useCanvasStore((s) => s.selectedGenerationModel)
  const selectedRepairModel = useCanvasStore((s) => s.selectedRepairModel)
  const selectedEnrichmentModel = useCanvasStore((s) => s.selectedEnrichmentModel)
  const setSelectedGenerationModel = useCanvasStore((s) => s.setSelectedGenerationModel)
  const setSelectedRepairModel = useCanvasStore((s) => s.setSelectedRepairModel)
  const setSelectedEnrichmentModel = useCanvasStore((s) => s.setSelectedEnrichmentModel)

  // Get effective default model IDs from API (fallback to hardcoded)
  const defaultGeneration = getDefaultModelId('generation') || DEFAULT_MODELS.generation
  const defaultRepair = getDefaultModelId('repair') || DEFAULT_MODELS.repair
  const defaultEnrichment = getDefaultModelId('enrichment') || DEFAULT_MODELS.enrichment

  // Get effective model IDs (use default if null)
  const effectiveGenerationModel = selectedGenerationModel ?? defaultGeneration
  const effectiveRepairModel = selectedRepairModel ?? defaultRepair
  const effectiveEnrichmentModel = selectedEnrichmentModel ?? defaultEnrichment

  // Get models to display based on toggle
  const getModelsForOperation = (operation: OperationType): ModelInfo[] => {
    if (showAllModels) {
      return getAllModels()
    }
    return getCuratedModels(operation)
  }

  // Calculate popover position based on anchor element
  useEffect(() => {
    if (!isOpen || !anchorRef.current) return

    const updatePosition = () => {
      const anchor = anchorRef.current
      if (!anchor) return

      const rect = anchor.getBoundingClientRect()
      setPosition({
        top: rect.bottom + 8, // 8px gap below the button
        right: window.innerWidth - rect.right, // Align right edge with button
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [isOpen, anchorRef])

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      // Don't close if clicking the anchor button or inside the popover
      if (
        anchorRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return
      }
      onClose()
    }

    // Add slight delay to avoid immediate close on button click
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose, anchorRef])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // Focus trap - focus first focusable element when opened
  useEffect(() => {
    if (isOpen && popoverRef.current) {
      const focusableElements = popoverRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      const firstElement = focusableElements[0] as HTMLElement | undefined
      firstElement?.focus()
    }
  }, [isOpen])

  if (!isOpen) return null

  const allModelsCount = getAllModels().length

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 w-80 max-w-[calc(100vw-2rem)] max-h-[calc(100vh-4rem)] bg-paper-50 rounded-[20px] shadow-2 border border-sand-200 flex flex-col"
      style={{
        top: `${position.top}px`,
        right: `${position.right}px`,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="model-settings-title"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-sand-100 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h3 id="model-settings-title" className={`${typography.label} text-ink-900`}>
            Model Settings
          </h3>
          {isLoading && <Loader2 className="w-4 h-4 text-ink-400 animate-spin" />}
        </div>
        <p className={`${typography.bodySmall} text-ink-500 mt-0.5`}>
          Choose AI models for each operation
          {isFallback && !isLoading && (
            <span className="text-carrot-600"> (offline mode)</span>
          )}
        </p>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 overflow-y-auto flex-grow">
        {/* Generation Model */}
        <ModelDropdown
          label="Generation"
          description="Creates the initial draft graph"
          models={getModelsForOperation('generation')}
          selectedModelId={effectiveGenerationModel}
          defaultModelId={defaultGeneration}
          onSelect={(modelId) => {
            // If selecting the default, store null to keep payload clean
            setSelectedGenerationModel(
              modelId === defaultGeneration ? null : modelId
            )
          }}
        />

        {/* Enrichment Model - Collapsible */}
        <div>
          <button
            onClick={() => setShowEnrichment(!showEnrichment)}
            className="w-full flex items-center gap-2 mb-2"
          >
            {showEnrichment ? (
              <ChevronDown className="w-4 h-4 text-ink-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-ink-400" />
            )}
            <span className={`${typography.labelSmall} text-ink-700`}>Enrichment</span>
            <span className={`${typography.bodySmall} text-ink-400`}>— Adds detail and context</span>
          </button>
          {showEnrichment && (
            <ModelDropdown
              models={getModelsForOperation('enrichment')}
              selectedModelId={effectiveEnrichmentModel}
              defaultModelId={defaultEnrichment}
              onSelect={(modelId) => {
                setSelectedEnrichmentModel(
                  modelId === defaultEnrichment ? null : modelId
                )
              }}
            />
          )}
        </div>

        {/* Show All Models Toggle */}
        <button
          onClick={() => setShowAllModels(!showAllModels)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-sand-50 hover:bg-sand-100 text-ink-600 transition-colors"
        >
          <span className={typography.bodySmall}>
            {showAllModels ? 'Show recommended only' : `Show all models (${allModelsCount})`}
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform ${showAllModels ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-sand-100 bg-sand-50 rounded-b-[20px] flex-shrink-0">
        <p className={`${typography.bodySmall} text-ink-500`}>
          Only non-default selections are sent to the API
        </p>
      </div>
    </div>
  )
}

interface ModelDropdownProps {
  label?: string
  description?: string
  models: ModelInfo[]
  selectedModelId: string
  defaultModelId: string
  onSelect: (modelId: string) => void
}

function ModelDropdown({
  label,
  description,
  models,
  selectedModelId,
  defaultModelId,
  onSelect,
}: ModelDropdownProps) {
  // Group models by tier
  const groupedModels = models.reduce((acc, model) => {
    const tier = model.tier || 'quality'
    if (!acc[tier]) acc[tier] = []
    acc[tier].push(model)
    return acc
  }, {} as Record<string, ModelInfo[]>)

  // Define tier order
  const tierOrder = ['premium', 'quality', 'fast']
  const sortedTiers = Object.keys(groupedModels).sort(
    (a, b) => tierOrder.indexOf(a) - tierOrder.indexOf(b)
  )

  return (
    <div>
      {label && (
        <label className={`${typography.labelSmall} text-ink-700 block mb-1`}>
          {label}
        </label>
      )}
      {description && (
        <p className={`${typography.bodySmall} text-ink-500 mb-2`}>{description}</p>
      )}
      <div className="space-y-1">
        {sortedTiers.map((tier) => (
          <div key={tier}>
            {/* Show tier header only when showing all models or multiple tiers */}
            {sortedTiers.length > 1 && (
              <div className={`${typography.labelSmall} text-ink-400 px-2 py-1 text-xs uppercase tracking-wider`}>
                {formatTier(tier as 'premium' | 'quality' | 'fast')}
              </div>
            )}
            {groupedModels[tier].map((model) => {
              const isSelected = model.id === selectedModelId
              const isDefault = model.id === defaultModelId

              return (
                <button
                  key={model.id}
                  onClick={() => onSelect(model.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-colors ${
                    isSelected
                      ? 'bg-sky-50 border-sky-200 text-sky-900'
                      : 'bg-white border-sand-200 text-ink-700 hover:bg-sand-50'
                  }`}
                >
                  <div className="flex flex-col items-start text-left">
                    <span className={typography.bodySmall}>
                      {model.displayName}
                      {isDefault && (
                        <span className="ml-1 text-xs text-ink-500">(Default)</span>
                      )}
                    </span>
                    <span className="text-xs text-ink-400">
                      {model.provider} · {formatTier(model.tier)}
                      {model.isReasoning && ' · Reasoning'}
                    </span>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-sky-600 flex-shrink-0" />}
                </button>
              )
            })}
          </div>
        ))}
        {models.length === 0 && (
          <p className={`${typography.bodySmall} text-ink-400 text-center py-4`}>
            No models available
          </p>
        )}
      </div>
    </div>
  )
}

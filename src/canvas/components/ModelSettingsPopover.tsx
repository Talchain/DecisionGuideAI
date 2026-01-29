import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { useCanvasStore } from '../store'
import { AI_MODELS, DEFAULT_MODELS, getModelDisplayName } from '../../config/aiModels'
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
 * Only non-default selections are sent to the API to keep payloads clean.
 */
export function ModelSettingsPopover({ isOpen, onClose, anchorRef }: ModelSettingsPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ top: 0, right: 0 })

  // Get model selection state from store
  const selectedGenerationModel = useCanvasStore((s) => s.selectedGenerationModel)
  const selectedRepairModel = useCanvasStore((s) => s.selectedRepairModel)
  const selectedEnrichmentModel = useCanvasStore((s) => s.selectedEnrichmentModel)
  const setSelectedGenerationModel = useCanvasStore((s) => s.setSelectedGenerationModel)
  const setSelectedRepairModel = useCanvasStore((s) => s.setSelectedRepairModel)
  const setSelectedEnrichmentModel = useCanvasStore((s) => s.setSelectedEnrichmentModel)

  // Get effective model IDs (use default if null)
  const effectiveGenerationModel = selectedGenerationModel ?? DEFAULT_MODELS.generation
  const effectiveRepairModel = selectedRepairModel ?? DEFAULT_MODELS.repair
  const effectiveEnrichmentModel = selectedEnrichmentModel ?? DEFAULT_MODELS.enrichment

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

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 w-80 max-w-[calc(100vw-2rem)] bg-paper-50 rounded-[20px] shadow-2 border border-sand-200"
      style={{
        top: `${position.top}px`,
        right: `${position.right}px`,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="model-settings-title"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-sand-100">
        <h3 id="model-settings-title" className={`${typography.label} text-ink-900`}>
          Model Settings
        </h3>
        <p className={`${typography.bodySmall} text-ink-500 mt-0.5`}>
          Choose AI models for each operation
        </p>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Generation Model */}
        <ModelDropdown
          label="Generation"
          description="Creates the initial draft graph"
          selectedModelId={effectiveGenerationModel}
          defaultModelId={DEFAULT_MODELS.generation}
          onSelect={(modelId) => {
            // If selecting the default, store null to keep payload clean
            setSelectedGenerationModel(
              modelId === DEFAULT_MODELS.generation ? null : modelId
            )
          }}
        />

        {/* Repair Model */}
        <ModelDropdown
          label="Repair"
          description="Fixes structural issues"
          selectedModelId={effectiveRepairModel}
          defaultModelId={DEFAULT_MODELS.repair}
          onSelect={(modelId) => {
            setSelectedRepairModel(
              modelId === DEFAULT_MODELS.repair ? null : modelId
            )
          }}
        />

        {/* Enrichment Model */}
        <ModelDropdown
          label="Enrichment"
          description="Adds detail and context"
          selectedModelId={effectiveEnrichmentModel}
          defaultModelId={DEFAULT_MODELS.enrichment}
          onSelect={(modelId) => {
            setSelectedEnrichmentModel(
              modelId === DEFAULT_MODELS.enrichment ? null : modelId
            )
          }}
        />
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-sand-100 bg-sand-50 rounded-b-lg">
        <p className={`${typography.bodySmall} text-ink-500`}>
          Only non-default selections are sent to the API
        </p>
      </div>
    </div>
  )
}

interface ModelDropdownProps {
  label: string
  description: string
  selectedModelId: string
  defaultModelId: string
  onSelect: (modelId: string) => void
}

function ModelDropdown({
  label,
  description,
  selectedModelId,
  defaultModelId,
  onSelect,
}: ModelDropdownProps) {
  return (
    <div>
      <label className={`${typography.labelSmall} text-ink-700 block mb-1`}>
        {label}
      </label>
      <p className={`${typography.bodySmall} text-ink-500 mb-2`}>{description}</p>
      <div className="space-y-1">
        {AI_MODELS.map((model) => {
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
              <div className="flex flex-col items-start">
                <span className={typography.bodySmall}>
                  {model.displayName}
                  {isDefault && (
                    <span className="ml-1 text-xs text-ink-500">(Default)</span>
                  )}
                </span>
                <span className="text-xs text-ink-400">{model.tier}</span>
              </div>
              {isSelected && <Check className="w-4 h-4 text-sky-600" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

import { useRef, useMemo } from 'react'
import { FileText, Plus, GitMerge } from 'lucide-react'
import type { TemplateMeta, BlueprintNode, BlueprintEdge } from '../../templates/blueprints/types'
import { generateTemplatePreview } from '../utils/templatePreview'

interface TemplateCardProps {
  template: TemplateMeta
  nodes?: BlueprintNode[]
  edges?: BlueprintEdge[]
  onInsert: (templateId: string) => void
  onMerge?: (templateId: string) => void
  onLearnMore?: (templateId: string) => void
}

export function TemplateCard({ template, nodes, edges, onInsert, onMerge, onLearnMore }: TemplateCardProps): JSX.Element {
  // v1.2: Debounce clicks to prevent double-insert (500ms)
  const lastClickTime = useRef<number>(0)
  const lastMergeClickTime = useRef<number>(0)

  // P0-5: Generate preview SVG (memoized, cached per template)
  const previewDataUrl = useMemo(() => {
    if (!nodes || !edges || nodes.length === 0) return null
    return generateTemplatePreview(nodes, edges)
  }, [nodes, edges])

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-sm hover:border-info-500 transition-all">
      {/* P0-5: Mini-layout preview */}
      {previewDataUrl && (
        <div className="mb-3 rounded-md overflow-hidden border border-gray-200">
          <img
            src={previewDataUrl}
            alt={`${template.name} template structure`}
            className="w-full h-auto"
            style={{ display: 'block' }}
          />
        </div>
      )}

      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-info-100">
          <FileText className="w-5 h-5 text-info-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">
            {template.name}
          </h3>
          <p className="text-xs text-gray-600 line-clamp-2">
            {template.description}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 mt-3">
        {/* Primary action: Start from Template */}
        <button
          onClick={() => {
            // v1.2: Debounce to prevent double-insert
            const now = Date.now()
            if (now - lastClickTime.current < 500) {
              if (import.meta.env.DEV) {
                console.log('[TemplateCard] Debounced duplicate click on:', template.name)
              }
              return
            }
            lastClickTime.current = now
            onInsert(template.id)
          }}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-info-500 hover:bg-info-600 rounded-md focus:outline-none focus:ring-2 focus:ring-info-500 transition-colors"
          aria-label={`Start from ${template.name} template`}
        >
          <Plus className="w-3.5 h-3.5" />
          Start from Template
        </button>

        {/* Secondary actions row */}
        <div className="flex gap-2">
          {onMerge && (
            <button
              onClick={() => {
                const now = Date.now()
                if (now - lastMergeClickTime.current < 500) {
                  if (import.meta.env.DEV) {
                    console.log('[TemplateCard] Debounced duplicate merge click on:', template.name)
                  }
                  return
                }
                lastMergeClickTime.current = now
                onMerge(template.id)
              }}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
              aria-label={`Merge ${template.name} into current canvas`}
              title="Add template to current canvas"
            >
              <GitMerge className="w-3 h-3" />
              Merge
            </button>
          )}
          {onLearnMore && (
            <button
              onClick={() => onLearnMore(template.id)}
              className="flex-1 px-2 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
            >
              Learn more
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

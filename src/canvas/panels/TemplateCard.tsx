import { FileText, Plus } from 'lucide-react'
import type { TemplateMeta } from '../../templates/blueprints/types'

interface TemplateCardProps {
  template: TemplateMeta
  onInsert: (templateId: string) => void
  onLearnMore?: (templateId: string) => void
}

export function TemplateCard({ template, onInsert, onLearnMore }: TemplateCardProps): JSX.Element {
  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-all" onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--olumi-primary)'} onMouseLeave={(e) => e.currentTarget.style.borderColor = ''}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(91,108,255,0.1)' }}>
          <FileText className="w-5 h-5" style={{ color: 'var(--olumi-primary)' }} />
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
      
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => onInsert(template.id)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--olumi-primary)] transition-colors"
          style={{ backgroundColor: 'var(--olumi-primary)' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--olumi-primary-700)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--olumi-primary)'}
          aria-label={`Insert ${template.name} template`}
        >
          <Plus className="w-3.5 h-3.5" />
          Insert
        </button>
        {onLearnMore && (
          <button
            onClick={() => onLearnMore(template.id)}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
          >
            Learn more
          </button>
        )}
      </div>
    </div>
  )
}

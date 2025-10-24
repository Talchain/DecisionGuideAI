import { Info } from 'lucide-react'
import type { Blueprint } from '../../templates/blueprints/types'

interface TemplateAboutProps {
  blueprint: Blueprint
}

export function TemplateAbout({ blueprint }: TemplateAboutProps): JSX.Element {
  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: 'rgba(91,108,255,0.05)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'rgba(91,108,255,0.2)' }}>
      <div className="flex items-start gap-3">
        <Info className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--olumi-info)' }} />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--olumi-primary)' }}>
            About {blueprint.name}
          </h3>
          <p className="text-sm mb-3" style={{ color: '#3a4d6e' }}>
            {blueprint.longDescription || blueprint.description}
          </p>

          {blueprint.expectedInputs && blueprint.expectedInputs.length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--olumi-primary)' }}>Expected inputs:</p>
              <p className="text-xs" style={{ color: '#5a6a8a' }}>
                {blueprint.expectedInputs.join(', ')}
              </p>
            </div>
          )}

          {blueprint.assumptions && blueprint.assumptions.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--olumi-primary)' }}>Assumptions:</p>
              <p className="text-xs" style={{ color: '#5a6a8a' }}>
                {blueprint.assumptions.join(', ')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

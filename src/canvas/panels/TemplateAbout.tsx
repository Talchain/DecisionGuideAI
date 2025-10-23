import { Info } from 'lucide-react'
import type { Blueprint } from '../../templates/blueprints/types'

interface TemplateAboutProps {
  blueprint: Blueprint
}

export function TemplateAbout({ blueprint }: TemplateAboutProps): JSX.Element {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">
            About {blueprint.name}
          </h3>
          <p className="text-sm text-blue-800 mb-3">
            {blueprint.longDescription || blueprint.description}
          </p>
          
          {blueprint.expectedInputs && blueprint.expectedInputs.length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-medium text-blue-900 mb-1">Expected inputs:</p>
              <p className="text-xs text-blue-700">
                {blueprint.expectedInputs.join(', ')}
              </p>
            </div>
          )}
          
          {blueprint.assumptions && blueprint.assumptions.length > 0 && (
            <div>
              <p className="text-xs font-medium text-blue-900 mb-1">Assumptions:</p>
              <p className="text-xs text-blue-700">
                {blueprint.assumptions.join(', ')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

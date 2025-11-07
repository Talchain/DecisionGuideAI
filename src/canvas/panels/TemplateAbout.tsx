import { Info } from 'lucide-react'
import type { Blueprint } from '../../templates/blueprints/types'

interface TemplateAboutProps {
  blueprint: Blueprint
  version?: string
}

export function TemplateAbout({ blueprint, version }: TemplateAboutProps): JSX.Element {
  // v1.2: Calculate kind counts
  const kindCounts = blueprint.nodes.reduce((acc, node) => {
    const kind = node.kind || 'decision'
    acc[kind] = (acc[kind] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // v1.2: Find first node with body text for preview
  const nodeWithBody = blueprint.nodes.find(n => n.body && n.body.trim().length > 0)
  const bodyPreview = nodeWithBody?.body?.slice(0, 100) + (nodeWithBody?.body && nodeWithBody.body.length > 100 ? '...' : '')

  // Normalize version string (remove 'v' prefix if already present)
  const normalizedVersion = version?.replace(/^v/, '')
  return (
    <div className="rounded-lg p-4 bg-info-50 border border-info-200">
      <div className="flex items-start gap-3">
        <Info className="w-5 h-5 flex-shrink-0 mt-0.5 text-info-600" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-sm font-semibold text-info-900">
              About {blueprint.name}
            </h3>
            {/* v1.2: Version chip */}
            {normalizedVersion && (
              <span className="flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded-full bg-info-100 text-info-700 border border-info-200">
                v{normalizedVersion}
              </span>
            )}
          </div>
          <p className="text-sm mb-3 text-gray-700">
            {blueprint.longDescription || blueprint.description}
          </p>

          {/* v1.2: Kind counts */}
          {Object.keys(kindCounts).length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium mb-1.5 text-info-900">Node types:</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(kindCounts).map(([kind, count]) => (
                  <span
                    key={kind}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700 border border-gray-200"
                  >
                    {kind}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* v1.2: Body preview */}
          {bodyPreview && (
            <div className="mb-3 p-2 rounded bg-gray-50 border border-gray-200">
              <p className="text-xs font-medium mb-1 text-gray-700">Example detail:</p>
              <p className="text-xs text-gray-600 italic">"{bodyPreview}"</p>
            </div>
          )}

          {blueprint.expectedInputs && blueprint.expectedInputs.length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-medium mb-1 text-info-900">Expected inputs:</p>
              <p className="text-xs text-gray-600">
                {blueprint.expectedInputs.join(', ')}
              </p>
            </div>
          )}

          {blueprint.assumptions && blueprint.assumptions.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-1 text-info-900">Assumptions:</p>
              <p className="text-xs text-gray-600">
                {blueprint.assumptions.join(', ')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

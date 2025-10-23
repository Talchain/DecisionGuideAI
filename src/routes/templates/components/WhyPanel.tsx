import { memo } from 'react'
import type { ReportV1 } from '../../../adapters/plot'

interface WhyPanelProps {
  report: ReportV1
}

export const WhyPanel = memo<WhyPanelProps>(({ report }) => {
  const { drivers, critique } = report
  const items = drivers?.length ? drivers : critique?.map(c => ({ label: c })) || []

  if (!items.length) return null

  return (
    <div className="bg-white border rounded-lg p-6 mb-6" data-testid="why-panel">
      <h3 className="text-lg font-semibold mb-4">What's driving this result</h3>
      <ul role="list" className="space-y-3">
        {items.slice(0, 5).map((item, index) => (
          <li key={index} role="listitem" className="flex items-start gap-3" data-testid={`why-item-${index}`}>
            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
            <div className="flex-1">
              <span className="text-gray-900">
                {'label' in item ? item.label : typeof item === 'string' ? item : ''}
              </span>
              {'action' in item && item.action && (
                <button
                  className="ml-2 text-sm text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded"
                  data-testid={`why-action-${index}`}
                  aria-label={`Try: ${item.action}`}
                >
                  {item.action}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
})

WhyPanel.displayName = 'WhyPanel'

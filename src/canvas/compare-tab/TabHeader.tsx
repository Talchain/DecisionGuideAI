import { Code2 } from 'lucide-react'
import { typography } from '../../styles/typography'

interface TabHeaderProps {
  showExpert: boolean
  onToggleExpert: (value: boolean) => void
}

export function TabHeader({ showExpert, onToggleExpert }: TabHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-panel-border">
      <span className={`${typography.panelHeader} text-text-body`}>
        Refinement journey
      </span>
      <button
        onClick={() => onToggleExpert(!showExpert)}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-full cursor-pointer border transition-colors ${
          showExpert
            ? 'border-info/30 bg-info/10'
            : 'border-panel-border bg-transparent'
        } ${typography.panelMeta} text-text-body`}
      >
        <Code2
          size={12}
          className={showExpert ? 'text-info' : 'text-text-light'}
        />
        Expert
      </button>
    </div>
  )
}

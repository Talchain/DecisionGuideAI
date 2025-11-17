import { useEffect, useMemo } from 'react'
import { useDockState } from '../hooks/useDockState'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'

type InputsDockTab = 'documents' | 'scenarios' | 'limits'

interface InputsDockState {
  isOpen: boolean
  activeTab: InputsDockTab
}

interface InputsDockProps {
  onShowDocuments?: () => void
  currentNodes?: number
  currentEdges?: number
  renderDocumentsTab?: () => JSX.Element
}

const STORAGE_KEY = 'canvas.inputsDock.v1'

const INPUT_TABS: { id: InputsDockTab; label: string }[] = [
  { id: 'documents', label: 'Documents' },
  { id: 'scenarios', label: 'Scenarios' },
  { id: 'limits', label: 'Limits & health' },
]

export function InputsDock({ onShowDocuments, currentNodes = 0, currentEdges = 0, renderDocumentsTab }: InputsDockProps) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const [state, setState] = useDockState<InputsDockState>(STORAGE_KEY, {
    isOpen: true,
    activeTab: 'documents',
  })

  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    const value = state.isOpen ? 'var(--dock-left-expanded)' : 'var(--dock-left-collapsed)'
    root.style.setProperty('--dock-left-offset', value)

    return () => {
      root.style.setProperty('--dock-left-offset', '0rem')
    }
  }, [state.isOpen])
  const transitionClass = prefersReducedMotion ? '' : 'transition-[width] duration-200 ease-in-out'

  const activeLabel = useMemo(
    () => INPUT_TABS.find(tab => tab.id === state.activeTab)?.label ?? '',
    [state.activeTab]
  )

  const toggleOpen = () => {
    setState(prev => ({ ...prev, isOpen: !prev.isOpen }))
  }

  const handleTabClick = (tab: InputsDockTab) => {
    setState(prev => ({ ...prev, isOpen: true, activeTab: tab }))
  }

  return (
    <aside
      className={`${transitionClass} fixed left-0 border-r border-gray-200 bg-white flex flex-col`}
      style={{
        width: state.isOpen ? 'var(--dock-left-expanded, 20rem)' : 'var(--dock-left-collapsed, 2.5rem)',
        top: 'var(--topbar-h)',
        bottom: 'var(--bottombar-h)',
      }}
      aria-label="Inputs dock"
      data-testid="inputs-dock"
    >
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between px-2 py-2">
          <button
            type="button"
            onClick={toggleOpen}
            className="inline-flex items-center justify-center w-6 h-6 rounded border border-gray-300 text-xs text-gray-600 hover:bg-gray-100"
            data-testid="inputs-dock-toggle"
            aria-label={state.isOpen ? 'Collapse inputs dock' : 'Expand inputs dock'}
          >
            {state.isOpen ? '<' : '>'}
          </button>
          {state.isOpen && (
            <span className="ml-2 text-xs font-medium text-gray-600 truncate" aria-live="polite">
              {activeLabel}
            </span>
          )}
        </div>

        {state.isOpen && (
          <nav
            className="flex gap-1 px-2 py-2 border-t border-gray-100"
            aria-label="Inputs sections"
          >
            {INPUT_TABS.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(tab.id)}
                className={`flex-1 px-2 py-1 rounded text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${
                  state.activeTab === tab.id
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'text-gray-600 hover:bg-gray-50 border border-transparent'
                }`}
                data-testid={tab.id === 'documents' ? 'inputs-dock-tab-documents' : undefined}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        )}
      </div>

      {state.isOpen && (
        <div
          className="flex-1 px-3 py-3 text-xs text-gray-500 overflow-y-auto"
          data-testid="inputs-dock-body"
          tabIndex={-1}
        >
          {state.activeTab === 'documents' && (
            renderDocumentsTab ? (
              renderDocumentsTab()
            ) : (
              <div className="space-y-2">
                <p>Source documents and related controls live in the documents manager.</p>
                {onShowDocuments && (
                  <button
                    type="button"
                    onClick={onShowDocuments}
                    className="inline-flex items-center px-2 py-1 rounded border border-blue-200 text-blue-700 text-xs font-medium hover:bg-blue-50"
                    data-testid="inputs-dock-open-documents"
                  >
                    Open documents manager
                  </button>
                )}
              </div>
            )
          )}
          {state.activeTab === 'scenarios' && (
            <p>Scenario presets and saved canvases will be available here.</p>
          )}
          {state.activeTab === 'limits' && (
            <div className="space-y-2">
              <p>Live limits and health information will surface here alongside a detailed panel.</p>
              <div className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-gray-50 border border-gray-200 text-gray-700">
                <span className="tabular-nums">Nodes {currentNodes}</span>
                <span className="text-gray-400">•</span>
                <span className="tabular-nums">Edges {currentEdges}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  )
}

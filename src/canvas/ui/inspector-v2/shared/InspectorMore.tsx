import { createContext, useContext, useId, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { typography } from '../../../../styles/typography'

interface InspectorMoreContextValue {
  target: HTMLDivElement | null
  setTarget: (target: HTMLDivElement | null) => void
}

// Absence means legacy inline rendering. A present provider with a null target
// means the anatomy shell is still mounting its destination, so panel items
// wait rather than mounting inline and losing their state when moved.
const InspectorMoreContext = createContext<InspectorMoreContextValue | null>(null)

export function InspectorMoreProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null)
  const value = useMemo(() => ({ target, setTarget }), [target])

  return (
    <InspectorMoreContext.Provider value={value}>
      {children}
    </InspectorMoreContext.Provider>
  )
}

/**
 * Panel content lives before shell content and stays mounted when collapsed.
 * Callers moving controls out of a fieldset must preserve its disabled value
 * and authority attributes in a fieldset around the portalled controls.
 */
export function InspectorMoreItems({ children }: { children: ReactNode }) {
  const context = useContext(InspectorMoreContext)
  if (!context) return <>{children}</>
  return context.target ? createPortal(children, context.target) : null
}

export function InspectorMore({ children }: { children?: ReactNode }) {
  const context = useContext(InspectorMoreContext)
  const [open, setOpen] = useState(false)
  const contentId = useId()

  return (
    <div className="mt-3">
      <button
        type="button"
        data-testid="inspector-more-toggle"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen(value => !value)}
        className={`${typography.panelBody} inline-flex items-center gap-1 text-text-body hover:text-info focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-info`}
      >
        {open
          ? <ChevronDown size={14} aria-hidden="true" />
          : <ChevronRight size={14} aria-hidden="true" />}
        More
      </button>
      <div id={contentId} data-testid="inspector-more" hidden={!open}>
        <div ref={context?.setTarget} />
        {children}
      </div>
    </div>
  )
}

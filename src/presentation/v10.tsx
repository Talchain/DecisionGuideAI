/**
 * The v10 presentation (#/canvas2): the same canvas, data and AI as #/canvas, with the v10 design layered on top so
 * Paul can compare the two side by side (2 Nov 2026). Components read `usePresentation()` and change only what v10
 * changes; everything else is the current app. Design source: claude.ai/artifact/DMUcdVX5nMX89C4fD8hBVn.
 */
import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { typography } from '../styles/typography'
import './v10.css'

export type Presentation = 'current' | 'v10'

export const V10_BASE = '/canvas2'

const PresentationContext = createContext<Presentation>('current')

export function usePresentation(): Presentation {
  return useContext(PresentationContext)
}

export function PresentationProvider({ value, children }: { value: Presentation; children: ReactNode }) {
  const { id } = useParams<{ id: string }>()
  // Some roots portal into document.body (FirstUseComposer, FloatingOlumiPanel), outside the wrapper below. The same
  // attribute on <html> lets every [data-presentation="v10"] rule in v10.css reach them. #/canvas never carries it.
  useEffect(() => {
    if (value !== 'v10') return undefined
    document.documentElement.dataset.presentation = 'v10'
    return () => { delete document.documentElement.dataset.presentation }
  }, [value])
  return (
    <PresentationContext.Provider value={value}>
      <div data-presentation={value} className="contents">
        {children}
        {value === 'v10' && (
          <a
            href={id ? `#/scenario/${id}` : '#/canvas'}
            className={`${typography.panelBody} fixed z-50 inline-flex items-center rounded-full bg-panel text-text-body hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
            style={{ left: 72, bottom: 16, gap: 6, padding: '5px 12px', border: '1px solid var(--border-default, #EEE6D8)', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}
            data-testid="v10-compare-link"
          >
            Design v10 · Open in the current design
          </a>
        )}
      </div>
    </PresentationContext.Provider>
  )
}

/**
 * v10 for one part of a page, with nothing else of the provider: no compare link and no attribute on <html>. The olumi-core lane draws
 * its cards inside it (src/olumiView/v10.tsx), so each card's controls take v10's Olumi corner, while the rest of the lane keeps
 * the current behaviour.
 */
export function V10Scope({ children }: { children: ReactNode }) {
  return <PresentationContext.Provider value="v10">{children}</PresentationContext.Provider>
}

/** v10: ring one card while its name is hovered in the chat. A class on the card's own element, so nothing else dims. */
export function setV10Lit(nodeId: string | null): void {
  if (typeof document === 'undefined') return
  document.querySelectorAll('.react-flow__node.v10-lit').forEach((el) => el.classList.remove('v10-lit'))
  if (!nodeId) return
  document.querySelector(`.react-flow__node[data-id="${CSS.escape(nodeId)}"]`)?.classList.add('v10-lit')
}

/** True while the app is showing the v10 design. Read from the hash so non-component code (navigation) can use it. */
export function isV10Location(): boolean {
  return typeof window !== 'undefined' && window.location.hash.startsWith(`#${V10_BASE}`)
}

/** Where a scenario opens: v10 stays in v10 after the first save; the current design is unchanged. */
export function scenarioPath(id: string): string {
  return isV10Location() ? `${V10_BASE}/${id}` : `/scenario/${id}`
}

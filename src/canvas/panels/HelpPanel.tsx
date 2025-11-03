/**
 * HelpPanel - Keyboard shortcuts, glossary, and quick start guide
 *
 * Features:
 * - Keyboard shortcuts grouped by category (Navigation, Editing, Analysis)
 * - 8-term glossary with plain-language definitions
 * - Quick start guide (3 steps)
 * - Link to full documentation
 * - Integrated with LayerProvider for proper exclusivity
 */

import { useRef, useEffect } from 'react'
import { X, Keyboard, BookOpen, Zap } from 'lucide-react'
import { useLayerRegistration } from '../components/LayerProvider'

interface HelpPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function HelpPanel({ isOpen, onClose }: HelpPanelProps): JSX.Element | null {
  const panelRef = useRef<HTMLDivElement>(null)

  // Register with LayerProvider for panel exclusivity and Esc handling
  useLayerRegistration('help-panel', 'panel', isOpen, onClose)

  // Focus management
  useEffect(() => {
    if (isOpen && panelRef.current) {
      const firstFocusable = panelRef.current.querySelector<HTMLElement>('button')
      firstFocusable?.focus()
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1999,
        }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        style={{
          position: 'fixed',
          right: 0,
          top: 0,
          bottom: 0,
          width: '520px',
          maxWidth: '100vw',
          backgroundColor: 'var(--olumi-bg)',
          borderLeft: '1px solid rgba(91, 108, 255, 0.2)',
          zIndex: 2000,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.15)',
        }}
        role="dialog"
        aria-label="Help Panel"
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid rgba(91, 108, 255, 0.15)',
            backgroundColor: 'rgba(91, 108, 255, 0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h2
              style={{
                margin: 0,
                fontSize: '1.125rem',
                fontWeight: 600,
                color: 'var(--olumi-text)',
              }}
            >
              Help
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderRadius: '0.375rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Close panel"
          >
            <X className="w-5 h-5" style={{ color: 'var(--olumi-text)' }} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Quick Start */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Zap className="w-5 h-5" style={{ color: 'var(--olumi-primary)' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--olumi-text)', margin: 0 }}>
                Quick Start
              </h3>
            </div>
            <ol style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.875rem', lineHeight: 1.6, color: 'rgba(232, 236, 245, 0.8)' }}>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong style={{ color: 'var(--olumi-text)' }}>Insert a template</strong> — Press <Kbd>⌘T</Kbd> to open the templates library and click Insert on any template
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong style={{ color: 'var(--olumi-text)' }}>Adjust probabilities</strong> — Click any decision node, then use the Path probabilities sliders to set likelihood percentages
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong style={{ color: 'var(--olumi-text)' }}>Analyze</strong> — Press <Kbd>⌘↵</Kbd> to run analysis and see the most likely outcome with key drivers
              </li>
            </ol>
          </section>

          {/* Keyboard Shortcuts */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Keyboard className="w-5 h-5" style={{ color: 'var(--olumi-primary)' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--olumi-text)', margin: 0 }}>
                Keyboard Shortcuts
              </h3>
            </div>

            {/* Navigation */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'rgba(232, 236, 245, 0.6)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                Navigation
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <ShortcutRow keys={['⌘1']} description="Latest analysis" />
                <ShortcutRow keys={['⌘2']} description="Run history" />
                <ShortcutRow keys={['⌘⇧C']} description="Compare runs" />
                <ShortcutRow keys={['⌘T']} description="Templates library" />
                <ShortcutRow keys={['⌘/', '⌘?']} description="Help (this panel)" />
              </div>
            </div>

            {/* Editing */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'rgba(232, 236, 245, 0.6)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                Editing
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <ShortcutRow keys={['P']} description="Edit path probabilities" />
                <ShortcutRow keys={['E']} description="Edit edge weight" />
                <ShortcutRow keys={['Alt', 'V']} description="Next invalid decision" />
                <ShortcutRow keys={['⌘Z']} description="Undo" />
                <ShortcutRow keys={['⌘⇧Z']} description="Redo" />
                <ShortcutRow keys={['Esc']} description="Close panel / Cancel action" />
              </div>
            </div>

            {/* Analysis */}
            <div>
              <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'rgba(232, 236, 245, 0.6)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                Analysis
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <ShortcutRow keys={['⌘↵']} description="Analyze again" />
                <ShortcutRow keys={['⌘⇧↵']} description="Apply preview (when in preview mode)" />
              </div>
            </div>
          </section>

          {/* Glossary */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <BookOpen className="w-5 h-5" style={{ color: 'var(--olumi-primary)' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--olumi-text)', margin: 0 }}>
                Glossary
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <GlossaryItem
                term="Goal"
                definition="The ultimate outcome you're trying to achieve or understand"
              />
              <GlossaryItem
                term="Decision"
                definition="A choice point with multiple possible paths, each with a probability"
              />
              <GlossaryItem
                term="Option"
                definition="One of the possible choices available at a decision point"
              />
              <GlossaryItem
                term="Outcome"
                definition="A result or consequence that flows from previous decisions"
              />
              <GlossaryItem
                term="Connector"
                definition="A link between nodes showing how decisions and outcomes flow together"
              />
              <GlossaryItem
                term="Probability (%)"
                definition="How likely a specific path is taken. Paths from the same decision should add up to ~100%."
              />
              <GlossaryItem
                term="Weight"
                definition="How strongly a connection influences the result (also affects line thickness)"
              />
              <GlossaryItem
                term="Confidence"
                definition="How certain we are about the analysis result given the data and assumptions"
              />
            </div>
          </section>

          {/* Documentation Link */}
          <section style={{ paddingTop: '1rem', borderTop: '1px solid rgba(91, 108, 255, 0.15)' }}>
            <a
              href="https://docs.claude.com/claude-code"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: 'var(--olumi-primary)',
                fontSize: '0.875rem',
                textDecoration: 'none',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.375rem',
                border: '1px solid rgba(91, 108, 255, 0.3)',
                backgroundColor: 'rgba(91, 108, 255, 0.1)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(91, 108, 255, 0.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(91, 108, 255, 0.1)'
              }}
            >
              View full documentation →
            </a>
          </section>
        </div>
      </div>
    </>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      style={{
        display: 'inline-block',
        padding: '0.125rem 0.375rem',
        fontSize: '0.75rem',
        fontWeight: 600,
        fontFamily: 'monospace',
        borderRadius: '0.25rem',
        border: '1px solid rgba(91, 108, 255, 0.3)',
        backgroundColor: 'rgba(91, 108, 255, 0.1)',
        color: 'var(--olumi-primary)',
      }}
    >
      {children}
    </kbd>
  )
}

function ShortcutRow({ keys, description }: { keys: string[]; description: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.5rem',
        borderRadius: '0.25rem',
        backgroundColor: 'rgba(91, 108, 255, 0.03)',
      }}
    >
      <span style={{ fontSize: '0.875rem', color: 'rgba(232, 236, 245, 0.8)' }}>
        {description}
      </span>
      <div style={{ display: 'flex', gap: '0.25rem' }}>
        {keys.map((key, index) => (
          <Kbd key={index}>{key}</Kbd>
        ))}
      </div>
    </div>
  )
}

function GlossaryItem({ term, definition }: { term: string; definition: string }) {
  return (
    <div>
      <dt style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--olumi-text)', marginBottom: '0.25rem' }}>
        {term}
      </dt>
      <dd style={{ fontSize: '0.8125rem', color: 'rgba(232, 236, 245, 0.7)', lineHeight: 1.5, margin: 0 }}>
        {definition}
      </dd>
    </div>
  )
}

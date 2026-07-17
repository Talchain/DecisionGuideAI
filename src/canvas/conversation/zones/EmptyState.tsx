/**
 * EmptyState — centred shape pipeline, welcome text, and loading hub.
 *
 * Six node shapes (Goal → Decision → Option → Factor → Risk → Outcome)
 * in a pipeline with dashed arrows. Three visual modes:
 *
 * 1. **Idle** — static shapes, "What's on your mind?" heading
 * 2. **Thinking** — wave animation plays, heading replaced by status label
 * 3. **Streaming** — wave animation plays, streaming text shown below shapes
 */

import { NodeShape } from '../primitives/NodeShape'
import { typography } from '../../../styles/typography'
import type { NodeType } from '../../domain/nodes'

const SHAPES: NodeType[] = ['goal', 'decision', 'option', 'factor', 'risk', 'outcome']

/** Main brand fill colours (DS v5 semantic tokens with hex fallbacks). */
const MAIN_FILLS: Record<string, string> = {
  goal:     'var(--goal, #F5C433)',
  decision: 'var(--info-hover, #2B7FA2)',
  option:   'var(--option, #AAA7E4)',
  factor:   'var(--factor, #B0A899)',
  risk:     'var(--danger, #EA7B4B)',
  outcome:  'var(--success, #67C89E)',
}

/** Light fill colours (DS v5 semantic tokens with hex fallbacks). */
const LIGHT_FILLS: Record<string, string> = {
  goal:     'var(--goal-light, #F4DB92)',
  decision: 'var(--info-light, #BAD7E4)',
  option:   'var(--option-light, #DDDCF5)',
  factor:   'var(--factor-light, #EEE6D8)',
  risk:     'var(--danger-light, #FFB393)',
  outcome:  'var(--success-light, #B8E2D0)',
}

/** Base size for most shapes. Goal (diamond) and decision (hexagon) are 27px
 *  to compensate for their geometrically compact appearance. */
const SIZE = 26
const SIZES: Partial<Record<string, number>> = { goal: 27, decision: 27 }

function DashedArrow() {
  // Height matches max shape size (27px for goal/decision) so every shape+arrow
  // pair has a uniform row height. Flex centring keeps the arrow on-axis.
  return (
    <div className="flex items-center justify-center flex-shrink-0" style={{ width: 18, height: 27 }}>
      <svg width="16" height="8" viewBox="0 0 16 8" aria-hidden="true">
        <line x1="2" y1="4" x2="11" y2="4" stroke="var(--factor-light, #EEE6D8)" strokeWidth="1" strokeDasharray="2.5 2" />
        <polyline points="9.5,1.8 12.5,4 9.5,6.2" fill="none" stroke="var(--factor-light, #EEE6D8)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

interface EmptyStateProps {
  /** When true the shape-wave animation plays (waiting for LLM). Default: static. */
  animate?: boolean
  /** Status label shown below shapes when thinking (e.g. "Building your decision model..."). */
  statusLabel?: string | null
  /** Streaming text from the LLM, shown below the shapes when available. */
  streamingText?: string | null
}

export function EmptyState({ animate = false, statusLabel, streamingText }: EmptyStateProps) {
  // Wave period and per-shape stagger
  const PERIOD = 3   // seconds for one full wave cycle
  const STAGGER = 0.45 // seconds between each shape's flash

  const isActive = animate || !!streamingText

  return (
    <div
      className="flex flex-col items-center justify-center flex-1 select-none"
      style={{ gap: 24, padding: '40px 20px' }}
      data-testid="empty-state"
    >
      {/* Heading: welcome text when idle, status label when active */}
      {!isActive ? (
        <h2
          className={`text-text-body text-center ${typography.welcomeHeading}`}
          style={{ margin: 0 }}
        >
          What&rsquo;s on your mind?
        </h2>
      ) : statusLabel && !streamingText ? (
        <span
          className={`text-text-light text-center ${typography.panelMeta}`}
          data-testid="empty-state-status"
        >
          {statusLabel}
        </span>
      ) : null}

      {/* Shape pipeline — main colours with left-to-right flash wave */}
      <div className="flex items-center" style={{ gap: 0 }}>
        {SHAPES.map((kind, i) => {
          const size = SIZES[kind] ?? SIZE
          const delay = `${i * STAGGER}s`
          return (
            <div key={kind} className="flex items-center justify-center" style={{ gap: 0, height: 27 }}>
              <div
                className="relative flex-shrink-0 flex items-center justify-center"
                style={{ width: size, height: size }}
              >
                {/* Main colour layer — fades out during flash */}
                <div
                  className={`absolute inset-0 flex items-center justify-center${isActive ? ' empty-state-main' : ''}`}
                  style={isActive ? { animationDelay: delay } : undefined}
                >
                  <NodeShape kind={kind} size={size} fill={MAIN_FILLS[kind]} />
                </div>
                {/* Light colour layer — visible at idle (DS v5 §3.8 entity-light);
                    animation fades it out momentarily during the flash tick. */}
                <div
                  className={`absolute inset-0 flex items-center justify-center${isActive ? ' empty-state-light' : ''}`}
                  style={isActive ? { opacity: 1, animationDelay: delay } : { opacity: 1 }}
                >
                  <NodeShape kind={kind} size={size} fill={LIGHT_FILLS[kind]} />
                </div>
              </div>
              {i < SHAPES.length - 1 && <DashedArrow />}
            </div>
          )
        })}
      </div>

      {/* Streaming text — shown below shapes as LLM text arrives */}
      {streamingText && (
        <p
          className={`text-text-body text-center ${typography.bodySmall}`}
          style={{ margin: 0, maxWidth: 480, whiteSpace: 'pre-wrap' }}
          data-testid="empty-state-streaming"
        >
          {streamingText}
        </p>
      )}

      <style>{`
        /* Idle state (DS v5 §3.8): light-fill shapes dominate. The flash tick
           briefly crossfades to main, then back to light. */
        @keyframes emptyStateMain {
          0%, 20%, 100% { opacity: 0; }
          10%            { opacity: 1; }
        }
        @keyframes emptyStateLight {
          0%, 20%, 100% { opacity: 1; }
          10%            { opacity: 0; }
        }
        .empty-state-main {
          animation: emptyStateMain ${PERIOD}s ease-in-out infinite;
        }
        .empty-state-light {
          animation: emptyStateLight ${PERIOD}s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .empty-state-main  { animation: none !important; opacity: 0 !important; }
          .empty-state-light { animation: none !important; opacity: 1 !important; }
        }
      `}</style>
    </div>
  )
}

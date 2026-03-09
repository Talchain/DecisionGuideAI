/**
 * EmptyState — shown when no messages and no graph nodes.
 *
 * Six node shapes (Goal → Decision → Option → Factor → Risk → Outcome)
 * in a pipeline with dashed arrows. Each shape displays in its main brand
 * colour and flashes to its light variant in a left-to-right wave.
 */

import { NodeShape } from '../primitives/NodeShape'
import type { NodeType } from '../../domain/nodes'

const SHAPES: NodeType[] = ['goal', 'decision', 'option', 'factor', 'risk', 'outcome']

/** Main brand fill colours (matches NodeShapeIndicator SHAPE_FILLS). */
const MAIN_FILLS: Record<string, string> = {
  goal:     '#F5C433',
  decision: '#63ADCF',
  option:   '#AAA7E4',
  factor:   '#B0A899',
  risk:     '#EA7B4B',
  outcome:  '#67C89E',
}

/** Light fill colours (DS v4 -light variants). */
const LIGHT_FILLS: Record<string, string> = {
  goal:     '#F4DB92',
  decision: '#BAD7E4',
  option:   '#DDDCF5',
  factor:   '#EEE6D8',
  risk:     '#FFB393',
  outcome:  '#B8E2D0',
}

/** Base size for most shapes. Goal (diamond) and decision (hexagon) are 27px
 *  to compensate for their geometrically compact appearance. */
const SIZE = 26
const SIZES: Partial<Record<string, number>> = { goal: 27, decision: 27 }

function DashedArrow() {
  return (
    <div className="flex items-center justify-center flex-shrink-0" style={{ width: 18, height: 10 }}>
      <svg width="16" height="8" viewBox="0 0 16 8" aria-hidden="true">
        <line x1="2" y1="4" x2="11" y2="4" stroke="#EEE6D8" strokeWidth="1" strokeDasharray="2.5 2" />
        <polyline points="9.5,1.8 12.5,4 9.5,6.2" fill="none" stroke="#EEE6D8" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

export function EmptyState() {
  // Wave period and per-shape stagger
  const PERIOD = 3   // seconds for one full wave cycle
  const STAGGER = 0.45 // seconds between each shape's flash

  return (
    <div
      className="flex flex-col items-center justify-center flex-1 select-none"
      style={{ gap: 24, padding: '40px 20px' }}
      data-testid="empty-state"
    >
      {/* Welcome heading */}
      <h2
        className="text-text-body text-center"
        style={{ fontSize: 24, fontWeight: 600, margin: 0 }}
      >
        What&rsquo;s on your mind?
      </h2>

      {/* Shape pipeline — main colours with left-to-right flash wave */}
      <div className="flex items-center" style={{ gap: 0 }}>
        {SHAPES.map((kind, i) => {
          const size = SIZES[kind] ?? SIZE
          const delay = `${i * STAGGER}s`
          return (
            <div key={kind} className="flex items-center" style={{ gap: 0 }}>
              <div
                className="relative flex-shrink-0 flex items-center justify-center"
                style={{ width: size, height: size }}
              >
                {/* Main colour layer — fades out during flash */}
                <div
                  className="absolute inset-0 flex items-center justify-center empty-state-main"
                  style={{ animationDelay: delay }}
                >
                  <NodeShape kind={kind} size={size} fill={MAIN_FILLS[kind]} />
                </div>
                {/* Light colour layer — fades in during flash */}
                <div
                  className="absolute inset-0 flex items-center justify-center empty-state-light"
                  style={{ opacity: 0, animationDelay: delay }}
                >
                  <NodeShape kind={kind} size={size} fill={LIGHT_FILLS[kind]} />
                </div>
              </div>
              {i < SHAPES.length - 1 && <DashedArrow />}
            </div>
          )
        })}
      </div>

      <style>{`
        @keyframes emptyStateMain {
          0%, 20%, 100% { opacity: 1; }
          10%            { opacity: 0; }
        }
        @keyframes emptyStateLight {
          0%, 20%, 100% { opacity: 0; }
          10%            { opacity: 1; }
        }
        .empty-state-main {
          animation: emptyStateMain ${PERIOD}s ease-in-out infinite;
        }
        .empty-state-light {
          animation: emptyStateLight ${PERIOD}s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .empty-state-main  { animation: none !important; opacity: 1 !important; }
          .empty-state-light { animation: none !important; opacity: 0 !important; }
        }
      `}</style>
    </div>
  )
}

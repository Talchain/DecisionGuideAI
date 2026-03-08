/**
 * EmptyState — shown when no messages and no graph nodes.
 *
 * Six node shapes (Goal → Decision → Option → Factor → Risk → Outcome)
 * in a pipeline with dashed arrows. Light-fill colours at 0.25 opacity
 * for subtle ambient decoration. Gentle alternating float animation.
 */

import { NodeShape } from '../primitives/NodeShape'
import type { NodeType } from '../../domain/nodes'

const SHAPES: NodeType[] = ['goal', 'decision', 'option', 'factor', 'risk', 'outcome']

/** Light colour fills per node type (DS v4 -light variants). */
const LIGHT_FILLS: Record<string, string> = {
  goal:     '#F4DB92',
  decision: '#BAD7E4',
  option:   '#DDDCF5',
  factor:   '#EEE6D8',
  risk:     '#FFB393',
  outcome:  '#B8E2D0',
}

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
  return (
    <div
      className="flex flex-col items-center justify-center flex-1 select-none"
      style={{ gap: 24, padding: '40px 20px' }}
      data-testid="empty-state"
    >
      {/* Shape pipeline — light fills at 0.25 opacity for subtle ambient decoration */}
      <div className="flex items-center" style={{ gap: 0, opacity: 0.25 }}>
        {SHAPES.map((kind, i) => (
          <div key={kind} className="flex items-center" style={{ gap: 0 }}>
            <div
              className="empty-state-shape flex items-center justify-center flex-shrink-0"
              style={{
                width: 22,
                height: 22,
                animation: `emptyStateFloat ${5 + i * 0.15}s ease-in-out infinite ${i % 2 === 0 ? 'alternate' : 'alternate-reverse'}`,
                animationDelay: `${i * 0.3}s`,
              }}
            >
              <NodeShape kind={kind} size={22} fill={LIGHT_FILLS[kind]} />
            </div>
            {i < SHAPES.length - 1 && <DashedArrow />}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes emptyStateFloat {
          from { transform: translateY(0); }
          to { transform: translateY(-6px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .empty-state-shape {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  )
}

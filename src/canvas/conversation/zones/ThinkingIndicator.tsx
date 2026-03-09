/**
 * ThinkingIndicator — 6 node shapes with main-to-light colour wave animation.
 *
 * Inline in conversation flow (no card wrapper). Two layers per shape:
 * main colour fades out while light colour fades in, travelling as a wave
 * left-to-right. 3s loop, 0.5s stagger between shapes.
 */

import { NodeShape } from '../primitives/NodeShape'
import type { NodeType } from '../../domain/nodes'

const SHAPES: NodeType[] = ['goal', 'decision', 'option', 'factor', 'risk', 'outcome']

/** Light colour fills per node type (DS v4 -light variants). */
const LIGHT_FILLS: Record<NodeType, string> = {
  goal:       '#F4DB92',
  decision:   '#BAD7E4',
  option:     '#DDDCF5',
  factor:     '#EEE6D8',
  risk:       '#FFB393',
  outcome:    '#B8E2D0',
  action:     '#B8E2D0',
  constraint: '#EEE6D8',
}

function DashedArrow() {
  return (
    <div className="flex items-center justify-center flex-shrink-0" style={{ width: 16, height: 10 }}>
      <svg width="14" height="8" viewBox="0 0 16 8" aria-hidden="true">
        <line x1="2" y1="4" x2="11" y2="4" stroke="#EEE6D8" strokeWidth="1" strokeDasharray="2.5 2" />
        <polyline points="9.5,1.8 12.5,4 9.5,6.2" fill="none" stroke="#EEE6D8" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

interface ThinkingIndicatorProps {
  label?: string | null
}

export function ThinkingIndicator({ label }: ThinkingIndicatorProps) {
  return (
    <div
      className="flex flex-col self-center items-center"
      style={{ gap: 8, marginBottom: 20 }}
      data-testid="thinking-indicator"
    >
      {/* Shape pipeline with two-layer wave */}
      <div className="flex items-center" style={{ gap: 0 }}>
        {SHAPES.map((kind, i) => (
          <div key={kind} className="flex items-center" style={{ gap: 0 }}>
            <div
              className="relative flex-shrink-0"
              style={{ width: 16, height: 16 }}
            >
              {/* Main colour layer — fades out during wave */}
              <div
                className="absolute inset-0 flex items-center justify-center thinking-main"
                style={{
                  animation: `thinkWaveMain 3s ease-in-out ${i * 0.5}s infinite`,
                }}
              >
                <NodeShape kind={kind} size={16} />
              </div>
              {/* Light colour layer — fades in during wave */}
              <div
                className="absolute inset-0 flex items-center justify-center thinking-light"
                style={{
                  opacity: 0,
                  animation: `thinkWaveLight 3s ease-in-out ${i * 0.5}s infinite`,
                }}
              >
                <NodeShape kind={kind} size={16} fill={LIGHT_FILLS[kind]} />
              </div>
            </div>
            {i < SHAPES.length - 1 && <DashedArrow />}
          </div>
        ))}
      </div>

      {/* Status label */}
      {label && (
        <span
          className="text-text-light"
          style={{ fontSize: 12 }}
          data-testid="thinking-label"
        >
          {label}
        </span>
      )}

      <style>{`
        @keyframes thinkWaveMain {
          0%, 26%, 100% { opacity: 1; }
          13% { opacity: 0; }
        }
        @keyframes thinkWaveLight {
          0%, 26%, 100% { opacity: 0; }
          13% { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .thinking-main { animation: none !important; opacity: 0.6 !important; }
          .thinking-light { animation: none !important; opacity: 0 !important; }
        }
      `}</style>
    </div>
  )
}

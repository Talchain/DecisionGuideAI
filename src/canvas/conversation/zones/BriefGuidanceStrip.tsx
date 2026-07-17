/**
 * BriefGuidanceStrip — row of brief element pills with node shapes.
 *
 * 5 pills (Goal, Options, Metric, Constraints, Risks), each 26px height.
 * Detected: entity colour shape + text-body, entity border at 40% opacity.
 * Not detected: empty circle outline, 50% opacity, text-light.
 * Clicking a pill shows the coaching tip for that element.
 */

import { NodeShape } from '../primitives/NodeShape'
import type { BriefElement } from '../hooks/useBriefSignals'
import type { BriefElementKind } from '../primitives/NodeShape'
import { typography } from '../../../styles/typography'

/** Map brief element kinds to their DS v4 entity border colours. */
const ENTITY_BORDERS: Record<BriefElementKind, string> = {
  goal:        'rgba(245,196,51,0.4)',
  options:     'rgba(170,167,228,0.4)',
  metric:      'rgba(103,200,158,0.4)',
  constraints: 'rgba(82,163,200,0.4)',
  risks:       'rgba(234,123,75,0.4)',
}

interface BriefGuidanceStripProps {
  elements: BriefElement[]
  onElementClick: (kind: BriefElementKind) => void
}

export function BriefGuidanceStrip({ elements, onElementClick }: BriefGuidanceStripProps) {
  const anyDetected = elements.some(e => e.detected)
  if (!anyDetected) return null

  return (
    <div
      className="brief-strip-enter flex flex-wrap flex-shrink-0"
      style={{ gap: 4 }}
      data-testid="brief-guidance-strip"
    >
      {elements.map(el => (
        <button
          key={el.kind}
          type="button"
          onClick={() => onElementClick(el.kind)}
          className={`
            inline-flex items-center rounded-full
            bg-transparent cursor-pointer
            transition-all duration-200
            focus-visible:ring-2 focus-visible:ring-info focus-visible:outline-none
            hover:bg-panel-hover
            ${typography.panelMeta} font-medium
          `}
          style={{
            gap: 4,
            height: 26,
            padding: '0 9px',
            borderRadius: 999,
            border: el.detected
              ? `1px solid ${ENTITY_BORDERS[el.kind]}`
              : '1px solid var(--border-default, #EEE6D8)',
            opacity: el.detected ? 1 : 0.5,
            color: el.detected
              ? 'var(--text-body, #3F3F3E)'
              : 'var(--text-light, #908D8D)',
          }}
          title={el.coachingTip}
          aria-label={`${el.label}: ${el.detected ? 'detected' : 'not detected'}`}
          data-testid={`brief-pill-${el.kind}`}
        >
          {el.detected ? (
            <span className="flex items-center justify-center flex-shrink-0" style={{ width: 10, height: 10 }}>
              <NodeShape kind={el.kind} size={10} />
            </span>
          ) : (
            <span className="flex-shrink-0" style={{ width: 7, height: 7, borderRadius: 999, border: '1.5px solid var(--text-light, #908D8D)' }} />
          )}
          <span>{el.label}</span>
        </button>
      ))}

      <style>{`
        @keyframes briefStripIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .brief-strip-enter {
          animation: briefStripIn 200ms cubic-bezier(0.4, 0, 0.2, 1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .brief-strip-enter { animation: none; }
        }
      `}</style>
    </div>
  )
}

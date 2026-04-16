/**
 * ExpandableCoachingText — multi-line coaching body with expand/collapse.
 *
 * Brief 4 Task 2: CEE coaching detail strings can be 100–180 chars and were
 * being clipped by Tailwind `truncate` (single-line) + a 60-char cap in the
 * pre-analysis mapper. This component renders the full string, clamped to
 * two lines by default, and exposes a "More" / "Less" toggle only when the
 * text actually overflows the collapsed height.
 *
 * Renders inline in place of any previous `<p className="... truncate">`.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { typography } from '@/styles/typography'

interface ExpandableCoachingTextProps {
  text: string
  /** Number of lines visible when collapsed (default 2). */
  maxLinesCollapsed?: number
  /** Additional class names applied to the text element. */
  className?: string
  /** Hint passed to the native `title` attribute (defaults to `text`). */
  titleAttr?: string
}

export function ExpandableCoachingText({
  text,
  maxLinesCollapsed = 2,
  className,
  titleAttr,
}: ExpandableCoachingTextProps) {
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)
  const ref = useRef<HTMLParagraphElement | null>(null)

  const measureOverflow = useCallback(() => {
    const el = ref.current
    if (!el) return
    // When collapsed, scrollHeight > clientHeight + 1 indicates line-clamp is
    // actually hiding content. The +1 tolerance guards against sub-pixel rounding.
    setOverflows(el.scrollHeight > el.clientHeight + 1)
  }, [])

  useLayoutEffect(() => {
    measureOverflow()
  }, [text, maxLinesCollapsed, measureOverflow])

  useEffect(() => {
    const handler = () => measureOverflow()
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [measureOverflow])

  const clampStyle: React.CSSProperties = expanded
    ? {}
    : {
      display: '-webkit-box',
      WebkitLineClamp: maxLinesCollapsed,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden',
    }

  return (
    <div className="min-w-0 flex-1">
      <p
        ref={ref}
        className={`${typography.panelBody} text-text-body ${className ?? ''}`.trim()}
        style={clampStyle}
        title={titleAttr ?? text}
      >
        {text}
      </p>
      {overflows && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className={`${typography.panelMeta} text-info hover:underline inline-flex items-center gap-0.5 mt-0.5 bg-transparent border-none cursor-pointer p-0`}
        >
          {expanded ? (
            <>
              Less <ChevronUp size={12} aria-hidden="true" />
            </>
          ) : (
            <>
              More <ChevronDown size={12} aria-hidden="true" />
            </>
          )}
        </button>
      )}
    </div>
  )
}

export default ExpandableCoachingText

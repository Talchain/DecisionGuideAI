/**
 * ExplainDiffButton — "Why these changes?" on the applied-edit receipt.
 *
 * The user has just watched the assistant modify their model. This asks CEE why,
 * and renders the SERVER'S answer.
 *
 * ── WHAT THIS COMPONENT USED TO DO, AND WHY THAT MATTERED ───────────────────
 * The previous version was written against a contract that has never existed on
 * any deployed surface, and it had never been imported by anything:
 *
 *   1. it POSTed to `/bff/assist/explain-diff` — a seam that exists only in
 *      vite.config.ts for dev. In production a live probe returned the Netlify
 *      SPA catch-all, byte-identical (3449 B) to a deliberately fabricated path;
 *   2. it sent `{ patch: string, context: string }` where the route requires a
 *      structured patch and rejects unknown keys (`.strict()`);
 *   3. it read `data.explanation`, a key the route has never returned, and on
 *      `undefined` rendered "No explanation available" — telling the user the
 *      server had nothing to say at the precise moment it answered in full.
 *
 * (3) is the one worth keeping in mind while editing this file. A false failure
 * report is not a cosmetic bug; it teaches users the feature is broken when it
 * works, and it is the same class of harm as inventing an explanation.
 *
 * ── THE RULES THIS COMPONENT FOLLOWS ────────────────────────────────────────
 * · What is displayed is ALWAYS the server's text. Never synthesised here.
 * · If the server cannot answer, say so plainly and leave a route — the chat
 *   composer is directly below this card, so "ask in the chat" is a real one.
 * · Never claim an edit was explained when it was not. No placeholder copy that
 *   could be mistaken for an explanation.
 */
import { useState } from 'react'
import { HelpCircle, Loader2 } from 'lucide-react'
import { typography } from '../../styles/typography'
import type { V5GraphPatchBlock } from '../../canvas/conversation/types'
import {
  buildExplainDiffRequest,
  parseExplainDiffResponse,
  type ExplainDiffRationale,
} from './explainDiffRequest'

/**
 * The browser-reachable seam. `/bff/cee/*` is a Netlify EDGE FUNCTION that
 * rewrites to CEE `/assist/v1/*` and injects the caller-auth key server-side.
 *
 * ⚠ Requires TWO things to be live, both shipped alongside this component:
 *   · CEE registers `/assist/v1/explain-diff` (CEE #1082) — the handler
 *     previously existed ONLY on the legacy `/assist/*` surface, which this
 *     rewrite cannot reach;
 *   · `/^\/assist\/v1\/explain-diff$/` is on `ALLOWED_TARGETS` in
 *     netlify/edge-functions/cee-proxy.ts, or the proxy 404s before forwarding.
 */
const EXPLAIN_DIFF_ENDPOINT = '/bff/cee/explain-diff'

export interface ExplainDiffButtonProps {
  /** The applied-edit receipt being explained. */
  block: V5GraphPatchBlock
  /** Current model size, for context. Omitted rather than guessed if unknown. */
  graphSummary?: { node_count: number; edge_count: number }
}

type Status = 'idle' | 'loading' | 'answered' | 'unavailable'

export function ExplainDiffButton({ block, graphSummary }: ExplainDiffButtonProps) {
  const [status, setStatus] = useState<Status>('idle')
  const [rationales, setRationales] = useState<ExplainDiffRationale[]>([])

  const handleExplain = async () => {
    setStatus('loading')
    try {
      const response = await fetch(EXPLAIN_DIFF_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildExplainDiffRequest(block, graphSummary)),
      })

      if (!response.ok) {
        setStatus('unavailable')
        return
      }

      // A non-JSON body is the signature of the SPA catch-all answering instead
      // of the service — the exact failure that kept this capability dark. It
      // must read as unavailable, never as an empty explanation.
      const data = await response.json().catch(() => null)
      const parsed = parseExplainDiffResponse(data)

      if (!parsed) {
        setStatus('unavailable')
        return
      }

      setRationales(parsed)
      setStatus('answered')
    } catch {
      setStatus('unavailable')
    }
  }

  const isLoading = status === 'loading'

  return (
    <div className="space-y-2" data-testid="explain-diff">
      <button
        onClick={handleExplain}
        disabled={isLoading}
        className="inline-flex items-center gap-1.5 rounded-lg border border-panel-border bg-transparent px-2.5 py-1 text-text-body transition-opacity hover:opacity-80 disabled:opacity-50"
        type="button"
        data-testid="explain-diff-trigger"
      >
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        <span className={typography.panelMeta}>
          {isLoading ? 'Asking…' : 'Why these changes?'}
        </span>
      </button>

      {status === 'answered' && (
        <ul className="space-y-1.5" data-testid="explain-diff-rationales">
          {rationales.map((r, i) => (
            <li
              key={`${r.target}-${i}`}
              className={`${typography.panelMeta} text-text-body`}
              data-testid="explain-diff-rationale"
            >
              {r.why}
            </li>
          ))}
        </ul>
      )}

      {/*
        The honest-failure surface. It states what happened, does not dress it up
        as an explanation, and points at the composer immediately below this card.
        Deliberately NOT a retry-only dead end and NOT a spinner that never
        resolves — every path out of `loading` lands on a terminal state.
      */}
      {status === 'unavailable' && (
        <p
          className={`${typography.panelMeta} text-text-light`}
          data-testid="explain-diff-unavailable"
        >
          Couldn&rsquo;t get an explanation for this change just now. Ask in the chat
          below and the assistant can talk it through.
        </p>
      )}
    </div>
  )
}

export default ExplainDiffButton

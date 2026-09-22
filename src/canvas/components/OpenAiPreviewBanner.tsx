/**
 * ⭐ THE PREVIEW BANNER — rendered from the SAME predicate that redirects the
 * transport, so it cannot say "preview" over turns that went to CEE.
 *
 * Paul's brief: *"show a persistent banner: `OpenAI preview — model changes are
 * not committed`"* and *"no UI affordance should imply edits will persist"*.
 *
 * ⛔ SO IT CARRIES NO CONTROL. Not a dismiss button, not a "learn more", not a
 * link. A dismissible banner is not persistent, and any affordance here is one
 * more thing that could imply the session is ordinary. It states a fact and
 * offers nothing.
 *
 * ⚠ IT ASKS `isOpenAiPreviewActive()` AND NOTHING ELSE. Reading the flag
 * directly would make this a SECOND predicate, and the two could then disagree
 * — the reader told they are in a preview while their turns commit, or the
 * reverse, which is worse. `openAiPreview.spec.ts` drives every combination of
 * the two settings and asserts the banner's answer IS the transport's answer.
 */
import { isOpenAiPreviewActive, OPENAI_PREVIEW_BANNER } from '../../v5/openAiPreview'

export const OPENAI_PREVIEW_BANNER_TESTID = 'openai-preview-banner'

export function OpenAiPreviewBanner() {
  if (!isOpenAiPreviewActive()) return null
  return (
    <div
      role="status"
      data-testid={OPENAI_PREVIEW_BANNER_TESTID}
      className="shrink-0 border-b border-warning/40 bg-warning/10 px-3 py-1.5 text-center text-xs font-medium text-text-body"
    >
      {OPENAI_PREVIEW_BANNER}
    </div>
  )
}

/**
 * InlineRerunPrompt — compact re-run nudge shown below an edited control
 * when analysis results are stale. Does not replace StaleGuardBanner.
 */

import { typography } from '../../../../styles/typography'

interface InlineRerunPromptProps {
  visible: boolean
  onRerun?: () => void
}

export function InlineRerunPrompt({ visible, onRerun }: InlineRerunPromptProps) {
  if (!visible) return null

  return (
    <div className="flex items-center gap-1.5 mt-1.5">
      <span className={`${typography.panelMeta} text-text-light`}>
        Re-run to see how this affects the results
      </span>
      {onRerun && (
        <button
          type="button"
          onClick={onRerun}
          className={`${typography.panelMeta} px-2 py-0.5 rounded-full border border-primary/30 bg-transparent text-primary hover:bg-panel-hover transition-colors cursor-pointer`}
        >
          Re-run
        </button>
      )}
    </div>
  )
}

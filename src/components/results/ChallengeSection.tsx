/**
 * ChallengeSection — "Challenge your assumptions"
 *
 * V11 Phase E: Separate section after "What to do next" containing M2
 * decision quality prompts as expandable cards. Gated on M2 data presence.
 *
 * Data sources:
 * - Groups 3 (bias findings) and 4 (pre-mortem) from groupActionItems
 */

import { typography } from '../../styles/typography'
import type { ActionItem } from './utils/groupActionItems'
import { EyeOff, Shield } from 'lucide-react'

export interface ChallengeSectionProps {
  /** M2 bias findings (Group 3: "Worth reflecting on") */
  biasFindings: ActionItem[]
  /** M2 pre-mortem items (Group 4: "What could go wrong") */
  preMortemItems: ActionItem[]
}

export function ChallengeSection({ biasFindings, preMortemItems }: ChallengeSectionProps) {
  if (biasFindings.length === 0 && preMortemItems.length === 0) return null

  return (
    <div className="space-y-3" data-testid="challenge-section">
      {/* Bias findings — expandable cards */}
      {biasFindings.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <EyeOff className="w-4 h-4 text-text-light flex-shrink-0" />
            <h4 className={`${typography.panelHeader} text-text-header`}>
              Worth reflecting on
            </h4>
            <span className={`${typography.panelMeta} text-text-light`}>
              {biasFindings.length}
            </span>
          </div>
          {biasFindings.map(item => (
            <details key={item.id} className="border border-panel-border rounded-lg overflow-hidden">
              <summary className={`px-3 py-2 cursor-pointer hover:bg-panel-hover ${typography.panelBody} text-text-body`}>
                {item.title}
              </summary>
              {(item.whatCouldHappen || item.whatToDo) && (
                <div className="px-3 pb-2 space-y-1">
                  {item.whatCouldHappen && (
                    <p className={`${typography.panelMeta} text-text-light`}>{item.whatCouldHappen}</p>
                  )}
                  {item.whatToDo && (
                    <p className={`${typography.panelMeta} text-text-body`}>{item.whatToDo}</p>
                  )}
                </div>
              )}
            </details>
          ))}
        </div>
      )}

      {/* Pre-mortem — expandable cards */}
      {preMortemItems.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-danger flex-shrink-0" />
            <h4 className={`${typography.panelHeader} text-text-header`}>
              What could go wrong
            </h4>
            <span className={`${typography.panelMeta} text-text-light`}>
              {preMortemItems.length}
            </span>
          </div>
          {preMortemItems.map(item => (
            <details key={item.id} className="border border-panel-border rounded-lg overflow-hidden">
              <summary className={`px-3 py-2 cursor-pointer hover:bg-panel-hover ${typography.panelBody} text-text-body`}>
                {item.title}
              </summary>
              {(item.whatCouldHappen || item.whatToDo) && (
                <div className="px-3 pb-2 space-y-1">
                  {item.whatCouldHappen && (
                    <p className={`${typography.panelMeta} text-text-light`}>{item.whatCouldHappen}</p>
                  )}
                  {item.whatToDo && (
                    <p className={`${typography.panelMeta} text-text-body`}>{item.whatToDo}</p>
                  )}
                </div>
              )}
            </details>
          ))}
        </div>
      )}
    </div>
  )
}

export default ChallengeSection

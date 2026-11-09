import type { View } from './client'

/**
 * Paul's acceptance step 4 (9 Nov): Olumi's reply ends in ONE question or step. True where the newest reply carries core's own next step
 * (`answer.next`, drawn under the reply), so the UI stacks no second step of its own (the invitation) under it; Team still offers that.
 */
export const replyHasNext = (view: View): boolean => (view.chat.at(-1)?.answer?.next?.text.length ?? 0) > 0

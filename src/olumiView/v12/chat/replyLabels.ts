/**
 * The two lines core writes itself into a first draft's reply (olumi-core src/app/ai-runtime/direct-hook.ts FIRST_ANSWER_LABEL and
 * CHECK_HEADING, at wip/rs-fast d0d27fc8). They are core's fixed words, not the AI's, so the reply panel can draw them apart from the prose:
 * the label as a quiet caption, the heading as a block heading. Matched as a whole paragraph, exactly; nothing else in a reply is read.
 * When the View carries `first_answer` on the turn, the panel will style by its range instead and this match goes.
 */
export const FIRST_ANSWER_LABEL = 'A first answer from your brief and general knowledge, written before the model. Not checked against the model.'
export const CHECK_HEADING = "Olumi's check against the model"

export type ReplyLine = 'label' | 'heading' | null
export const replyLineOf = (paragraph: string): ReplyLine =>
  paragraph.trim() === FIRST_ANSWER_LABEL ? 'label' : paragraph.trim() === CHECK_HEADING ? 'heading' : null

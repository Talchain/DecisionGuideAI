/**
 * Core's or a person's words for a place that draws plain text on one line or in a text box (a menu row, a form field): markdown's marks are
 * dropped ("## ", **bold**, `code`), every word is kept in its order. Paul, 18 Nov: a kept idea's "## Find out first…" showed its hashes in the
 * right-click menu's Undo row and in the first box of "Record what you will do".
 */
export const plainWords = (text: string): string => text
  // A heading's hashes at a line's start, or after other words on the line (core's "Undo: + outside the model: ## Find out…").
  .replace(/(^|[ \t])#{1,6}[ \t]+(?=\S)/gm, '$1')
  .replace(/(\*\*|__)(?=\S)(.+?)(?<=\S)\1/g, '$2')
  .replace(/`([^`\n]+)`/g, '$1')

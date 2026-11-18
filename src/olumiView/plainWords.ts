/**
 * Words that seed a box the person edits and keeps (a kept idea in "Record what you will do"): only a heading's hashes at a line's start go.
 * Everything else stays exactly as written (Codex 008, 18 Nov: a seed is lossless; "A * B", `code` and **marks** are the person's to keep or cut).
 */
export const seedWords = (text: string): string => text.replace(/^[ \t]*#{1,6}[ \t]+(?=\S)/gm, '')

/**
 * Core's or a person's words for a place that draws plain text on one line or in a text box (a menu row, a form field): markdown's marks are
 * dropped ("## ", **bold**, `code`), every word is kept in its order. Paul, 18 Nov: a kept idea's "## Find out first…" showed its hashes in the
 * right-click menu's Undo row and in the first box of "Record what you will do".
 */
export const plainWords = (text: string): string => seedWords(text)
  // A heading's hashes after other words on the line (core's "Undo: + outside the model: ## Find out…"): two or more, so "Count # of staff" stays.
  .replace(/([ \t])#{2,6}[ \t]+(?=\S)/g, '$1')
  .replace(/(\*\*|__)(?=\S)(.+?)(?<=\S)\1/g, '$2')
  .replace(/`([^`\n]+)`/g, '$1')

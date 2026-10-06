/**
 * Limits for reading ONE document into the brief (ROADMAP 3.8, slice 1).
 *
 * ⚠ BRIEF_CHAR_BUDGET is not a style choice. CEE stores only the first 8,000
 * characters of a brief (normalise-brief-text.ts, with a database check) and
 * only logs the cut. A figure past that point could be drafted as "yours"
 * while the stored brief no longer contains it, so the WHOLE brief (the
 * user's own text plus the file) is held under 8,000 with a margin.
 */
export const MAX_FILE_BYTES = 10 * 1024 * 1024
/** Slides or pages read from one file. */
export const MAX_UNITS = 40
/** Total brief length after the file is added, existing text included. */
export const BRIEF_CHAR_BUDGET = 7_500
/** Refuse a zip whose declared contents would expand past this. */
export const MAX_UNZIPPED_BYTES = 50 * 1024 * 1024
/** Rows read from one sheet, and from the whole workbook. */
export const MAX_SHEET_ROWS = 500
export const MAX_WORKBOOK_ROWS = 2_000

export const ACCEPTED_EXTENSIONS = ['.xlsx', '.csv', '.pptx', '.docx'] as const
export const ACCEPT_ATTRIBUTE = ACCEPTED_EXTENSIONS.join(',')

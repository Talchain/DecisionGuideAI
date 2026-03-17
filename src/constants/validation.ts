/** Minimum character count for a decision brief to be submittable.
 *  Must match or be stricter than CEE's Zod schema (currently 30 chars). */
export const BRIEF_MIN_CHARS = 30

/** Minimum word count — catches pure gibberish without spaces. */
export const BRIEF_MIN_WORDS = 2

/** Ratio threshold for non-alphabetic characters (soft warning, non-blocking). */
export const BRIEF_NON_ALPHA_WARN_RATIO = 0.6

// ---------------------------------------------------------------------------
// Example brief suggestion chips (shown on CEE validation errors)
// ---------------------------------------------------------------------------

export interface BriefSuggestionChip {
  id: string
  label: string
  text: string
}

export const EXAMPLE_BRIEF_CHIPS: BriefSuggestionChip[] = [
  {
    id: 'market-expansion',
    label: 'Market expansion',
    text: 'Should we expand into the European market this year or focus on growing our US customer base? Key factors include regulatory costs, market size, and competitive landscape.',
  },
  {
    id: 'hiring-strategy',
    label: 'Hiring strategy',
    text: 'We need to decide between hiring three senior engineers or six junior engineers for our platform team. The main considerations are velocity, mentorship capacity, and budget.',
  },
  {
    id: 'product-launch',
    label: 'Product launch timing',
    text: 'Should we launch the premium tier this quarter or wait until we have more active users? We want to maximise revenue without hurting retention.',
  },
]

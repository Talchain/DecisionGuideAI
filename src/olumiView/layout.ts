/**
 * THE ONE LAYOUT MODULE (View API design §3). The only place in src/olumiView/ that may pick, place or measure View values: which cards a
 * surface draws, and coordinate arithmetic. It never writes a word, formats a figure, orders what the View ordered, or joins strings:
 * core did all of that. Everything else here draws View strings exactly as they arrive (src/olumiView/__tests__/contract.spec.tsx).
 */
import type { ViewCard, ViewModel } from './client'

/**
 * The option cards core compares, in the View's own order: what the chances block draws. An option core does not compare carries its
 * status on its card ("removed", "ruled out"); it has no chance to show, and the block leaves it out as the base does (review 00051).
 */
export const optionCards = (model: ViewModel): ViewCard[] => model.cards.filter((c) => c.family === 'option' && c.status === null)

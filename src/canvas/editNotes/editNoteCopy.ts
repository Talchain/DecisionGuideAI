/** Product-authored copy from EDIT-AI §3.4. Labels are the only substitutions. */
const quoted = (labels: readonly string[]) => labels.map(label => `‘${label}’`).join(' and ')
export const editNoteCopy = {
  F1All: (factor: string) => `Every option sets ‘${factor}’ itself, so this figure can’t change how they compare. Did you mean to change it for one option?`,
  F1Some: (factor: string, setters: readonly string[], keepers: readonly string[]) => `${quoted(setters)} ${setters.length === 1 ? 'sets' : 'set'} ‘${factor}’ ${setters.length === 1 ? 'itself' : 'themselves'}. The figure on this card is today’s value, which ${quoted(keepers)} ${keepers.length === 1 ? 'keeps' : 'keep'}. Did you mean to change it for ${quoted(setters)}?`,
  A1: (label: string, goal: string) => `‘${label}’ isn’t linked to anything yet, so it can’t affect ‘${goal}’.`,
  A2: (label: string, goal: string) => `‘${label}’ doesn’t reach ‘${goal}’ yet, so it can’t change any option’s chance.`,
  O1: (label: string, other: string) => `‘${label}’ now changes the same things by the same amounts as ‘${other}’, so the analysis can’t tell them apart.`,
  O2: (factor: string, option: string) => `‘${factor}’ doesn’t reach the goal yet, so setting it for ‘${option}’ won’t change that option’s chance.`,
  R1: (label: string) => `Another card is also called ‘${label}’. In chat, Olumi may not know which one you mean.`,
  // Not "Olumi can now say how likely…": the target may not be the last thing withholding the chance (unsized
  // links can still hold it), so the note claims only what the edit did.
  G1: (goal: string) => `Your target for ‘${goal}’ is set. Run to include it in the analysis.`,
  // Slice 2 (EDIT-AI §3.4/§3.6): what the LAST Run rested on. Never a link figure; always "the last Run" where the
  // sentence speaks of the past, so it stays true after the model has moved on.
  S1: (options: readonly string[]) => `The chance for ${quoted(options)} rests most on this link, so this change could move it a lot. Run again to see.`,
  S1Own: (options: readonly string[]) => `You’ve replaced Olumi’s estimate on the link the chance for ${quoted(options)} rested most on. Run again to see.`,
  D1: (options: readonly string[]) => `You’ve reversed the link the chance for ${quoted(options)} rested most on. The options may now compare very differently. Run again to see.`,
  S2: 'The last Run’s comparison could change if this link’s strength changes. Run again to see whether it still holds.',
  F4: (options: readonly string[], factor: string) => `The chance for ${quoted(options)} rested most on ‘${factor}’. Run again to see what your figure does to it.`,
  F3: (factor: string, figure: string | null) => figure
    ? `The last Run found a turning point for ‘${factor}’ at ${figure}. Your new figure is past it, so the options may compare differently now. Run again to see.`
    : `The last Run found a turning point for ‘${factor}’. Your new figure is past the turning point Olumi found, so the options may compare differently now. Run again to see.`,
  X1Link: (options: readonly string[]) => `The last Run’s chance for ${quoted(options)} rested most on this link. Run again to see the options without it.`,
  X1Card: (options: readonly string[], label: string) => `The last Run’s chance for ${quoted(options)} rested most on ‘${label}’. Run again to see the options without it.`,
  G2: 'The last Run measured each option’s chance against the old target. Run again to measure against this one.',
  O3: (option: string, factor: string, value: string, side: string, limit: string) => `‘${option}’ now sets ‘${factor}’ to ${value}, ${side} the ${limit} limit you set.`,
  O4: (node: string, limit: string) => `No option changes anything that leads to ‘${node}’, so the ${limit} limit can’t rule any option out yet.`,
  actions: { option: 'Set it for an option', editOption: 'Edit option', link: 'Link it', rename: 'Rename', keep: 'Keep it', discuss: 'Discuss with Olumi', run: 'Run', runAgain: 'Run again', undo: 'Undo' },
} as const

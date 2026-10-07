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
  actions: { option: 'Set it for an option', editOption: 'Edit option', link: 'Link it', rename: 'Rename', keep: 'Keep it', discuss: 'Discuss with Olumi', run: 'Run' },
} as const

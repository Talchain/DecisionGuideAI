/** The What if lens's words (`WhatIfKey.tsx`), in a module of their own so the core lane's key card says the same without the legacy key's imports. */
export const WHAT_IF_COPY = {
  nothingSaved: 'What-if, nothing saved',
  legendEmpty: 'Pick a factor and try a different value. Nothing is saved.',
  legendHeld: (label: string, figure: string) => `What if ${label} were ${figure}? Nothing is saved.`,
  factor: 'Factor',
  value: 'What-if value',
  run: 'Run this what-if',
  running: 'Running the what-if…',
  clear: 'Clear',
  saved: 'Saved',
  whatIf: 'What if',
  // TM-27 (the J5 TryRange comp): on the card tried, the person's figure as they typed it; the way back to the model as saved.
  trying: (typed: string) => `Trying ${typed}`,
  back: (n: number | null) => (n === null ? 'Back to the model' : `Back to version ${n}`),
  provisional: 'Provisional',
  notPaired: 'Not confirmed like-for-like: these two runs may not have drawn the same samples, so a small difference may be noise.',
  staleBase: 'Your model changed since this what-if was set up. Run it again.',
  refused: "Olumi couldn't run this what-if on this model.",
  signIn: 'Sign in to run a what-if on this model.',
  unusable: 'The what-if could not run right now. Nothing was saved.',
  noFactors: 'This model has no factor with a value to try a different one for.',
} as const

export const WHATIF_LEGEND_SAVED = 'Saved'
export const WHATIF_LEGEND_TRIED = 'What-if'

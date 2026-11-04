/** A lens key card's words (`LensInfoPanel.tsx`), in a module of their own so the core lane's key card says the same without the legacy panel's imports. */
export const LENS_KEY_COPY = {
  close: 'Back to the model',
  fold: 'Fold the key',
  unfold: 'Open the key',
  premortemEmpty: 'Olumi has not imagined this model failing yet.',
  premortemWhat: 'It writes plausible ways each option could fail, each tied to what it rests on in the model, for you to challenge.',
  premortemAsk: 'Ask Olumi to imagine it failed',
  premortemNeedsRun: 'Olumi imagines failures from what a current Run shows. Run the analysis, then ask here.',
  premortemInChat: 'Olumi’s failure stories arrive in the chat.',
  fragileHeading: 'Links that could change how the options compare',
  sensitiveHeading: 'Factors the result moves with most',
  focusOn: 'If you could strengthen one relationship, focus on:',
  nothingMeasured: 'This Run measured nothing it is especially sensitive to.',
  fragileNotChecked: "Fragile links weren't checked on this Run.",
  modelRelative: 'These describe this model as it stands, not what to choose.',
  premortemLegend: 'In front: what Olumi’s failure stories rest on. Open the key to read them.',
  whatChangesLegend: 'Numbered 1 to 3: the links the result moves with most. The links this Run is most sensitive to are drawn wider.',
} as const

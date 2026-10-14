/**
 * The UNBOUND model on the canvas getting its first id.
 *
 * B UI's final check on d770bc1c: the value editor is keyed by the model instance, and the first "Save as" of an
 * unbound model (Start fresh → Undo leaves the id null) moved the id null → UUID, which remounted the editor and threw
 * away a genuine refusal and its draft. The id changed; the model did not.
 *
 * So every writer that names the model ALREADY on the canvas, without replacing it (Save as, Save as Scenario from a
 * template, the first Send's lazy id, an import's registration), writes the id through `scenarioIdWrite`. When the
 * model had no id, that same store write records `unboundModelBinding`, a fresh object naming the new id, and a reader
 * can tell this write from any other change of id (opening another decision, a reset, a load). Every other writer of
 * `currentScenarioId` is untouched, so an id change stays a new model unless its writer says otherwise.
 */
export interface UnboundModelBinding {
  readonly scenarioId: string
}

export function scenarioIdWrite(
  previousId: string | null | undefined,
  id: string,
): { currentScenarioId: string; unboundModelBinding?: UnboundModelBinding } {
  return previousId == null ? { currentScenarioId: id, unboundModelBinding: { scenarioId: id } } : { currentScenarioId: id }
}

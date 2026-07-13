/**
 * Analysis-tab parity modals — public wiring surface.
 *
 * Mount `<DefineSuccessModal />` and `<DecisionRecordModal />` ONCE (e.g.
 * next to AskOlumiDrawer in the results tree), then open them from any
 * surface via `openDefineSuccess()` / `openDecisionRecord()` — no prop
 * drilling. Saved state is read back through the exported selectors/hooks.
 */
export { DefineSuccessModal, DEFINE_SUCCESS_COPY } from './DefineSuccessModal'
export { DecisionRecordModal, DECISION_RECORD_COPY } from './DecisionRecordModal'
export {
  useSuccessMeasureStore,
  selectSuccessMeasure,
  openDefineSuccess,
  closeDefineSuccess,
  useSuccessMeasureForScenario,
  type SuccessMeasure,
  type SuccessDirection,
} from './successMeasureStore'
export {
  useDecisionRecordStore,
  selectDecisionRecord,
  openDecisionRecord,
  closeDecisionRecord,
  useDecisionRecordForScenario,
  type DecisionRecord,
} from './decisionRecordStore'
export { buildMeasureSentence, DIRECTION_OPTIONS, UNIT_OPTIONS } from './measureSentence'
export { resolveScenarioKey, UNSCOPED_SCENARIO_KEY } from './scenarioKey'

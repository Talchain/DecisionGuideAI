// A dev olumi-core whose AI is SCRIPTED (no provider calls), for driving the UI end to end. Not part of the UI build.
// Copy into a clone of olumi-core (origin/staging) as scripts/scripted-core.ts, then:
//   OLUMI_DB=/private/tmp/x/ui.db OLUMI_ADMIN_KEY=<24+ chars> PORT=3947 pnpm -s tsx scripts/scripted-core.ts
// Same pattern as core's scripts/dev-seed.ts. Any brief gets the synthetic "capacity" model (drafts are not read from the brief),
// so for a clean first model type the brief in dev-seed.ts (BRIEF below): the checks quote the brief.
import { Store } from '../src/store/store.js';
import { Service } from '../src/app/service.js';
import { createApp } from '../src/server/app.js';
import { loadPrompts } from '../src/run/pipeline.js';
import { capacity, olumi, q } from '../src/contract/__tests__/fixtures/capacity.js';
import type { callStructured } from '../src/run/openai.js';

export const BRIEF = 'Our team resolves 80 tickets a week. Each specialist adds about 20, somewhere between 10 and 30. Keep current staffing or add one specialist? We need at least 100 tickets a week. Total is today plus the specialists. Our team lead says a new hire may unsettle the team.';
const none = { intent: 'change' as const, records: [], remove: [], question: null, title: null, period: null, coaching_questions: null, decide_by: null, withdraw_decide_by: false };
const coaches = [
  { answer: 'In this model, adding a specialist reaches your aim about half the time; carrying on never does.', why: ['It turns on what a new specialist really adds.'], next: { move: 'pre_mortem', about: ['per_specialist'], text: 'Imagine it is three months on and the hire did not lift capacity enough. What went wrong?' } },
  { answer: 'Here is staff absence as a factor, for you to approve.', why: [], next: { move: 'gather_evidence', about: ['staff_absence'], text: 'Check last quarter’s absence records.' } },
];
let turn = 0;
const answer = (schema: string): unknown =>
  schema === 'draft' ? (turn = 0, capacity())
    : schema === 'coach' ? coaches[Math.min(turn++, coaches.length - 1)]
      : { ...none, records: [q('staff_absence', 'ticket/week', 'fact', { kind: 'interval', low: 2, high: 10, range_kind: 'plausible', likely: 5 }, olumi('typical absence for a small team'))] };
const caller = (async (o: Parameters<typeof callStructured>[0]) => ({ parsed: answer(o.schemaName.replace('olumi_', '')), text: '', ms: 0, response_id: '', model: 'scripted', usage: { input_tokens: 0, cached_tokens: 0, output_tokens: 0, reasoning_tokens: 0 } })) as typeof callStructured;

const service = new Service(new Store(process.env['OLUMI_DB']!), { prompts: loadPrompts('prompts'), caller, today: () => new Date().toISOString().slice(0, 10), commit: 'scripted-dev' });
createApp({ service, page: () => ({ html: '', js: '' }), adminKey: process.env['OLUMI_ADMIN_KEY'] ?? null, commit: 'scripted-dev', secureCookie: false })
  .listen(Number(process.env['PORT'] ?? 3947), () => console.log('scripted olumi-core on', process.env['PORT'] ?? 3947));

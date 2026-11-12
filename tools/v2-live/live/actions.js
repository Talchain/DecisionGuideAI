/* Olumi v2, LIVE actions: the acts the engine takes, one small module the renderer can call (window.OlumiLive.act).
   The same contract the journey layer proved (DGAI src/olumiView/journey.ts): every write goes to the engine and the View is read again.
   PL-640: an answer to Olumi's reading is never sent on its own and an empty selection is never widened to every change; approve sends
   exactly the lines given, with the readings the person confirmed (only_readings), and never refuse_readings for "unsure". */
(function () {
  'use strict';
  const Live = window.OlumiLive = window.OlumiLive || {};
  const op = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  class EngineSaid extends Error { constructor(status, words) { super(words); this.status = status; } }
  async function call(method, path, body) {
    // Same origin only, and every write names the person this page was opened as (the View's you_id): the engine refuses a write whose cookie is
    // someone else's now (409 NOT_FOR_THIS_PAGE), exactly as the DGAI client sends it (olumiCore/team/api.ts call).
    const headers = { 'content-type': 'application/json', ...(method === 'POST' && Live.view && Live.view.you_id ? { 'x-olumi-as': Live.view.you_id } : {}) };
    const r = await fetch(path, { method, credentials: 'same-origin', mode: 'same-origin', headers, body: body === undefined ? undefined : JSON.stringify(body) });
    let j = null; try { j = await r.json(); } catch { j = null; }
    if (!r.ok) throw new EngineSaid(r.status, (j && (j.error || j.message)) || `The engine answered ${r.status}.`);
    return j;
  }
  const S = () => encodeURIComponent(Live.sid);
  async function view() { Live.view = await call('GET', `/api/scenarios/${S()}/view?schema=3&all=1`); return Live.view; }
  /** Is Olumi still working (a draft, a turn, a reply to an edit)? */
  const working = (v) => !!(v && ((v.turn && v.turn.status === 'answering') || (v.draft && v.draft.status === 'drafting') || (v.reply && v.reply.status === 'running')));
  async function awaitTurn(every = 1000, limit = 180000) {
    const t0 = Date.now();
    for (;;) { const v = await view(); if (!working(v)) return v; if (Date.now() - t0 > limit) return v; await new Promise((r) => setTimeout(r, every)); }
  }
  Live.EngineSaid = EngineSaid;
  Live.working = working;
  Live.act = {
    view,
    awaitTurn,
    /** The person's words to Olumi (an answer to one of its questions, a different measure, a correction): Olumi answers in the engine. */
    message: async (text) => { await call('POST', `/api/scenarios/${S()}/messages`, { text, op: op() }); return awaitTurn(); },
    /** Approve exactly these lines (`only` record ids, `only_top` field names), with the readings confirmed. Never empty: refused here. */
    approve: async (proposal, base, { only, only_top, readings }) => {
      if ((only || []).length + (only_top || []).length === 0) throw new EngineSaid(0, 'Nothing is chosen to approve.');
      const body = { base, only, only_top, ...(readings && readings.length ? { only_readings: readings } : {}) };
      await call('POST', `/api/proposals/${proposal}/approve`, body); return view();
    },
    /** The engine's own whole approval (applies no reading of Olumi's). */
    approveWhole: async (proposal, base) => { await call('POST', `/api/proposals/${proposal}/approve`, { base }); return view(); },
    /** Set the proposal aside: nothing of it is added. */
    setAside: async (proposal) => { await call('POST', `/api/proposals/${proposal}/discard`, {}); return view(); },
    rename: async (base, record, label) => { await call('POST', `/api/scenarios/${S()}/rename`, { base, record, label, op: op() }); return view(); },
    editFigure: async (base, quantity, typed) => { await call('POST', `/api/scenarios/${S()}/edit`, { base, quantity, typed, op: op() }); return view(); },
  };
})();

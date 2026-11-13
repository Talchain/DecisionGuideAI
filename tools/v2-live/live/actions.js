/* Olumi v2, LIVE actions: the acts the engine takes, one small module the renderer can call (window.OlumiLive.act).
   The same contract the journey layer proved (DGAI src/olumiView/journey.ts): every write goes to the engine and the View is read again.
   PL-640: an empty selection is never widened to every change; approve sends exactly the lines given, with the readings the person confirmed
   (only_readings) and declined (refuse_readings), each by the View's reading.id exactly as served; "unsure" goes in neither.
   PL-661/667: a confirmed or declined reading is an act on its own (sent with empty only / only_top); only a truly empty act is refused here.
   Set aside refuses only the readings the person declined; with none declined it refuses nothing, and the engine says (409) if one is unsettled. */
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
  /** A reading id must be one the current proposal serves (its marks' reading.id), used exactly as served: never built, parsed or guessed. */
  function served(ids) {
    const p = Live.view && Live.view.proposal, known = new Set(((p && p.marks) || []).filter((m) => m.reading).map((m) => m.reading.id));
    if (ids.some((id) => !known.has(id))) throw new EngineSaid(0, 'That reading is not on this proposal.');
  }
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
    /** Approve exactly these lines (`only` record ids, `only_top` field names), with the readings confirmed and declined. Truly empty: refused here. */
    approve: async (proposal, base, { only = [], only_top = [], readings = [], decline = [] }) => {
      served([...readings, ...decline]);
      if (only.length + only_top.length + readings.length + decline.length === 0) throw new EngineSaid(0, 'Nothing is chosen to approve.');
      const body = { base, only, only_top, ...(readings.length ? { only_readings: readings } : {}), ...(decline.length ? { refuse_readings: decline } : {}) };
      await call('POST', `/api/proposals/${proposal}/approve`, body); return view();
    },
    /** The engine's own whole approval (applies no reading of Olumi's). */
    approveWhole: async (proposal, base) => { await call('POST', `/api/proposals/${proposal}/approve`, { base }); return view(); },
    /** Set the proposal aside: nothing of it is added; `decline`: the readings the person declined, refused by their served ids. */
    setAside: async (proposal, decline = []) => { served(decline); await call('POST', `/api/proposals/${proposal}/discard`, decline.length ? { refuse_readings: decline } : {}); return view(); },
    rename: async (base, record, label) => { await call('POST', `/api/scenarios/${S()}/rename`, { base, record, label, op: op() }); return view(); },
    editFigure: async (base, quantity, typed) => { await call('POST', `/api/scenarios/${S()}/edit`, { base, quantity, typed, op: op() }); return view(); },
  };
})();

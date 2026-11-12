/* Olumi v2, LIVE conversation and review panel (a NEW component; app.js is untouched until it offers a slot, hook H3).
   Draws from the engine's View only, in the engine's words: where the conversation stands (waiting, failed, held back, an answer),
   Olumi's questions (each answerable), Olumi's proposal with its lines, Olumi's reading with the person's three answers, approve and
   set aside, and the message box. The person's answer to a reading is HELD here and goes only with an approval they make (PL-640).
   After an act the page is drawn again from the engine (until app.js offers Olumi.setView, hook H2). */
(function () {
  'use strict';
  const Live = window.OlumiLive || {};
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const segs = (a) => (a || []).map((x) => esc(x.text || '')).join('');
  const st = { answers: {}, ticks: null, context: null, busy: false, error: null, open: true };

  /** Where the conversation stands, typed, in the engine's words (the journey layer's turnStateOf). */
  function turnState(v) {
    const t = v.turn;
    if (t) return { kind: t.status === 'answering' ? 'waiting' : t.status, said: t.said, words: t.words };
    const last = (v.chat || [])[v.chat.length - 1];
    if (!last) return { kind: 'none' };
    if (last.broke) return { kind: 'held', said: last.said, words: last.broke };
    if (last.answer) return { kind: 'answered', said: last.said, answer: last.answer, status: last.status };
    return last.problem ? { kind: 'problem', said: last.said, words: last.problem, status: last.status } : { kind: 'none', said: last.said, status: last.status };
  }
  const readings = (p) => ((p && p.marks) || []).filter((m) => m.reading).map((m) => ({ id: m.reading.id, status: m.status, question: m.title }));
  const lineKey = (c) => `${c.top ? 'top' : 'rec'}:${c.id}`;

  function render() {
    const v = Live.view; if (!v) return;
    const host = document.getElementById('live-panel'); if (!host) return;
    const MW = v.model_words || {}, p = v.proposal || null, ts = turnState(v), qs = (v.model && v.model.coaching_questions) || [];
    if (p && st.ticks === null) st.ticks = new Set();
    const ch = p ? p.changes || [] : [];
    const picked = ch.filter((c) => st.ticks && st.ticks.has(lineKey(c)));
    const confirmed = Object.keys(st.answers).filter((id) => st.answers[id] === 'confirm');
    const said = (t) => (t ? `<div class="lp-said"><span class="lp-by">${esc(t)}</span></div>` : '');
    let turn = '';
    if (ts.kind === 'waiting') turn = `${said(ts.said)}<p class="lp-olumi lp-meta" data-live="turn-waiting">${esc(ts.words)}</p>`;
    else if (ts.kind === 'failed' || ts.kind === 'lost' || ts.kind === 'problem') turn = `${said(ts.said)}<p class="lp-olumi lp-err" data-live="turn-${ts.kind}">${esc(ts.words)}</p>`;
    else if (ts.kind === 'held') turn = `${said(ts.said)}<p class="lp-olumi lp-meta" data-live="turn-held">${esc(ts.words)}</p>`;
    else if (ts.kind === 'answered') turn = `${said(ts.said)}<div class="lp-olumi" data-live="turn-answered"><p>${segs(ts.answer.answer)}</p>${ts.answer.next ? `<p class="lp-next"><b>${esc(ts.answer.next.label)}</b> ${segs(ts.answer.next.text)}</p>` : ''}</div>`;
    const status = ts.status ? `<p class="lp-meta" data-live="turn-status">${esc(ts.status)}</p>` : '';
    const questions = qs.length && !p ? `<div class="lp-qs">${qs.map((q, i) => `<button type="button" class="lp-q" data-live="question" data-at="${i}">${esc(q)}</button>`).join('')}</div>` : '';
    const reads = readings(p).map((r) => `<div class="lp-reading" data-live="reading" data-reading="${esc(r.id)}"><p class="lp-meta">${esc(r.status)}</p><p>${esc(r.question)}</p>
      <div class="lp-acts"><button type="button" class="btn${st.answers[r.id] === 'confirm' ? ' is-picked' : ''}" aria-pressed="${st.answers[r.id] === 'confirm'}" data-live="reading-confirm" data-id="${esc(r.id)}">Confirm</button>
      <button type="button" class="btn" data-live="reading-different" data-id="${esc(r.id)}">A different measure</button>
      <button type="button" class="btn${st.answers[r.id] === 'unsure' ? ' is-picked' : ''}" aria-pressed="${st.answers[r.id] === 'unsure'}" data-live="reading-unsure" data-id="${esc(r.id)}">Unsure</button></div></div>`).join('')
    const lines = p ? `<ul class="lp-lines">${ch.map((c) => `<li><label><input type="checkbox" data-live="line" data-key="${esc(lineKey(c))}"${st.ticks.has(lineKey(c)) ? ' checked' : ''}> <span>${esc(c.text)}</span></label></li>`).join('')}</ul>` : '';
    const review = p ? `<section class="lp-review" data-live="review"><header><b>${esc(p.heading)}</b> <span class="lp-meta">${esc(p.on)}</span></header>${MW.heldBody ? `<p class="lp-meta">${esc(MW.heldBody)}</p>` : ''}${reads}${lines}
      <div class="lp-acts"><button type="button" class="btn btn--primary" data-live="approve">Approve</button><button type="button" class="btn" data-live="approve-selected"${picked.length ? '' : ' disabled'}>Approve selected · ${picked.length}</button>
      ${MW.heldConfirm ? `<button type="button" class="btn" data-live="set-aside">${esc(MW.heldConfirm)}</button>` : ''}</div></section>` : '';
    const ctx = st.context ? `<p class="lp-meta lp-ctx" data-live="context">${esc(st.context.text)} <button type="button" class="lp-x" data-live="context-clear" aria-label="${esc(MW.cancel || 'Cancel')}">×</button></p>` : '';
    host.innerHTML = `<div class="lp-head"><span class="lp-meta">${esc((v.team_presence && v.team_presence.label) || '')}</span></div>
      <div class="lp-body">${turn}${status}${questions}${review}</div>
      ${st.error ? `<p class="lp-err" role="alert" data-live="error">${esc(st.error)}</p>` : ''}
      <form class="lp-composer" data-live="composer">${ctx}<input type="text" data-live="field" placeholder="${p ? 'Tell Olumi what to change' : 'Reply, or edit the model'}" aria-label="${p ? 'Tell Olumi what to change' : 'Reply, or edit the model'}"${st.busy || Live.working(v) ? ' disabled' : ''}><button type="submit" class="btn btn--primary" data-live="send"${st.busy || Live.working(v) ? ' disabled' : ''}>Send</button></form>`;
    const body = host.querySelector('.lp-body'); if (body) body.scrollTop = body.scrollHeight;
  }

  async function run(f, redraw) {
    st.busy = true; st.error = null; render();
    try { await f(); if (redraw) { location.reload(); return; } } catch (e) { st.error = e.message || String(e); } finally { st.busy = false; render(); }
  }
  function onClick(e) {
    const b = e.target.closest('[data-live]'); if (!b) return;
    const v = Live.view, p = v.proposal, k = b.dataset.live;
    if (k === 'question') { st.context = { kind: 'question', text: v.model.coaching_questions[+b.dataset.at] }; render(); document.querySelector('[data-live="field"]').focus(); }
    else if (k === 'context-clear') { st.context = null; render(); }
    else if (k === 'reading-confirm' || k === 'reading-unsure') { st.answers = { ...st.answers, [b.dataset.id]: k === 'reading-confirm' ? 'confirm' : 'unsure' }; render(); }
    else if (k === 'reading-different') { const { [b.dataset.id]: _x, ...rest } = st.answers; void _x; st.answers = rest; const r = readings(p).find((x) => x.id === b.dataset.id); st.context = { kind: 'measure', text: r ? r.question : '' }; render(); document.querySelector('[data-live="field"]').focus(); }
    else if (k === 'approve') {
      const confirmed = Object.keys(st.answers).filter((id) => st.answers[id] === 'confirm');
      // Approve is the whole proposal: with a confirmed reading every line goes WITH it; without one, the engine's own whole approval.
      run(() => (confirmed.length ? Live.act.approve(p.id, p.base, { only: p.changes.filter((c) => !c.top).map((c) => c.id), only_top: p.changes.filter((c) => c.top).map((c) => c.id), readings: confirmed }) : Live.act.approveWhole(p.id, p.base)), true);
    } else if (k === 'approve-selected') {
      const confirmed = Object.keys(st.answers).filter((id) => st.answers[id] === 'confirm'), sel = p.changes.filter((c) => st.ticks.has(lineKey(c)));
      run(() => Live.act.approve(p.id, p.base, { only: sel.filter((c) => !c.top).map((c) => c.id), only_top: sel.filter((c) => c.top).map((c) => c.id), readings: confirmed }), true);
    } else if (k === 'set-aside') run(() => Live.act.setAside(p.id), true);
  }
  function onChange(e) { const b = e.target.closest('[data-live="line"]'); if (!b) return; if (b.checked) st.ticks.add(b.dataset.key); else st.ticks.delete(b.dataset.key); render(); }
  function onSubmit(e) {
    if (!e.target.closest('[data-live="composer"]')) return; e.preventDefault();
    const f = document.querySelector('[data-live="field"]'), text = f ? f.value.trim() : ''; if (!text) return;
    run(async () => { const v = await Live.act.message(text); st.context = null; const t = turnState(v); if (t.kind === 'answered' || v.proposal) location.reload(); }, false);
  }
  function mount() {
    if (Live.error) { const p = document.createElement('p'); p.className = 'lp-fatal'; p.textContent = Live.error; document.body.appendChild(p); return; }
    const host = document.createElement('aside'); host.id = 'live-panel'; host.className = 'live-panel'; host.setAttribute('aria-label', 'Conversation with Olumi');
    document.body.appendChild(host);
    host.addEventListener('click', onClick); host.addEventListener('change', onChange); host.addEventListener('submit', onSubmit);
    render();
    // A turn still running when the page opened (a reload mid-answer): keep reading until it ends.
    if (Live.working(Live.view)) Live.act.awaitTurn().then(() => location.reload());
  }
  Live.panel = { render, turnState, state: st };
  document.addEventListener('DOMContentLoaded', mount);
})();

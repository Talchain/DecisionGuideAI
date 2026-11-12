/* Olumi v2, LIVE data source (replaces data.js when served by the engine).
   Reads the scenario's View (olumi.view/3) from the engine that serves this page, same origin, with the private-link cookie the
   browser already holds, and offers it to app.js exactly as data.js did: window.VIEWS = { live: <View> }, ?data=live.
   The scenario id comes from the engine's own redirect (#/scenario/00000000-0000-4000-8000-<12 hex>) or ?sid=s_<12 hex>.
   Synchronous on purpose, until app.js offers a boot hook for async data (hook H1): app.js reads window.VIEWS once, on DOMContentLoaded. */
(function () {
  'use strict';
  const Q = new URLSearchParams(location.search);
  const fromHash = /#\/scenario\/00000000-0000-4000-8000-([0-9a-f]{12})\b/.exec(location.hash);
  const sid = Q.get('sid') || (fromHash ? `s_${fromHash[1]}` : null);
  const Live = window.OlumiLive = window.OlumiLive || {};
  Live.sid = sid;
  Live.read = function readSync() {
    const x = new XMLHttpRequest();
    x.open('GET', `/api/scenarios/${encodeURIComponent(sid)}/view?schema=3&all=1`, false);
    x.send();
    if (x.status !== 200) throw new Error(`The engine did not serve this scenario (${x.status}).`);
    return JSON.parse(x.responseText);
  };
  if (!sid) { Live.error = 'No scenario: open this page from your private link.'; window.VIEWS = {}; return; }
  try { Live.view = Live.read(); window.VIEWS = { live: Live.view }; }
  catch (e) { Live.error = String(e.message || e); window.VIEWS = {}; return; }
  // app.js reads ?data= when it loads (after this file): point it at the live View, keeping every other parameter.
  if (Q.get('data') !== 'live') { Q.set('data', 'live'); Q.set('sid', sid); history.replaceState(null, '', `${location.pathname}?${Q.toString()}`); }
})();

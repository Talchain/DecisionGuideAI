#!/bin/zsh
# v2 on the live engine: my replay core (:4051 only, OLUMI_AI_PATH=rebuild, zero calls) serving v2 + live/ as its page, each branch on its own
# COPY of the approved funding model, answered by Paul's saved replies for his goal answer. run-v2.sh <core head (40)> <W> <H>
set -u
HEAD_=$1 W=$2 H=$3; [ ${#HEAD_} -eq 40 ] || { echo "head must be 40 hex"; exit 2; }
P=${0:A:h}; O=~/Documents/GitHub/output/ui-slice-20261112; SP=/private/tmp/claude-502/-Users-paulslee-Documents-GitHub/66fa1cef-cae1-4877-adcb-c726aa0b2bc1/scratchpad
HV=~/olumi-work/recovery/tools-dl/heavy.sh; RUN=~/olumi-work/candidate-check/runs/20261112-a13-gate; BANK=$RUN/bank-before-send-update; CW=~/olumi-work/worktrees/ui-join-core
[ "$(git -C $CW rev-parse HEAD)" = "$HEAD_" ] || { echo "core HEAD is not $HEAD_"; exit 3; }
DIST=$SP/v2-dist; ~/Documents/GitHub/output/olumi-moves-20261112/v2-live/live/build-dist.sh $DIST >/dev/null || exit 4
export CORE_W=$CW CORE_HEAD=$HEAD_ UI_DIST=$DIST BASE=http://127.0.0.1:4051 REPLAY_PACE=1 W H SID=s_10af6c5feed7 REPLAY_ATTEMPTS=$BANK/update-attempts.jsonl
export SAID='Success would be at least 18 months of runway after this raise.' MEASURE='Measure success as months of runway at the planned spend, not at the lean spend.'
ROOT=$P/${HEAD_:0:8}-${W}x${H}; ST=$SP/v2-store; rm -rf $ROOT; mkdir -p $ROOT
serve() { ( $HV $SP/start-4051.sh $ST >> $ROOT/core.log 2>&1 & ); for i in {1..60}; do curl -s -m 2 -o /dev/null $BASE/healthz && break; sleep 2; done
  export LINKPATH=$(curl -s -X POST -H 'content-type: application/json' -H "x-olumi-admin: $(cat $RUN/admin.key)" -d '{}' $BASE/api/admin/people/1/reissue | python3 -c 'import sys,json,urllib.parse as u; l=json.load(sys.stdin)["link"]; p=u.urlparse(l); print(p.path + ("?" + p.query if p.query else ""))'); }
copy() { rm -rf $ST; mkdir -m 700 $ST; sqlite3 "file:$BANK/olumi.db?mode=ro&immutable=1" ".backup '$ST/olumi.db'"; cp $RUN/store-a13f-pending/ai-routes.local.json $ST/; chmod 600 $ST/*; export STORE=$ST; }
for ph in ${=PHASES:-confirm unsure different aside}; do export OUT=$ROOT/$ph; mkdir -p $OUT; copy; serve; PHASE=$ph $HV node $P/drive-v2.mjs; $O/halt-4051.sh
  [ $ph = confirm ] && { serve; PHASE=cold $HV node $P/drive-v2.mjs; $O/halt-4051.sh; }; rm -rf $ST; done
for f in $ROOT/*/results.json; do echo "== ${f:h:t}"; python3 -c "import json,sys; r=json.load(open(sys.argv[1])); [print(s['result'], s['name'], '('+s['note'][:300]+')') for s in r['steps']]; print('console errors', {k:len(v) for k,v in r.items() if k.startswith('errors')})" $f; done

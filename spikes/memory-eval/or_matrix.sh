#!/bin/sh
# OpenRouter engine matrix (resumable): per model, smoke with reasoning off (else lowest effort, else default) →
# 1 base run on blind5 + extraction scoring. Models with a finished result are skipped.
# Usage: sh or_matrix.sh [provider/model:label ...]  (no arguments = the cheap-model matrix)
SPIKE=$(cd "$(dirname "$0")" && pwd)
SVC=$SPIKE/../../service
KEY=$(grep '^OPEN_ROUTER_API_KEY=' $SPIKE/.env | cut -d= -f2- | tr -d '"'"'"' \r')
run_model() { # model label
  model=$1; label=$2
  res=$(ls -t $SPIKE/results/service-dataset_blind5-*-$label-*v4.json 2>/dev/null | grep -v extraction | head -1)
  if [ -n "$res" ]; then
    [ -f "${res%.json}-extraction.json" ] || (cd $SPIKE && uv run --directory $SPIKE python extraction_eval.py "$res" dataset_blind5/gold.json >> $SPIKE/or_$label.log 2>&1)
    echo "=== $model: already measured"; return
  fi
  echo "=== $model $(date +%T)"
  ok=""
  for pj in '{}' '{"reasoningOff":{"reasoning":{"effort":"minimal"}}}' '{"reasoningOff":{}}'; do
    (cd $SVC && LLM_PROVIDER=openai-compatible LLM_PROFILE=openrouter LLM_PROFILE_JSON="$pj" LLM_BASE_URL=https://openrouter.ai/api/v1 LLM_API_KEY="$KEY" LLM_MODEL=$model npm run -s smoke:llm > $SPIKE/or-smoke-$label.log 2>&1)
    if grep -q '"status": "ok"' $SPIKE/or-smoke-$label.log; then ok="$pj"; break; fi
  done
  [ -z "$ok" ] && { echo "smoke failed"; return; }
  echo "profile json: $ok"
  lsof -ti tcp:8085 | xargs kill 2>/dev/null; sleep 2
  (cd $SVC && PORT=8085 QUEUE_PREFIX=recordare-or LLM_PROVIDER=openai-compatible LLM_PROFILE=openrouter LLM_PROFILE_JSON="$ok" LLM_BASE_URL=https://openrouter.ai/api/v1 LLM_API_KEY="$KEY" LLM_MODEL=$model LLM_LIGHT_MODEL=$model nohup node dist/main.js > $SPIKE/service-8085.log 2>&1 &)
  sleep 7
  (cd $SPIKE && RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' $SVC/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 EVAL_DATASET=dataset_blind5 SERVICE_MODEL=$label RUN_TAG=v4 RECORDARE_URL=http://localhost:8085 \
    uv run --directory $SPIKE python run_eval.py --system service > $SPIKE/or_$label.log 2>&1
   f=$(ls -t results/service-dataset_blind5-*-$label-*v4.json 2>/dev/null | grep -v extraction | head -1)
   [ -n "$f" ] && uv run --directory $SPIKE python extraction_eval.py "$f" dataset_blind5/gold.json >> $SPIKE/or_$label.log 2>&1)
  grep '"accuracy"' $SPIKE/or_$label.log | head -1
  echo "failed extractions: $(grep -c 'extraction failed' $SPIKE/service-8085.log)"
  curl -s https://openrouter.ai/api/v1/key -H "Authorization: Bearer $KEY" | python3 -c "import json,sys;d=json.load(sys.stdin)['data'];print('openrouter usage so far:',round(d['usage'],3))"
  lsof -ti tcp:8085 | xargs kill 2>/dev/null
}
if [ $# -gt 0 ]; then  # models given as "provider/model:label" arguments
  for m in "$@"; do run_model "${m%%:*}" "${m##*:}"; done
else
  run_model qwen/qwen3.7-flash qwen3.7-flash
  run_model google/gemini-2.5-flash-lite gemini-2.5-flash-lite
  run_model mistralai/mistral-small-2603 mistral-small-2603
  run_model openai/gpt-5.4-nano gpt-5.4-nano
  run_model google/gemini-3.1-flash-lite gemini-3.1-flash-lite
  run_model anthropic/claude-haiku-4.5 claude-haiku-4.5
fi
echo OR-DONE

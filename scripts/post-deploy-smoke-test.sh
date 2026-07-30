#!/usr/bin/env bash
# Post-deploy smoke tests. Run immediately after atomic-deploy.sh's symlink swap.
# On any critical failure: swap the `current` symlink back and do NOT touch the database.
set -uo pipefail

BASE_URL="${BASE_URL:-https://nuzum.fun}"
FAIL=0

check() {
  local desc="$1" url="$2" expect="$3"
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' "$url")"
  if [ "$code" = "$expect" ]; then
    echo "PASS  $desc ($code)"
  else
    echo "FAIL  $desc (got $code, expected $expect)"
    FAIL=1
  fi
}

check "health"               "$BASE_URL/api/health"      200
check "login page"           "$BASE_URL/login"           200
check "home page"            "$BASE_URL/"                200
check "protected api (401)"  "$BASE_URL/api/courier/pdf" 401

# CSS/JS actually referenced by the served HTML must resolve, not just exist in dist/
ASSET_PATHS="$(curl -sS "$BASE_URL/login" | grep -oE '(src|href)="/assets/[^"]*"' | sed -E 's/^(src|href)="//;s/"$//' | sort -u)"
if [ -z "$ASSET_PATHS" ]; then
  echo "FAIL  no /assets/* references found in served HTML — design/CSS likely missing"
  FAIL=1
else
  while IFS= read -r path; do
    check "asset $path" "$BASE_URL$path" 200
  done <<< "$ASSET_PATHS"
fi

# CSP must still carry the Drive preview fix
CSP="$(curl -sS -D - -o /dev/null "$BASE_URL/login" | grep -i content-security-policy)"
if echo "$CSP" | grep -q "frame-src.*drive.google.com"; then
  echo "PASS  CSP frame-src includes drive.google.com"
else
  echo "FAIL  CSP frame-src missing drive.google.com — Drive preview regression"
  FAIL=1
fi

# PM2 process must be online, not crash-looping
PM2_STATUS="$(pm2 jlist 2>/dev/null | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);const p=j.find(x=>x.name==='nulip-inventory');console.log(p?p.pm2_env.status:'not-found')}catch(e){console.log('parse-error')}})")"
if [ "$PM2_STATUS" = "online" ]; then
  echo "PASS  PM2 nulip-inventory status = online"
else
  echo "FAIL  PM2 nulip-inventory status = $PM2_STATUS"
  FAIL=1
fi

if [ "$FAIL" != "0" ]; then
  echo ""
  echo "SMOKE TESTS FAILED — this run's caller should trigger the symlink rollback in atomic-deploy.sh."
  echo "Do NOT restore an older database backup automatically alongside a code rollback."
  exit 1
fi

echo ""
echo "ALL SMOKE TESTS PASSED"

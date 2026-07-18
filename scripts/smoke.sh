#!/bin/sh
# Post-merge smoke test: does the running stack actually serve real data?
# Unit tests + CI prove it compiles; this proves it works. Run after every PR.
#
# Usage: scripts/smoke.sh          (expects backend on 8080, frontend on 3000)
#        API=http://host:8080 WEB=http://host:3000 scripts/smoke.sh
#
# ponytail: curl + grep, no test framework. Add a real harness when this needs
# assertions richer than "200 and not empty".

API="${API:-http://localhost:8080/api/v1}"
WEB="${WEB:-http://localhost:3000}"
failures=0

# Rendered error states that still return HTTP 200. A page that "loads" but
# says "Failed to load sectors" is a failure, so treat these as fatal.
# Keep this list to strings Next.js does NOT inline into every bundle --
# "This page could not be found" ships in the built-in 404 component and so
# matches every healthy page.
ERROR_MARKERS='Failed to load|Application error: a client-side exception|Internal Server Error'

# Each check: a URL, and a string that must appear in the body.
# The needle is what makes this a smoke test rather than a liveness ping --
# a 200 with an error page or an empty array is still a broken deploy.
check() {
  url="$1"; needle="$2"
  body=$(curl -s --max-time 30 -w '\n%{http_code}' "$url") || {
    printf '  FAIL %-40s (curl failed)\n' "$url"; failures=$((failures + 1)); return
  }
  code=$(printf '%s' "$body" | tail -n 1)
  if [ "$code" != "200" ]; then
    printf '  FAIL %-40s (HTTP %s)\n' "$url" "$code"; failures=$((failures + 1)); return
  fi
  if ! printf '%s' "$body" | grep -q "$needle"; then
    printf '  FAIL %-40s (200 but no "%s")\n' "$url" "$needle"; failures=$((failures + 1)); return
  fi
  if printf '%s' "$body" | grep -qE "$ERROR_MARKERS"; then
    printf '  FAIL %-40s (200 but rendered an error state)\n' "$url"; failures=$((failures + 1)); return
  fi
  printf '  ok   %-40s\n' "$url"
}

echo "Backend ($API)"
check "$API/categories"      '"categories":\['
check "$API/themes"          '"id":'
check "$API/macro"           '"regime"'
check "$API/alerts"          '"alerts":\['
check "$API/portfolio"       '"allocations":\['
check "$API/signals/history" '\['
check "$API/rotation"        '{'
check "$API/rrg"             '{'
check "$API/sub-sectors"     '\['

# These pages server-render their data, so the needle proves the backend
# payload actually reached the HTML.
echo "Frontend, data rendered ($WEB)"
check "$WEB/"        'Information Technology'
check "$WEB/themes"  'AI Infrastructure'
check "$WEB/brief"   'AI Infrastructure'
check "$WEB/macro"   'Breakeven Inflation'
check "$WEB/sectors" 'Communication Services'
check "$WEB/flows"   'Communication Services'

# These fetch client-side, so the SSR HTML carries no data -- curl can only
# prove the shell renders without crashing. Their data is covered by the
# backend checks above. Promote them if they ever move to server rendering.
echo "Frontend, shell only ($WEB)"
check "$WEB/portfolio" '<main'
check "$WEB/backtest"  '<main'
check "$WEB/alerts"    '<main'

if [ "$failures" -gt 0 ]; then
  echo "SMOKE FAILED: $failures check(s)"
  exit 1
fi
echo "SMOKE PASSED"

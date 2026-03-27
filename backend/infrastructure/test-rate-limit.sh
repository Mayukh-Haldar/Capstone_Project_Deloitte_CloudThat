#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./backend/infrastructure/test-rate-limit.sh [BASE_URL]
#
# Example:
#   ./backend/infrastructure/test-rate-limit.sh http://192-168-231-128.sslip.io

BASE_URL="${1:-http://192-168-231-128.sslip.io}"

AUTH_PATH="${AUTH_PATH:-/api/v1/auth/me}"
API_PATH="${API_PATH:-/api/v1/events?page=0&size=12}"

AUTH_TOTAL="${AUTH_TOTAL:-500}"
AUTH_CONC="${AUTH_CONC:-80}"

API_TOTAL="${API_TOTAL:-1200}"
API_CONC="${API_CONC:-120}"

run_load_test() {
  local url="$1"
  local total="$2"
  local concurrency="$3"

  python3 - "$url" "$total" "$concurrency" <<'PY'
import collections
import concurrent.futures
import sys
import time
import urllib.error
import urllib.request

url = sys.argv[1]
total = int(sys.argv[2])
concurrency = int(sys.argv[3])

def hit(_):
    req = urllib.request.Request(url, headers={"Cache-Control": "no-cache"})
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:
        return 0

started = time.time()
counter = collections.Counter()

with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as pool:
    for status in pool.map(hit, range(total)):
        counter[status] += 1

elapsed = time.time() - started

print(f"TOTAL={total}")
print(f"ELAPSED_SEC={elapsed:.2f}")
for code in sorted(counter.keys()):
    print(f"CODE_{code}={counter[code]}")
PY
}

extract_code_count() {
  local report="$1"
  local code="$2"
  local value
  value="$(printf '%s\n' "$report" | awk -F= -v key="CODE_${code}" '$1==key {print $2}')"
  if [[ -z "$value" ]]; then
    echo 0
  else
    echo "$value"
  fi
}

echo "Rate-limit test target: $BASE_URL"
echo

echo "1) Testing AUTH limit on $AUTH_PATH"
AUTH_REPORT="$(run_load_test "${BASE_URL}${AUTH_PATH}" "$AUTH_TOTAL" "$AUTH_CONC")"
printf '%s\n' "$AUTH_REPORT"
AUTH_429="$(extract_code_count "$AUTH_REPORT" 429)"
echo

echo "2) Testing API limit on $API_PATH"
API_REPORT="$(run_load_test "${BASE_URL}${API_PATH}" "$API_TOTAL" "$API_CONC")"
printf '%s\n' "$API_REPORT"
API_429="$(extract_code_count "$API_REPORT" 429)"
echo

echo "Summary"
echo "AUTH_429=$AUTH_429"
echo "API_429=$API_429"

if (( AUTH_429 > 0 )) && (( API_429 > 0 )); then
  echo "PASS: Rate limiting is active on both AUTH and API routes."
  exit 0
fi

if (( AUTH_429 == 0 )) && (( API_429 == 0 )); then
  echo "FAIL: No 429 responses observed. Either limits are too high for this load or rate limiting is not active."
  exit 1
fi

if (( AUTH_429 == 0 )); then
  echo "FAIL: No 429 responses observed on AUTH route."
  exit 1
fi

echo "FAIL: No 429 responses observed on API route."
exit 1

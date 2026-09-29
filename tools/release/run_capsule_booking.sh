#!/usr/bin/env bash
set -euo pipefail
RESULTS_DIR="${RESULTS_DIR:-/results}"
command -v initdb >/dev/null || { echo "Use the supplied PostgreSQL 16 capsule environment" >&2; exit 2; }
[[ "$(postgres --version)" == *" 16."* ]] || { echo "PostgreSQL 16 required" >&2; exit 2; }
# A new cluster per run; no production connection strings or existing databases.
CLUSTER_ROOT="$(mktemp -d /tmp/medora-capsule-pg.XXXXXXXX)"
PG_RUN=()
if [[ "$(id -u)" == 0 ]]; then
    chown postgres:postgres "$CLUSTER_ROOT"
    PG_RUN=(runuser -u postgres --)
fi
cleanup() { "${PG_RUN[@]}" pg_ctl -D "$CLUSTER_ROOT/db" -m fast stop >/dev/null 2>&1 || true; }
trap cleanup EXIT
"${PG_RUN[@]}" initdb -D "$CLUSTER_ROOT/db" --auth-local=trust --auth-host=trust > "$RESULTS_DIR/postgres-init.log"
"${PG_RUN[@]}" pg_ctl -D "$CLUSTER_ROOT/db" -l "$CLUSTER_ROOT/server.log" \
    -o "-h 127.0.0.1 -p 55432 -k $CLUSTER_ROOT" -w start
"${PG_RUN[@]}" createuser -h 127.0.0.1 -p 55432 medora_capsule
"${PG_RUN[@]}" createdb -h 127.0.0.1 -p 55432 -O medora_capsule medora_capsule_benchmark
export MEDORA_CAPSULE_POSTGRES_URL=postgresql+asyncpg://medora_capsule@127.0.0.1:55432/medora_capsule_benchmark
export MEDORA_BOOKING_REPORT="$RESULTS_DIR/current_booking_results.json"
python -m pytest -c tests/pytest.backend.ini -q \
    tests/performance/test_booking_contention_release.py \
    -p no:cacheprovider \
    --junitxml "$RESULTS_DIR/booking-tests.xml"
# Skipped tests are not a successful reproduction.
python - "$RESULTS_DIR/booking-tests.xml" "$MEDORA_BOOKING_REPORT" <<'PY'
import json, sys, xml.etree.ElementTree as ET
root = ET.parse(sys.argv[1]).getroot()
cases = list(root.iter('testcase'))
assert len(cases) == 1 and not list(root.iter('skipped')), 'booking execution was skipped'
report = json.load(open(sys.argv[2]))
assert report['passed'] and all(r['passed_repetitions'] == 30 for r in report['results'])
PY

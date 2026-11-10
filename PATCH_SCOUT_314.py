#!/usr/bin/env python3
"""v3.14 postgame tracking hotfix: idempotent version and legacy missing-day status.
Do not backfill November 9 picks: the actual pre-tip Top 10 was not frozen.
"""
from pathlib import Path
import json
from datetime import datetime, timezone
root = Path(__file__).resolve().parent

def patch_one(path, old, new):
    file = root / path
    if not file.is_file():
        raise RuntimeError(f'Missing expected NBA Scout source: {path}')
    source = file.read_text(encoding='utf8')
    if new in source:
        return
    if source.count(old) != 1:
        raise RuntimeError(f'Expected one v3.13 version marker in {path}, found {source.count(old)}')
    file.write_text(source.replace(old, new, 1), encoding='utf8')

patch_one('server.mjs', "version:'3.13.0',dataQuality:checkDataQuality(", "version:'3.14.0',dataQuality:checkDataQuality(")
patch_one('test/decision-v25-wiring.test.mjs', r"/version:'3\.13\.0'/", r"/version:'3\.14\.0'/")
patch_one('test/decision-v25-wiring.test.mjs', "version,'3.13.0'", "version,'3.14.0'")
patch_one('public/review/review.js', "selected=data.days.find(d=>d.status==='audited')?.date||data.days[0]?.date;", "selected=data.days[0]?.date;")

history_path = root / 'public/review/history.json'
history = json.loads(history_path.read_text(encoding='utf8'))
if not any(day.get('date') == '2026-11-09' for day in history.get('days',[])):
    history['days'].append({
        'date': '2026-11-09',
        'status': 'not_frozen',
        'scoringVersion': 'RFPP 2.7 — freeze not available',
        'message': 'November 9 was NOT captured before tipoff: at 08:40 Central the live API returned HTTP 503. A later board had 235 standard lines but 0 ranked directions once the games were final. No exact original Top 10 exists to grade; a retrospective board must not be reported as pregame performance.',
        'source': {'site':'https://nba-shotzone-scout.onrender.com/', 'provider':'NBA Scout tracking check', 'observedAt':'2026-11-09 08:40 America/Chicago', 'providerSidesVerified':False},
        'snapshot': None, 'audit': None
    })
    history['days'].sort(key=lambda d:d['date'],reverse=True)
    history['updatedAt'] = datetime.now(timezone.utc).isoformat()
    history_path.write_text(json.dumps(history,indent=2,ensure_ascii=False)+'\n',encoding='utf8')
    print('Review: November 9 missing snapshot correctly recorded (no invented picks).')
else:
    print('Review: November 9 already present; preserving historical record.')
print('NBA Scout v3.14 tracking hotfix installed.')

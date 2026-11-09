# NBA Scout v3.8 — Safe Zone Matchup Upgrade

This is a minimal, install-safe update for an NBA Scout site already running v3.6.

## Why v3.7 failed
GitHub Auto-Update #25 failed before tests: `PATCH_SCOUT_31.py` was re-run against the already updated v3.6 `public/clean.js`, whose old text anchors no longer exist. This was an outdated, non-idempotent installer prerequisite, not a matchup-model test failure.

## Fix
- npm `pretest` runs **only** `PATCH_SCOUT_MATCHUPS_37.py`. Prior RFPP 2.7, review, and Defense Zones upgrades are already present in the installed repository.
- The matchup patch is repeat-safe and checks each anchor against the installed source, including the v3.6 main page and backend.
- Does not include/alter `.github/workflows` (GitHub App cannot write protected workflow files).
- Does not overwrite existing `public/review/history.json` or existing grade, chart, or user data.
- Includes the new server-side game-zone opportunity model, browser UI, sample-aware separate grade helper and CSS.

## Installation
Upload the ZIP itself to the **root** of `Cosentinoc1/nba-shortzone-scout` on GitHub. Auto-Update selects the newest release, extracts it, patches `server.mjs`, `public/index.html`, `public/defense-zones.mjs`, and runs the full repository test suite. Render auto-deploys the resulting source commit.

## Verify
- GitHub Actions Auto-Update must show **success** (not merely completed).
- `https://nba-shotzone-scout.onrender.com/api/zone-opportunities?date=2026-11-09` should return a dated game list with ranked players after Render deploys and the ESPN historical cache is warm.
- Defense Zones tab shows two independent metrics: Volume Allowed grade and FG% Allowed grade, with team-by-team player rankings for each scheduled game.

## Safety and limits
Player rankings use only games **before** the selected date, sample-aware shot-location estimates, recent FGA and minutes. Rankings are descriptive and do not verify game-day injuries, rotation, independent minutes, PrizePicks lines, or payout value. Scores are not P(win). The independent scheduled daily review workflow remains a separate setup item.

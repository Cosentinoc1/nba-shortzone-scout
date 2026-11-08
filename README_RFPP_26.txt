NBA Scout RFPP 2.6 — Minutes and LESS Tail Guard Upgrade

This release responds to the frozen November 7 Top 10 audit: MORE 5/10, LESS 5/10.
That slate is a diagnostic sample, NOT a valid predictive calibration sample.

Main changes
* MORE with fewer than 23 projected minutes is HOLD even when the raw projection gap looks good.
* MORE with 23–25 projected minutes is HOLD for combo lines or if model and historical support are not unusually strong.
* LESS examines 75th-percentile recent output and actual resolved recent under clearance, rather than relying on the median alone. Repeated recent upside moves borderline LESS picks to HOLD.
* Missing independent RotoWire projection caps research score at 57; stale line at 55; unconfirmed role or unchecked injury at 62; blockers at 54; hard veto at 20.
* Every rule supplies a readable reason in the existing prop card and full detailed report, with a documented tail signal for LESS.
* No speculative weight fitting: unchanged hypothesis weights (projection 30%, history 26%, opportunity 18%, minutes 12%, defense 10%, context 4%). Scores are NOT hit probabilities.
* Do not force ten bets: the existing Top 10 UI only displays STRONG and LEAN candidates, and HOLD/VETO remain inspectable on the Grade Board.

Tests
node --test test/decision-v25.test.mjs
npm test

How to deploy with the existing workflow
1. Upload NBA_Scout_RELEASE_v3.0.zip AS A SINGLE FILE to the root of https://github.com/Cosentinoc1/nba-shortzone-scout on main, using Add file > Upload files > Commit changes.
2. Existing NBA Scout Auto-Update extracts it and runs PATCH_SCOUT_25.py (same entrypoint as v2.9), then test/commit/redeploy. Don't manually extract or replace individual app files.
3. Verify https://nba-shotzone-scout.onrender.com/api/status contains version 2.6.0 after deployment.

If the current checkout differs from v2.5 sources, PATCH_SCOUT_25.py halts rather than silently rewriting unrecognized versions. No automatic bets or access to private sportsbook accounts.

Important: Success is not defined as 100% of picks. This is a cautious research gate; test with frozen pregame boards and official outcomes over many days before claiming improvement.

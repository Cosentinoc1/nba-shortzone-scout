# NBA Scout v3.15 — install fix + actual last 10/20 game histories

## Why the previous upload failed (verified from GitHub Actions logs)
GitHub Actions run 42760753834 completed ALL 211 unit tests, but the final git push was rejected:
`refusing to allow a GitHub App to create or update workflow .github/workflows/nba-scout-daily-review.yml without workflows permission`.
The website **did not update**. This package deliberately does NOT place anything in `.github/workflows/`.

## STEP 1 — one ZIP upload (website, history, and review code)
1. Upload **NBA_Scout_RELEASE_v3.15.zip** unextracted to the ROOT of the **main** branch in https://github.com/Cosentinoc1/nba-shortzone-scout using **Add file → Upload files**, then commit.
2. The existing **NBA Scout Auto-Update** Action extracts the highest-version release ZIP, runs `npm test`, commits the tested code, and Render redeploys.
3. Verify **Actions → NBA Scout Auto-Update → success**, then `https://nba-shotzone-scout.onrender.com/api/status` should report version `3.15.0`. If not, do NOT claim deployment success; check the run logs.

## STEP 2 — one-time manual GitHub schedule upload (needed for automatic DAILY reviews)
1. In the GitHub repository, open `.github` → `workflows`.
2. **Add file → Upload files** and upload the separately supplied `nba-scout-daily-review.yml` to THIS directory using YOUR GitHub website session. Commit to `main`.
3. You should now see **NBA Scout Daily Results** on GitHub Actions; select it and try **Run workflow → mode: capture** before tipoff. It will run automatically on its UTC cron schedule thereafter. The workflow records `not_frozen` when the feed is down/late, and never fabricates historic picks.
4. GitHub scheduled tasks can be delayed. A successful manual install does not guarantee every source will be accessible.

`workflow_manual/nba-scout-daily-review.yml` is also inside the ZIP as a backup/reference but intentionally NOT active until installed manually. Do not put the file in the project root and expect a schedule.

## What the updated site changes
- Clicking a player prop now requests completed ESPN game summaries on demand for that player's team, even if Render's whole-league background cache hasn't finished loading.
- Failed ESPN shot-coordinate checks fall back to labeled official box score history; fallback games do **not** contaminate shot-zone analyses.
- The player modal and the manual Player Research section show real individual results, with **Last 10** / **Last 20** selectors, average and true hits over the available sample. DNP and current/future-game results are excluded.
- Existing model scoring remains based on its original Last 10 field; Last 20 is **descriptive** until independently validated in a future backtest.
- The v3.14 review/freeze fixes are carried over, but no November 9 Top 10 is invented because the original pre-tip archive was unavailable.
- Only games actually available in the current season are shown (e.g. 11 played games shows 11 for Last 20, not twenty fabricated rows).

## Tests
`npm test` runs the full existing suite and new tests; the package's patch scripts are designed to stop without a source-changing commit if an expected code anchor is missing.

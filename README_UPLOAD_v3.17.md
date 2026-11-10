# NBA Scout v3.17 — corrected installer for Top 2 / Top 5

## What failed in v3.16

GitHub Actions `NBA Scout Auto-Update` run #33 (November 10, 2026) failed in **Extract and test latest release** before the test suite ran. The release's `npm pretest` ran `PATCH_SCOUT_314.py` first; that script expected `server.mjs` still to contain the v3.13 marker. However v3.15 had already been installed, so it threw `RuntimeError: Expected one v3.13 version marker in server.mjs, found 0`.

The user uploaded the ZIP correctly. The failure was installer-chain logic in the release ZIP.

## What changes in v3.17

- `package.json` runs **only** `python3 PATCH_SCOUT_317.py` before tests. It does not rerun the already completed v3.14 or v3.15 migrations.
- `PATCH_SCOUT_317.py` starts from the actual **v3.15** repository state, is safe to rerun, and updates the app version to **3.17.0**.
- Retains the v3.16 feature work: clear Top 2 / Top 5 daily research cards, exact standard MORE/LESS lines, playstyle and usage proxies, opponent-by-position defense, historic box scores and last 10/20, news/injury flags, projected minutes when uploaded, caution on correlation and market-price data, and a separate frozen Top 2/5 audit.
- Keeps the existing GitHub Daily Results workflow untouched. No new workflow permissions are needed.
- Adds a regression test to stop the old pretest chain from returning.

## Upload steps

1. Open https://github.com/Cosentinoc1/nba-shortzone-scout.
2. Choose **Add file → Upload files** on the repository `main` branch.
3. Upload **NBA_Scout_RELEASE_v3.17.zip** to the **repository root as a ZIP; do not extract it**. Commit.
4. GitHub Actions → **NBA Scout Auto-Update** → confirm the new run turns green. It finds the highest version ZIP via `sort -V`, so the older v3.16 ZIP can remain; it will select v3.17.
5. Open https://nba-shotzone-scout.onrender.com/api/status and verify `"version": "3.17.0"` after Render deployment. Open the main homepage and look above Top 10 for **Best 2 or Best 5 today**.

## Validation and current limits

The supplied incremental patch was tested in an isolated fixture representing the v3.15 source locations. Repeated `npm test` runs and 20 fixture/feature tests passed. The full GitHub repository test suite will run in Actions after your upload; a successful fixture test is not a claim that the production deployment has already succeeded.

No sports prop is a guaranteed lock. Source coverage is displayed honestly, and missing sportsbook market prices, complete game-day rotations, independent projections, or private tracking cannot be labelled verified. The website never forces 2 or 5 picks when evidence is inadequate.

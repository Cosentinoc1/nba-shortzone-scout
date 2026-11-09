# NBA Scout v3.13 — GitHub Actions run #29 regression-test fix

## Verified cause
GitHub Actions run [#29](https://github.com/Cosentinoc1/nba-shortzone-scout/actions/runs/42607055678)
reported **209 tests, 208 passed, 1 failed**. Installer scripts PATCH_SCOUT_311.py and
PATCH_SCOUT_312.py both completed. The remaining error was from
`test/decision-v25-wiring.test.mjs`, which still required `server.mjs` and
`package.json` to report version `2.7.1`, despite correctly updated v3.12 code.

## What is changed
This is a **cumulative single upload** of v3.11 + v3.12 features, with
PATCH_SCOUT_313.py to bring both stale test assertions and the server's
version up to `3.13.0`. Older installers now safely skip already-installed
v3.13 code if npm test is run again. No grading logic was removed.

## Upload
1. Upload **NBA_Scout_RELEASE_v3.13.zip only** to the GitHub repository root.
2. Use **Add file -> Upload files**, leave the ZIP intact, commit it.
3. The existing NBA Scout Auto-Update action sorts release files by version,
   selects v3.13, extracts, runs `npm test`, then commits tested source.
4. Verify the *new* Actions run is green and `/api/status` contains `3.13.0`.
   The live Render site cannot be certified until the new run/deployment completes.

Nothing under `.github/workflows/` is included in this ZIP.

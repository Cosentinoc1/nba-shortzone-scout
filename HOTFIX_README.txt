NBA SCOUT RFPP 2.6 — TEST-RECONCILIATION RELEASE

The previous Auto-Update #15 extracted and applied RFPP 2.2 correctly.
It passed 86/87 tests. The only failed test was an old synthetic
RotoWire scenario that did NOT provide historical games, yet expected
promotion into a Top 10 despite RFPP 2.2's required sample gate.

This update preserves the stricter production rule:
- Missing/insufficient historical sample -> NOT promoted by RotoWire alone.
- 10 real historical boxscores + current confirming RotoWire forecast ->
  can qualify for the matching MORE direction (still provisional).
- Opposite LESS direction, 0 minutes, model/history disagreement, team
  mismatch and invalid projection rows remain rejected.

The existing test/rotowire.test.mjs is replaced with fixtures for these
scenarios; the rest of the application/scoring code is unchanged from v2.5.
The archive contains NO .github/workflows paths, so no workflow
permission change is requested. Existing NBA Scout Auto-Update handles it.

The same code is independently tested in a Node local harness. The *entire*
GitHub repository test suite cannot be executed in the offline sandbox;
GitHub Auto-Update is configured to run all tests before committing.
Expected API status after successful deploy: version 2.2.0.

INSTALL: Upload NBA_Scout_RELEASE_v2.6.zip to the GitHub repo root on main.
One new Auto-Update run should start from the upload commit. No manual
re-running older workflows is necessary.

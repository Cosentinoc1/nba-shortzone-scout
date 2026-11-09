# NBA Scout v3.11 — Injury/News Opportunity, Defensive Zone Rank, Opponent 3PA

**Install on existing NBA Scout v3.10 only.** Upload the unextracted `NBA_Scout_RELEASE_v3.11.zip` to the root of the existing `Cosentinoc1/nba-shortzone-scout` GitHub repository. The existing Auto-Update workflow selects the highest version, extracts the ZIP, executes `npm test` (which first runs only `PATCH_SCOUT_311.py`), and commits/deploys if checks pass. Do not manually re-run older installers.

## What changes
- Top 10 is no longer just a broad RFPP score plus zone notes. The game-day zone mismatch **changes the ranking score and can downgrade Priority to Watch**, especially when the player's shooting area overlaps a defense that restricts both attempt share and accuracy. Missing or thin samples do not get credit for an edge. This is an ordinal research score, **not a win probability**.
- Same-day ESPN injury-status `OUT` on the player is a hard veto; stale or questionable status triggers HOLD, not an invented game-day OUT or healthy designation.
- A verified same-day OUT teammate in an overlapping role or a high-volume scorer produces an explanatory flag. The ranking receives a major opportunity adjustment **only with a matching independent RotoWire projected minutes increase of 3+ versus recent actual minutes**. When projected role or minutes is missing, this is a possible opening and gives no automatic bonus. Confirmed starter gives a stronger positive signal than projected starter. This does not quantify real usage/on/off changes.
- Current ESPN NBA news headlines (when available) are attached with source and report date as **green/red/amber flags**, rather than guessed probabilities or automatically scored external rumors.
- Defense Zones displays each of six zones' **NBA shot-share allowed rank** and **FG% allowed rank** (#1 = most allowed) across 30 teams. A team below 50 defensive zone attempts is not assigned a reliable FG% rank, and fewer than 60 attempts cannot drive a player-level zone scoring bonus.
- Defense Zones displays the **current scheduled opponent's top six three-point-attempt shooters**, including 3PA per observed appearance, above-break 3PA/game and combined corner 3PA/game. ESPN reconstructed shot locations are observational; these are not predicted attempts or confirmed active starters.
- Mobile layout forces single-column defensive-zone cards and legible two-column stacked stats instead of clipped horizontally split panels. Top 10 scan surfaces a short green/red or zone note.

## Verify after auto-update
1. GitHub Actions > Auto-Update latest run: **success**. If failed, read the exact patch anchor error. The patch is fail-closed and idempotent.
2. `https://nba-shotzone-scout.onrender.com/api/status` has `version: "3.11.0"` after Render deploy; app should answer normally.
3. Defense Zones tab: select any team. Six zone rows show two NBA rank fields. Select an outside zone; the table below lists current scheduled opposing three-point shooters, or clearly says the game/sample cannot be determined.
4. Top 10: research candidate card has DEFENSIVE ZONE — RANKING GATE; when current source data exists, an INJURY & NEWS SIGNALS row. Stale injury and absent projections never appear as confirmed opportunities.
5. Upload the correct-date RotoWire forecasts again (Today versus Tomorrow as appropriate). Exact team/player/opponent matching is still necessary; v3.10 diagnostics remain.

## Important limitations
- ESPN injury endpoint and news availability can be incomplete or late; RotoWire is **only used if your existing importer matched that day's uploaded projections**. This update does not scrape subscribers' private data or promise live news if feed unavailable.
- Player-availability veto and opportunity flags depend on published report timestamps. A previous-day OUT is not automatic proof of the next game's status.
- The existing top-10 historical-score formula remains as a base; this patch adds a distinct injury/zone **overlay and tier gates** instead of pretending the weights have been calibrated to profit.
- This release does **not** determine sportsbook payout, expected value, probability of winning, or a guaranteed winning prop.
- The existing performance review, grade sorting, RotoWire matching diagnostics, and other user data/files are preserved.

# NBA Scout RFPP 2.7 + Performance Review — ONE-STEP GitHub upload

**Your site's current source (November 8):** RFPP 2.6. This patch produces RFPP 2.7 rankings and adds the persistent Performance Review page. The final strict RFPP 2.6 vetting engine is preserved and remains a separate decision about any real wager.

## Installation — exactly as with your other NBA Scout uploads

1. Download `NBA_Scout_RELEASE_v3.2.zip` from this conversation. **Do not extract it.**
2. Open https://github.com/Cosentinoc1/nba-shortzone-scout and choose **Add file → Upload files**.
3. Upload the entire ZIP to the **root of the `main` branch** (not into a folder). Commit.
4. The existing `NBA Scout Auto-Update` GitHub Action automatically finds the latest `NBA_Scout_RELEASE_v*.zip`, extracts it and invokes the patch script via `npm test`, commits tested source, and triggers Render auto-deploy. It may require Actions write permissions.
5. Check `/api/status` for `version: 2.7.0`; open `/review.html` and check the Top 10 on the homepage.
6. If GitHub Actions reports a failure, **do not** manually replace unrelated files. Inspect the failed step or share the log. The source patcher stops on mismatches rather than modifying unrecognized code.

The ZIP is **one release** combining two improvements: scoring and the Results Lab. Do **not** upload the old Performance Review v3.1 patch separately.

## Revised grading: more research choices, same final safeguards

The Top 10 and Grade Board now use a six-signal directional **research score** (not an estimated probability of winning):

| Signal | Research weight | What it measures |
|---|---:|---|
| Historical median vs line, scaled by volatility | 24% | How far the recent typical game is above/below the exact line |
| Recent true clearances, small-sample adjusted | 14% | Actual wins/pushes/losses over recent games; pushes excluded from win denominator |
| Opportunity trend (non-overlapping L5 vs previous L5) | 18% | FGA/3PA/FTA volume; REB/AST/combos are clearly marked **production proxies**, not tracking chances |
| Recent minutes stability / independent minute forecast | 17% | Minutes floor, variance, and mismatch risks |
| Opponent defense vs relevant position/stat | 15% | Opposing position matchup, reduced weight for a position estimate; conflicting range neutral |
| Independent RotoWire projection when available | 12% | Directional forecast vs line, **neutral** when absent, not a guessed forecast |

Additional tail risk checks: L10 lower-quartile for MORE / upper-quartile for LESS; known back-to-back, double-digit spread/blowout, model/history contradictions, multi-stat component disagreement, unusually low minutes and uncertain injury status. Each ranked candidate shows reasons and risks.

### Priority / Lean / Watch versus betting

- **PRIORITY RESEARCH** = strong historical / opportunity alignment and reasonably stable minutes. May exist *without* an independent model, but clearly labeled "verify." Not bet-ready.
- **RESEARCH LEAN** = at least two supporting directional signals and solid historical minutes, still requires review.
- **WATCHLIST** = a provisional case worth checking, not an approved pick.
- **PASS** = missing/stale exact line, out/questionable player, too little history, very low/unstable minutes, or strong contradictory evidence. These do not appear as approved ranked candidates.

The older strict final-veto recommendation is **still visible on cards** and still requires independently verified minutes, lineup, injury, line, payout and positive expected value before calling anything bet-ready. Missing RotoWire no longer arbitrarily caps the *research* rank at 57. It **does** block final bet-readiness.

**Important:** The site can still show fewer than 10 picks if the independent line feed has no offers **for the chosen game day** or the data truly fails the minimum threshold. On November 8, the live site had 191 lines observed for upcoming events but none matching the already completed November 8 slate. Relaxing grades must not attach those future lines to earlier games.

## Self-updating Performance Review

GitHub Actions checks pre-tip rankings several times a day, freezes each day's first eligible board with exact observed lines/grades, then checks final ESPN box scores the next morning. It records MORE, LESS and Bottom 10 as an explicitly **unfavorable MORE countercheck**, not as a third set of recommended bets. Pushes, DNPs, missing players and incomplete games are excluded from win/loss rates. Daily reports display result tables, directional hit rates, tier breakdowns and minutes signals. The frozen board is immutable; days with no qualified candidates are labeled as such and never graded 0%.

- **Historical seed:** Nov 7 legacy v1.9 had 5/10 MORE and 5/10 LESS; source timestamp was not independently proven before the first tip, so results are labeled *legacy/provisional*. Nov 8 no qualified frozen Top 10.
- GitHub schedule: captures at 16:00/20:00/23:00 UTC and grades previous Chicago date at 13:00 UTC, subject to GitHub scheduled workflow execution. It doesn't promise guaranteed unattended runs.
- **RotoWire currently stays local to your browser.** The scheduled worker cannot see browser-only data unless you provide a legitimate server-side integration. Its frozen watchlist can therefore differ from what you see after importing RotoWire locally; both must label coverage.
- Auto-audit updates `public/review/history.json` and commits it to the repository so Render restarts do not wipe historical results. Later release ZIPs should not bundle a stale copy of that history file.

No automated bets or login scraping. The system does not guarantee returns, estimate calibrated win probabilities, or backfill pregame picks after results are known.

## Validation

The included tests cover score weights, no-model research ranking, hard injury veto, stale lines, opposing projected minutes/stat direction, defensive proxies, tail checks, exact game matching, DNP, push and final box-score arithmetic.

On the repository: `npm test`. To run only new tests: `node --test test/research-rank-v27.test.mjs test/review.test.mjs`.

## v3.3 deployment hotfix

Fixes GitHub Actions installer failure: the legacy `public/classic.html` uses `<nav class="quick-nav">` rather than the primary dashboard `<main>` / `.segmented` structure. The navigation injection now supports both layouts. Upload **NBA_Scout_RELEASE_v3.3.zip** to GitHub repository root; Actions always selects the latest ZIP by version. No separate v3.2 installation is needed.


## v3.4 GitHub CI repair
The v3.3 source patch installed during test but two tests failed: one expected 2.7.0 while the included app version is 2.7.1; the other mocked a 12-game player with no historical baseline, which correctly caused the existing v2 safety veto. Both fixtures are fixed. The underlying role, injury, minutes and line freshness vetoes are preserved.  This release replaces v3.3; upload the v3.4 ZIP to GitHub root.


## v3.5: Defensive Zone Weaknesses
See README_DEFENSE_ZONES_v3.5.md. The new Defense Zones tab uses only pre-existing defensive shot data and does not alter research weights.

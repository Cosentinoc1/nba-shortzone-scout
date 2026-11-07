NBA SCOUT RFPP 2.4 — CLEAR DEFENSIVE MATCHUP GRADES

WHAT WAS WRONG
The detailed source report always displayed the MORE defensive grade, even when
reviewing LESS. For example MORE 15/100 F and LESS 85/100 A showed F in the
big headline for an UNDER. Grade Board and Top 10 could appear contradictory.

WHAT'S FIXED
1. The displayed A–F matchup grade ALWAYS follows the chosen MORE/LESS side.
2. Every grade includes its directional score and plain-English meaning:
   A/B = favorable; C = mixed; D/F = unfavorable to that SAME side.
3. The Top 10 and Grade Board show position data reliability (single-position
   sourced versus estimated eligible positions) and never claim that fantasy
   eligibility is a confirmed game-day defender assignment.
4. The full source report now uses the SAME side and gives the reason in words.
5. The grade board matchup sort uses the chosen-direction matchup score.
6. The mobile grade board includes a readable, side-aware matchup line.
7. A short, optional guide explains evidence score versus matchup versus final
   injury/minutes/payout checks. Defensive scores are NOT win probabilities.
8. The server explicitly serves the new shared module. Cache versions bump.

NO CHANGES TO
- Core stat/opportunity evidence scoring and Top 10 selection methodology
- Source feeds, projected minutes, sportsbook lines, or injury checks
- RFPP thresholds, sample minimums, or unavailable-state safety gates

INSTALL (same reliable existing GitHub Auto-Update workflow)
Upload NBA_Scout_RELEASE_v2.8.zip unchanged to the ROOT of your existing
GitHub repository (main branch). The NBA Scout Auto-Update workflow picks the
latest ZIP, unpacks it, executes PATCH_SCOUT_UI_24.py automatically in the npm
pretest hook, syntax-checks browser modules, runs the COMPLETE app test suite,
and commits only if tests pass. This package contains NO GitHub workflow files.

After the workflow is GREEN, verify /api/status shows version 2.4.0 and
Render's latest deploy is LIVE. Then hard-refresh the website and open a LESS
prop to confirm that a defense LESS 85/100 shows an A.

Local QA: 11 focused tests passed against the shared scoring-explanation module
and an anchor-based synthetic integration fixture. The 25 code anchors were
cross-checked against the GitHub source for the high-risk change points. Full
application tests still must pass in GitHub against the installed release.

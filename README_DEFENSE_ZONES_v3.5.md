# NBA Scout release v3.5 — Defensive Zone Weaknesses

This is an additive release that includes the RFPP 2.7 research shortlist, the Performance Review, and a new **Defense Zones** tab in the main dashboard. Upload `NBA_Scout_RELEASE_v3.5.zip` as-is to GitHub root; the existing auto-update workflow selects the highest `NBA_Scout_RELEASE_v*.zip`, extracts it, tests, and commits deployed source.

## What you get

- Team selector for all 30 NBA defenses.
- Tap six schematic court zones or the six zone rows.
- Raw classified opponent FGA allowed, FG% allowed, FGA share, league-zone FG% and league-relative percentage-point differences.
- Clear weakness labels based on two observed signals: more attempts relative to total opponent shots, and higher FG% than league average in the same zone. Very small samples are identified rather than graded.
- The three strongest measured weaknesses per selected defense; if none qualifies, the page says so.
- Display of the current backend defense source and data date. ESPN coordinate-derived zones are explicitly marked estimates; the system never portrays them as the NBA's official zone classification.
- Does not change RFPP player prop grades or fabricate hit probabilities.

## Source and methodology

Uses existing `/api/bootstrap`, which includes `defense.teams[*].zones`, league zone averages, and service `status`. No new API or login is required. `FGA allowed` is **cumulative**, not per game. Differing game totals make raw FGA counts non-comparable across teams, so labels depend on **share of all allowed shots** and **FG% allowed relative to the league in that zone**. Classification requires at least 25 zone FGA.

Thresholds: weak spot = FG% at least +2.5 percentage points and shot share at least +1.5 pp; higher FG% alone = +4 pp; high-volume alone = +2.5 pp; tougher zone = both FG% <= -2.5 pp and share <= -1.5 pp. These are descriptive thresholds, not probabilities.

## Installation and tests

`PATCH_SCOUT_31.py` installs RFPP/review changes, then executes `PATCH_SCOUT_ZONES_35.py`. The zone patch adds one navigation tab, one HTML section, one CSS and one JS module, and two explicit static routes. `npm test` includes separate zone tests. The initial main page remains usable even if ESPN refresh fails because `/api/bootstrap` returns the saved defense fallback.

GitHub Actions must finish successfully before the live Render site updates. Verify `/api/status`, the main-page Defense Zones tab, and the new section after the deployment. If the GitHub job fails, inspect the Actions log and do not claim v3.5 was installed.

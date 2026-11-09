# NBA Scout v3.9 — Fast Pick Top 10

## Purpose
Provide a phone-friendly, quick-to-read shortlist. The top panel shows ranked players, exact observed prop lines, side, recent wins and research status. Each player card now contains four source-labeled factors:

1. **Exact-line history:** actual MORE/LESS wins, losses, pushes in the player's last ten games, plus last-five and season context; pushes are not wins.
2. **Defensive zone opportunity:** his historical shot locations aligned to the opponent's pregame shooting-zone frequency and FG%, with the relevant shot attempts. Zone effects are scoped to scoring/shot categories, not inferred rebound chances or potential assists.
3. **Projected minutes and injury openings:** user-provided RotoWire minutes when available, historical actual minutes otherwise, licensed starter status when provided, and **conditional** same-position-group openings when a recent ESPN report lists a teammate OUT. The app explicitly does not assign imaginary bonus minutes or on/off usage shifts.
4. **Playing style and opportunity:** recent FGA/3PA and shot mix, minutes trends, plus warnings when assist/rebound tracking is unavailable.

## What remains gated
This release **does not** automatically approve bets. The research score is not a win probability. Platform payout/price, last-minute line movement, independently confirmed role/injuries, unprovided minutes projections and the final veto still need verification. Game started, unavailable player and stale-line status are immediately visible.

## Installation
Prerequisite: v3.8 already installed in Cosentinoc1/nba-shortzone-scout.
Upload **NBA_Scout_RELEASE_v3.9.zip** directly to GitHub repository root. The existing workflow extracts the highest version, then runs `npm test`; the new `pretest` uses only `PATCH_SCOUT_QUICK_39.py`. It does not run historical patch scripts again, does not create GitHub workflow files, and does not alter Performance Review history.

The installer is repeat-safe; a second run detects already-added code. The update modifies only source files already present, adds one model module, adds one stylesheet, and one focused test suite. Data is derived from previous-day ESPN games, existing current injury context, existing exact lines and optional user-uploaded RotoWire projections.

## Verification after installation
- GitHub Auto-Update latest run must be **success** with all project tests passing.
- The main page should show **60-SECOND PICK REVIEW** above the Top 10.
- Open any card to see **EXACT-LINE HISTORY**, **SHOT-ZONE MATCHUP / SCORING COMPONENT**, **MINUTES & INJURIES**, and **PLAYSTYLE & USAGE**.
- The source API `/api/picks?date=YYYY-MM-DD` should include `quickRead.version = "3.9-fast-pick"` on eligible ranked candidates.
- Both RotoWire upload and CSV import use the same explanation module. Main zone explorer and historical review routes remain unchanged.

## Data guardrails
- Current ESPN injury report is only used for the current local game day; old reports are not reused for past slates.
- Teammate OUT flags a **possible** minutes opportunity only for the same roster position group; it never assumes a start or adds projection minutes.
- An old or unavailable injury report does not get treated as verified healthy status.
- Historical percentages are descriptive clearance records, not calibrated probabilities of future success.
- Shot zones are reconstructed from ESPN coordinates and are estimates; small-sample zone matches cannot substitute for live opportunity data.

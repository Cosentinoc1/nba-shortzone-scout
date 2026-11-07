NBA SCOUT RFPP 2.3 — SOURCED DEFENSIVE MATCHUP COVERAGE

WHY: v2.2 successfully fetches all four NBA House DvP categories, but many
ESPN roster positions are only G/F. Exact PG/SG/SF/PF/C therefore returned
NOT VERIFIED for most non-centers. The top-picks UI also mislabeled exact
DVP as generic G/F/C proxy.

WHAT THIS CHANGES
- Preserve true source-backed exact-position DvP when the actual PG/SG/SF/PF/C
  slot is provided (e.g. licensed lineup or the user's RotoWire export).
- When only broad G/F/C is available, use the NBA.com-published 2026 Yahoo
  fantasy eligible positions for a source-backed position *estimate*.
- Multiple eligible positions are evaluated together: the whole range is
  displayed, no best-position cherry-picking, no assertion of a confirmed slot.
- A sourced position estimate contributes less to the evidence score than a
  real single-position matchup. Pending injury/lineup/odds checks remain.
- Board source report, full player report, and position-oriented MORE/LESS
  grades now agree. A debug count exposes exact/estimated/unavailable coverage.
- Position snapshot covers the top 250 originally listed on Sept 29, 2026;
  data is checked against current team before use and NBA.com refreshed if
  reachable. Unmatched players remain unverified, not guessed.

SOURCES
NBA.com (Dan Titus/Yahoo), Sept 29 2026:
https://www.nba.com/news/nba-fantasy-top-250-points-league-rankings
NBA House season DvP:
https://www.nbahouse.net/defense-vs-position

CURRENT SOURCE QUALITY
These are *fantasy position eligibility* grades and can differ from actual
lineup assignments or defensive switches. They are not measured point-of-attack
matchups and do not indicate a calibrated win probability or betting value.

INSTALL
Upload this ZIP unchanged to your GitHub repository root. Existing
NBA Scout Auto-Update workflow picks the highest-numbered ZIP, unpacks,
runs pretest patch (once), runs the complete suite, and commits only if tests
pass. There are no .github/workflows files in this ZIP.
After green workflow verify /api/status version 2.3.0 and /api/picks
sourceStatus.publishedPositions and sourcedEligibilityEstimates.

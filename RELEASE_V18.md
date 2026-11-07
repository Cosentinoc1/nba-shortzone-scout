# NBA Scout v1.8 — Top 10 + source-aware grade board

## What's new

- Top 10 Overall, Top 10 MORE, Top 10 LESS and 10 toughest defensive matchups, with one player in each shortlist; bottom-ranked defenses are **not** automatically LESS plays.
- Grade Board tab with full screened standard-line pool (both directions), sortable by overall evidence, defensive matchup, opportunity, baseline gap, data confidence, game context or last-10 wins. Filters for stat, side, keyword, and optionally vetoed rows. Click any record for its prop report.
- Per-pick stat-specific defense matchup grade. Ranking and full reports use ESPN prior opponent box scores for broad position groups **G/F/C** with league rank and sample size. Shot-zone grade also contributes for appropriate shooting props. Rankings do **not** claim exact PG/SG/SF/PF/C DvP or player win probabilities.
- Contextual RFPP 2.0 scoring adjusts historical evidence for ESPN injury reports, recent actual minutes, attempts, opponent defense, game odds, rest, back-to-back and blowout risk. OUT/Doubtful injury reports produce a source-attributed veto; questionable flags produce HOLD. Injury statuses may lag today's official report.
- All remaining verification gates show named sources, evidence status, updated date, or a pending explanation. Neither manual checkboxes nor source absence count as verification.
- Existing full player report and All Lines remain available. Grade Board sorts **supported standard** player-prop categories, while All Lines includes the entire observed provider board, including non-standard tiers.

## Allowed lineup sources

RotoWire's current terms restrict automated scraping and third-party AI ingestion without prior written permission. **This release does not scrape RotoWire**, request subscriber data, bypass login, or store RotoWire content. The existing direct link allows independent verification in the user's browser.

If the user obtains an *authorized licensed* lineup JSON endpoint from a provider that explicitly permits redistribution/website use, configure these optional Render environment variables:

- `LICENSED_LINEUPS_URL` — HTTPS URL returning a JSON document with the schema below
- `LICENSED_LINEUPS_API_KEY` — optional bearer token supplied by the licensed provider, retained server-side

```json
{
  "date": "2026-11-07",
  "teams": {
    "DEN": {
      "status": "expected",
      "players": [
        {"name":"Player One","pos":"PG"},
        {"name":"Player Two","pos":"SG"},
        {"name":"Player Three","pos":"SF"},
        {"name":"Player Four","pos":"PF"},
        {"name":"Player Five","pos":"C"}
      ]
    }
  }
}
```

If no authorized source is provided, the starter gate remains pending. A provider labeling a lineup **expected** will not be treated as **confirmed**. Retrieved timestamps are not original injury report publication times.

## Unresolved signals (intentionally not fabricated)

- Independent *projected* player minutes (past actual minutes do not equal a projection)
- Exact PG/SG/SF/PF/C DvP; the default G/F/C grade is an ESPN box-score proxy
- Rebound chances, potential assists, touches, on/off and coverage schemes
- Individual sportsbook player-prop odds/line movement, PrizePicks payout/side availability, calibrated win-probability distribution, correlation/EV
- Final lineup confirmation immediately before tipoff

Only check these using separately authorized sources. The user should not treat any research candidate as an approved wager until hard gates and a second independent veto pass.

## Deploy

Upload this ZIP with the *exact* name `NBA_Scout_RELEASE_v1.8.zip` to the root of the GitHub repository connected to Render. The existing NBA Scout Auto-Update GitHub Actions workflow picks the highest versioned `NBA_Scout_RELEASE_v*.zip`, extracts all source files, runs tests, commits them to `main`, and triggers Render auto-deploy. Keep existing Render `npm install`, `npm start`, and environment configuration unchanged.

The release is self-contained. Check `npm test` and open `/api/status`, `/api/props-feed`, `/api/picks`, and `/api/lines` after live deployment.

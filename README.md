## v1.6 — Faster rankings and provider coverage (2026-11-07)

- Fixes slate-ranking timeout risk with per-team game indexes and cached date parsing.
- Separate Top 6 MORE, Top 6 LESS, and Bottom 6 unfavorable shot-location alignments (not automatic LESS picks).
- New evidence fields: baseline, smoothed hit history (pushes distinct), opportunity trend, matchup alignment, consistency and confidence.
- Hard vetoes for stale/unknown line timestamps, low minutes and inadequate game samples. External role, injury, tracking and payout are never inferred.
- Adds /api/lines and an All Lines browser for all offers *observed by the licensed provider*, including goblin/demon tags when present. Providers cannot guarantee complete PrizePicks coverage.
- Reads up to 10,000 rows of a source response and surfaces pagination/truncation indicators and provider-versus-eligible counts. Automatic extra page requests are NOT made because the free tier is credit-limited.

**This is a research and screening product, not a system for guaranteed bets or calibrated betting probabilities.**

# NBA Shot-Zone Scout — Hosted Web App

A Node.js (20+) web dashboard combining six-zone defensive shot charts, current 30-team roster selections, player shot-location profiles, explanatory grades, and Top 6 / Worst 6 matchup screening.

## Start locally

```bash
npm start
```

Open http://localhost:3000. Test with `npm test`.

The app uses only built-in Node APIs; there is no `npm install` dependency required.

## Publish on Render

1. Create a GitHub repository and upload **the contents of this folder** (not the ZIP itself).
2. In Render, choose **New → Blueprint** and select the repository; `render.yaml` defines the service. Alternatively create **New → Web Service** with Node runtime, build command `npm install --omit=dev`, start command `npm start`, and health check `/api/health`.
3. Once deployed, use the `onrender.com` URL from Render. Initial page loads bundled official NBA shot-zone snapshot. The backend fetches today's ESPN schedule and season shot details when ESPN permits access.

## Refresh behavior / reliability

- A server refresh checks ESPN completed 2026-27 games and only promotes a new 30-team dataset after all games pass play-by-play vs box-score FGA validation.
- A player selected on the court triggers server-side ESPN game lookups, retaining saved data if the upstream source blocks access.
- Refresh cadence defaults to 12 hours *while the host process is running*; it is not a guaranteed daily refresh on a sleeping free plan. Click **Refresh season data on server** for a manual attempt.
- `data/cache.json` is generated at runtime. Free-tier ephemeral storage may reset on restart; for persistent refreshes, use a persistent disk, database, or external scheduled worker.
- Game-derived court zones reconstruct NBA zone boundaries from ESPN coordinates and therefore are **approximations**, not official classifications. Data source and cutoff date are shown in the interface.

## Matchup grades

A screening score based on (1) player share of attempts by zone, (2) opposing team zone attempt frequency relative to the league, and (3) opposing team allowed FG% relative to the league. Volume alignment contributes 68%; opponent FG% alignment contributes 32%. Scores are bounded 10–90 and labeled A (65+), B (58+), C (48+), D (40+), F (<40).

Top/Worst 6 require at least 40 total classified attempts and 4 played games. With insufficient coverage or an unavailable current slate, the app displays an **unavailable** state, rather than inventing rankings. Use All team pairings for *hypothetical* non-slate comparisons.

The grade is **not** a win probability, projection, or betting recommendation; it does not verify position-specific defense, projected role/minutes, injuries, prop prices, or sportsbook lines.

## API

- `GET /api/health` and `/api/status` — health/data provenance
- `GET /api/bootstrap` — rosters, defensive zones and saved player profiles
- `GET /api/schedule` — today's NBA games
- `GET /api/matchup?defense=BOS&offense=ATL&playerId=...` — player matchup explanation
- `POST /api/player` with JSON `{"team":"ATL","id":"..."}` — request player refresh
- `GET /api/rankings?scope=today|all` — screened Top/Worst 6
- `POST /api/refresh` — start validated season rebuild (cooldown protection)

Data sources: official NBA opponent/player shooting-by-zone 2026-27 partial Nov 5 snapshot bundled for offline display; ESPN current rosters and live schedule/play-by-play when available. The initial bundle contains all 30 team rosters but only 152 saved shooting profiles.

### Daily game center (v1.1)

The home page lists every game returned for the selected NBA calendar date, with game status, local Central Time tipoff and available final scores. Tap a game or press **Analyze AWAY** or **Analyze HOME** to set the opposing teams, preselect the strongest measured shooter (when saved data exists), and load the six-zone court and grading sections. The date picker and arrows let users select other 2026-27 regular season dates; Top/Worst six rankings follow the selected slate when in “Today's games” scope.

`GET /api/schedule?date=YYYY-MM-DD` and `/api/rankings?scope=today&date=YYYY-MM-DD` are date-aware. ESPN scoreboards are cached for two minutes on the current day and twenty minutes on other days; fresh=1 forces a refresh. If upstream schedule data fails, the server can reuse a previously validated in-process date cache. It will not fabricate games.

### Data-integrity and coverage upgrade (v1.2)

- Corrected ESPN play-by-play heaves with coordinates beyond the court bounds (e.g. `y=62`) being incorrectly counted against official box-score FGA. Heaves are excluded from normal zone counts **before** coordinate bounds validation.
- Each game is compared with both teams' recorded box-score FGA. At most two residual shot discrepancies per team are accepted as estimated play-by-play data; any larger discrepancy rejects that game. The number of unreconciled attempts is exposed by the status API.
- Season rebuild promotes a **clearly labeled partial dataset** when at least 85% of completed games (and at least 60 games) are available from all 30 teams, otherwise retains the previous snapshot. A failed game no longer discards every successfully downloaded game.
- Player on-demand refresh accepts the valid subset of games when some data cannot be retrieved, labels the profile partial, and prefers newer/more complete profiles over older saved data.
- The server attempts a full refresh after startup and checks again periodically while awake. The server's host filesystem is ephemeral; this is not a guarantee of permanently persisted refresh results.
- The rankings now audit every roster entry in the actual selected slate: eligible (GP≥4, FGA≥40), low sample, and missing profiles. Only the eligible players enter ranking calculations. They always display as **Top/Worst 6 among eligible**, with transparent roster coverage and without implying a complete-league ranking.
- `GET /api/status` includes `rosterProfiles`, `profileCoveragePct`, and quality counts (`refresh.stats`). `GET /api/rankings` includes `eligiblePlayers`, `notQualified`, `missingProfiles`, `totalRosterSlots`, `coveragePct`, and data as-of date.
- These results remain descriptive and are not betting success probabilities. A full injury/role/lineup audit is not performed by the app.


## v1.3 — Projected opportunity & historical accuracy upgrade

All existing six-zone court, game selector, Top/Worst 6, original v1.2
68%/32% grades, data-integrity checks and ESPN refresh endpoints remain.

### Projected six-zone FGA

- **Opportunity grade:** defensive zone shot-frequency alignment displayed as a
  separate descriptive 10–90 score.
- **Efficiency grade:** opponent FG% differential in those same zones, displayed
  independently on a 10–90 scale.
- **Data confidence:** 0–100 data-coverage score. Historical sampling and
  observed minutes support it; it is **not** a probability of a successful bet.
- **Projected attempts by zone:** 60% last-five-game attempts and 40% season
  attempts (or season alone if fewer than three usable recent games), multiplied
  by relative opponent shot share (adjusted at most 15% up/down), then by
  expected minutes compared with the player's recent observed minutes. The
  minutes scaling ratio is clamped to 0.65–1.30.
- **Minutes/role gate:** if the user supplies an independent projected-minutes
  estimate and manually confirms role/injury research, the model uses it. If
  either is missing, the matchup remains **REVIEW** at best. Underlying data
  coverage is disclosed. User confirmation is not a checked external source.
- **VETO:** missing minimum game/attempt samples, unusually restrictive opponent
  FG% in a player's principal zone, or a large projected volume reduction.
  A veto blocks scouting approval but is not a validated betting signal.
- A 'SCOUTING CLEAR' result **never** means a prop is approved: projected
  starters, injuries, lineups, prop lines, price and market odds still require
  separate verification.

### Postgame tracker

- The **Postgame Accuracy Tracker** defaults to the previous Chicago-local
  calendar date; it can audit any 2026–27 in-season date that has completed
  ESPN games stored in the server's validated game cache.
- Reconstructs every pregame season profile and defensive rate exclusively
  from games strictly **before** the selected day's tipoffs; nothing from the
  audited date enters the baseline or projected zone FGA.
- Ranks eligible candidates **before** looking at the day's outcomes; DNPs
  remain in Top 6 / Worst 6 (marked and excluded from hit-rate denominator).
- Shows predicted vs. actual target-zone FGA, season baseline clearing, and
  mean absolute error for projections, plus optional CSV export.
- Attempts to archive the day's original pre-tipoff Top/Worst lists when the
  website receives an ESPN schedule **before any game starts** and the serving
  dataset is from an earlier date. An archived board is distinctly labeled;
  postgame reconstruction is not misrepresented as a saved pre-tipoff record.
- Neither historical target-zone clearance nor mean absolute error measures
  PrizePicks win percentage, edge or betting returns.
- `data/cache.json` stores completed games and daily pregame snapshots. A free
  Render instance may lose this file on restart. Use a durable disk/database to
  retain archives indefinitely, and use an independent scheduler if the site
  must refresh while the free service is asleep.

### Additional API endpoints

- `GET /api/matchup?defense=...&offense=...&playerId=...&expectedMinutes=32&roleVerified=true`
  adds `forecast`, including six-zone projected attempts and separate grades.
  The two extra query parameters are optional.
- `GET /api/accuracy?date=YYYY-MM-DD` reconstructs and grades a historical
  slate without using any same-day or future game data for prediction.
- `GET /api/snapshots` lists stored pre-tipoff ranking snapshots when available.

### Deployment for this update

Replace the contents of the existing GitHub repository with the contents of
this project folder, preserving `public/`, `lib/`, `data/`, `test/`, `server.mjs`,
`package.json`, and `render.yaml`. If GitHub-to-Render auto-deploy is connected,
merging that change triggers a new build. Render build: `npm install`;
start: `npm start` (or use `render.yaml`). Verify `/api/health` and the new
Projected Opportunity and Postgame Accuracy sections after deployment.

`npm test` includes regression tests covering the original functionality,
forecast logic, minute scaling, Chicago-local dates, DNP retention and a
same-day-data-leakage check.

## v1.4 Video-Informed Research Desk (November 7, 2026)

The player matchup view now includes a prop Research Desk supporting standard Points, Rebounds, Assists, 3PM, PRA, RA, PA, PR, FGA, 3PA, FTM, and 2PM lines. Enter the exact line and direction, then compare distinct last-five / last-ten / season / **same-season only** head-to-head win, push, loss rates. The baseline is a *transparent heuristic* (55% last-five, 45% current-season average) adjusted only by an independently entered projected minutes number, not an estimated success probability. Recent box-score shots, threes and free throws help identify upstream opportunity; NBA tracking chances and detailed play-type defenses remain externally sourced/user-entered. The desk includes injury/role, stat-DvP, projected minutes, market check, pace/spread and second-pass veto fields, with blocking/uncertain status and a local browser watchlist with CSV export. Field sources and gaps are explicit.

Three referenced public YouTube videos inspired the **questions** in the research workflow, but their predictions or accuracy claims are not validated here:

- TWO6ZERO, *How To Research Basketball Props & Win Smarter* — https://youtu.be/ZxVrh-HV49M : shot-zone and play-type matchups; potential assists, rebound chances, roster construction and minutes.
- Cheese Picks, *4-0 SWEEP! BEST NBA PROPS SATURDAY 11/7* — https://youtu.be/H43RBhkEwOA : exact line, recent hit rate, H2H, sportsbook prices, and combined-stat paths.
- Final Round Sports, *NBA Best Bets, Picks, Player Props, Spreads* — https://youtu.be/Jh2Hhw1CwYE : full slate, play-type, DvP, back-to-back and spreads, waiting for injury status.

Do not treat content creators' selected winning examples as predictive validation; test these signals out of sample and retain no-bet cases. See `CONNECT_GITHUB.md` for continuous deployment without repeated ZIP uploads.

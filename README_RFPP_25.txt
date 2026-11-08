NBA Scout — RFPP 2.5 Directional Evidence & Clear Reasons
Release ZIP name: NBA_Scout_RELEASE_v2.9.zip
Site API status version after a successful Render deploy: 2.5.0

What this does
  * Classifies EVERY direction: STRONG MORE / STRONG LESS, LEAN, HOLD, PASS,
    VETO. Does not force a top 10 when evidence is insufficient.
  * Displays the chosen direction prominently on each Top 10 card, Grade Board
    row and full report, with specific supporting reasons, contradictions,
    projected playing time, line margin and opponent's exact stat/position ranks.
  * Combines historical median/volatility, a user-uploaded RotoWire projection,
    non-overlapping last-5 vs previous-5 per-36 opportunities, position-specific
    defense (reduced credit for fantasy-position estimates), minute risk,
    rest/B2B and spread. Source checks remain visible.
  * Avoids treating box-score rebounds as rebound chances or completed assists
    as potential assists. Rejects out/doubtful, model opposition, unstable
    minutes, and true data conflicts. More and Less are graded independently.

The visible six weights sum to 100%:
  Independent current stat projection vs standard line    30%
  Pre-game historical median, volatility and clearance     26%
  Upstream attempts / non-overlapping opportunity          18%
  Minutes stability and projected rotation risk            12%
  Exact stat-and-position opponent DvP                      10%
  Game context, blowout spread and B2B                      4%

These weights are transparent, HUMAN-CHOSEN SCREENING HYPOTHESES based on
current prop-research best practices. They have NOT been calibrated to profit
or confirmed as optimized feature weights in a held-out historical backtest.
The 0-100 research score is NOT a P(win) estimate or a guarantee.

The STRONG label means research evidence agrees, but never by itself means
BET. Actual BET-READY requires all injury, confirmed lineup, exact market price
and independently vetted positive expected value gates. Current site cannot
verify an independently calibrated EV because it has no complete live payout
and consensus-odds data; it should not present betting approval by default.

Sources considered (educational; NOT a numeric weighting authority):
  NBA tracking glossary:
    https://www.nba.com/stats/help/glossary
  2026-27 official NBA injury-report schedule:
    https://official.nba.com/nba-injury-report-2026-27-season/
  NBA player props: projected minutes, per-minute rates, rest, correlated combos:
    https://quantplus.win/sports/nba/player-props/
  Video method: Guy Boston Sports, research baseline/situational rotations
    https://www.youtube.com/watch?v=5KkNL5clhH8
  A cautionary example about backtesting before claiming profit:
    https://github.com/tredaman5/NBA-Player-Prop-Model
  User's RFPP 2.0+ review findings and prior automated nightly audits.

INSTALL ON GITHUB MOBILE
  1. Upload this ZIP as a single file to the existing repository root:
       https://github.com/Cosentinoc1/nba-shortzone-scout
  2. Commit to main; the existing NBA Scout Auto-Update action extracts it.
  3. It runs PATCH_SCOUT_25.py during npm pretest, checks Node syntax, runs
     the full test suite and commits changed source ONLY ON TEST SUCCESS.
  4. Render automatically deploys the resulting commit. Verify live API at:
       https://nba-shotzone-scout.onrender.com/api/status
     It should return "version":"2.5.0".

No new GitHub Action workflow files. No sportsbook bets placed. No auto-pull of
subscriber-only RotoWire data. Upload today's projection XLSX to strengthen
rankings; stale exact lines and unverified roles still require final review.

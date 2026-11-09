# NBA Scout v3.12 — cumulative one-upload upgrade over v3.10

**Upload this ZIP, not v3.11 followed by another file.** It carries all v3.11 improvements and the v3.12 fixes. The existing GitHub auto-update process chooses the highest ZIP release and runs the `npm pretest` installers in order. When both installers have finished, the site `/api/status` should show `version: 3.12.0` and `dataQuality`.

## Video and scoring update

User-supplied video: “Stop Guessing NBA Player Props: 5 Ways to Find Value” (OddsJam Edge, YouTube ID a-Gn2cqZlZQ). The video description and metadata support market line shopping, price differences, line movement, sharp money and correlated parlays. The full spoken transcript could not be retrieved; no precise unsupported video-specific formula is being ascribed to its creator. We implemented conservative market-price verification principles; nothing assumes a live OddsJam subscription.

- RFPP research weighting: historical hit rates **12%**, recent clearance **8%**, measured opportunities **24%**, minutes **24%**, defensive matchup **16%**, independent projection **16%**. These are heuristic research scores, not proven optimized weights or calibrated win probabilities; keep backtesting.
- The Top 10 now has an explicit **PRICE, LINE MOVEMENT & VALUE** fact. Absent independent bookmaker odds and exact payout, it reports **MARKET NOT VERIFIED** and will not claim +EV. Stale platform lines are flagged after 75 minutes.
- Confirmed OUT, questionable injury and role/matchup checks from v3.11 remain intact. Same-game picks are NOT automatically independent; review ticket correlation separately.
- A 36-attempt midrange zone **does not earn HIGH FG%/WEAK SPOT classification**. Minimum 60 defensive shot attempts for a confident label/rank, together with volume/share qualification. Data is coordinate-derived when ESPN is the source.

## Source integrity and 3PA leader fix

- New `/api/data-quality` gives arithmetic reconciliation of all six defensive zones, FG%=FGM/FGA, shares, league sums, source dates, 30-team coverage and qualifying player profiles. Exposed also as `status.dataQuality` and in Defense Zones.
- The existing seeded `data/defense.json` has 30 teams / 21,662 total FGA, all internally reconciled in our audit as of Nov 5. Its seeded `data/players.json` has only 152 profiles across 10 teams; 67 are missing valid GP, **so it is not a complete league-wide shooter dataset**. On-demand ESPN refresh may improve this, but do not assume it did until the site's quality status confirms.
- The opponent 3PA display now withholds leaders entirely for missing or >2-day-stale date-qualified profiles and explicitly marks shorter rosters **PARTIAL** rather than falsely calling them team leaders.
- Stats were checked for internal consistency and sampled against independent public sources where available. This package **does not guarantee every live stat is independently cross-verified**; official NBA endpoints were not directly accessible during preparation. RotoWire uploads are user-provided and require slate-date/identity and source checks. The live Render service was not available for a full end-to-end real-time audit.

## Install / verification

1. Open `Cosentinoc1/nba-shortzone-scout` on GitHub, choose **Add file → Upload files**.
2. Upload ONLY `NBA_Scout_RELEASE_v3.12.zip` to the repository root, without extracting, and commit.
3. Let existing Auto-Update action apply the release. In GitHub Actions, verify both `PATCH_SCOUT_311.py` and `PATCH_SCOUT_312.py` and the `npm test` suite pass.
4. In Render, check `/api/status` for `version: 3.12.0`, and `/api/data-quality` for `structuralOk`, `playerTeamCoverage`, `issues`, and `warnings`.
5. Confirm a chosen defense's mid-range zone with fewer than 60 attempts says **SMALL SAMPLE**, and an opponent not in refreshed player profiles says **no ranking available**.

Fail closed: no fake market price, no automatic +EV classification, no teammate injury bump without independent projected minutes, no complete 3PA list from a partial dataset, no copied previous-day OUT designations treated as confirmed current without a fresh injury report.

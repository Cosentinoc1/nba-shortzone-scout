# NBA Scout v3.18 — easy pick desk, RotoWire diagnostics, historical integrity

**Deploy:** Upload the single `NBA_Scout_RELEASE_v3.18.zip` in the root of `Cosentinoc1/nba-shortzone-scout` as before, without extracting it. GitHub Actions **NBA Scout Auto-Update** will select the highest release ZIP, unpack, run `npm test`, and commit the tested source. No `.github/workflows` files are included, avoiding protected-workflow permissions.

**Changes**

- Home: quick Top 2 / Top 5 first. Large direction and exact line, recent results, playstyle/opportunity, opponent defensive fit, playing-time explanation, top failure risk, and full research in one tap.
- The old Top 10 is still there under an expandable *Explore the complete Top 10* section, so no advanced features are lost.
- The giant verification dashboard becomes a short **Data connections** summary expandable for details. Displays *file imported*, *valid rows*, and *matching prop lines* separately; source connection is NOT an active-player or start confirmation.
- RotoWire XLSX import no longer discards otherwise valid projected minutes/PTS/REB/AST due to empty optional steal/block/3PM/FTM columns. Values that are actually missing stay `null`, NOT invented zero. Essential columns remain mandatory. Diagnostics show skipped rows and opponent mismatches.
- Client-side RotoWire matches the same-team player despite ESPN vs RotoWire team aliases, middle initials and Jr. suffixes, declining ambiguous matches. Uploads stay browser-local, not persisted on Render.
- Top picks now surface matched RotoWire minutes and exact projected stat where available.
- Player reports show a short read-first summary and full advanced game logs/checks under one expansion. The direction-specific L10 record is used for MORE versus LESS. ESPN history source audit flags duplicate games, invalid shot totals, inconsistent box-score points and partial samples, without treating incomplete stats as zero.
- History counts say `9/20` when only nine played games with complete relevant statistics exist before the slate. **These stats are current 2026–27 regular season only**, not player career or future games. Last-20 coverage grows as the season progresses.

**Accuracy:** We spot-checked Jalen Brunson on November 7, 2026 against ESPN's final NYK @ CLE player box score: 31 PTS, 3 three-pointers from 7 attempts, 6 REB, 9 AST, and 34 MIN; the site matched. This is a real source spot check, **not** a guarantee that all historical games in the database were independently verified. The additional in-app audit is internal integrity checking, not league cross-validation. ESPN can issue postgame corrections; refreshed caches may change.

**Security/data:** No logged-in RotoWire scraping, no invented data-source connections, no unlicensed sportsbook odds, no automatic profitable-bet or lock assertions. An uploaded RotoWire forecast is ONE independent estimate, not a lineup confirmation.

**Troubleshooting:** When the upload says `0 matched prop lines`, check that the selected game date is identical to the RotoWire export slate (Today vs Tomorrow), that NAME / Team / OPP / MIN headers are present, and that teams/opponents align. A nonzero accepted-row count confirms a readable upload even if no players match.

**Validation:** New local tests cover mobile-card markup, user-provided file state, exact same-team aliases, no matching ambiguity, honest missing projection values, game-date cutoffs, missing component stats, invalid shooting arithmetic and incomplete L20 samples. The incremental installer was run twice in a patch-fixture. Run the complete GitHub suite after upload and verify Render reports version `3.18.0`. Do not infer a successful live deployment from local tests.

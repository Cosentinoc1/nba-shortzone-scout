# NBA Scout v1.5: cleaner UI + line feed

## What's included

- A clean mobile-first default page: Top Picks, Player Research and one-click access to the former dashboard at `/classic`.
- Top-six **research candidates**, each with a transparent screening score (not a probability), last-10 true win/push/loss counts, directional baseline, zone alignment and unverified checks.
- NBA game filters, More and Less filters, detailed evidence and individual player research.
- CSV import for the existing `NBA Props` Google Sheet or a PrizePicks standard NBA props CSV.
- Optional read-only automatic feed using an **independent third-party service** (`PRIZEPICKS_API_KEY`) or a user-approved published Google Sheet (`PROPS_CSV_URL`). No direct PrizePicks scraping.
- Stale-line and unknown freshness warnings; no finalized or guaranteed picks. The current market line, independent minutes, injuries, opportunities, DvP, odds/payout and correlation must still be checked.

## Automated standard-line feed (optional)

### Method A — third-party API

1. Independently review pricing/terms and register an API key at https://prizepicksapi.com/docs (this is not an official PrizePicks API).
2. In Render → nba-shotzone-scout → Environment, add `PRIZEPICKS_API_KEY` with your key as a **secret environment variable**; never paste it in the site, chat or source code.
3. The app fetches standard NBA props server-side and caches a successful board for up to 12 hours. A free plan may have monthly credits and per-page limits; this is on-demand refresh, not a guaranteed continuously updated real-time feed. Check timestamps before using lines.

### Method B — Google Sheet

1. Use your existing `NBA PrizePicks Live Board` with a tab named `NBA Props`.
2. **Only if you agree that this data can become public**, publish the tab as a CSV (File → Share → Publish to web). Alternatively, deploy a secured authenticated API/proxy, which is NOT included here.
3. Add the published HTTPS `docs.google.com` CSV link as `PROPS_CSV_URL` in Render Environment. No Google account credentials are stored by the app. The board is retrieved on demand and cached 12 hours.
4. Confirm that the Source Date / observed_at is within the last 2 hours; a stale Google Sheet does not become fresh merely because this app fetched it.

The provider takes priority if both environment variables are set. This public dashboard displays prop lines, so do not point it at a sheet containing personal records.

### No automatic feed

On the Top Picks page, tap `Import CSV`. Export only current NBA standard rows from your Sheet, use CSV, and import from your phone. This never sends the entire CSV to a persistent database; the browser posts the content for one calculation and the server does not retain the upload.

## Deployment from GitHub

This source package is unzipped into the **repository root**. It is not meant to remain a ZIP inside the repository. Your Render settings should remain:

- Build: `npm install`
- Start: `npm start`
- Root Directory: empty
- Branch: `main`

Avoid replacing the working site before tests pass. Running `npm test` checks the research logic. Old advanced dashboard lives at `/classic` after deployment.

## Important

- PrizePicks has no public official developer API; the optional feed is an unaffiliated third-party provider. Use only sources you are authorized to use.
- Research score is NOT calibrated probability, EV or a recommendation that an entry is profitable.
- Body size capped for imports. API keys stay server-side. Uploaded sheets must contain line data only.
- On Render free plans cached prior game results can be lost on restart; the app rebuilds its ESPN history from available data.

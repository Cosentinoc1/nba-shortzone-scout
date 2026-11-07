# NBA Scout v1.9 — Daily RotoWire Projections (2026–27)

**What changed**
- New **Import RotoWire XLSX** button directly on the NBA Scout homepage. Supports the actual 22-column RotoWire export and CSV exports, with no online Excel libraries, subscription-login scraping, ZIP uploads or special formatting.
- Reads the sheet locally in the phone's browser. Saves daily projections in that browser only. The compact rows are sent to the app server for a transient calculation; the server does not save the uploaded projections to disk, logs, GitHub or public APIs.
- Overlays minutes, points, rebounds, assists, field-goal attempts, 3PA, 3PM, free-throw attempts and supported combo stats onto the current standard PrizePicks board. Uses file opponent/team to reject mismatched or stale slates.
- **RFPP 1.9 gate:** compares the exact source line to RotoWire's estimate *and* the player's historical baseline, considers minutes changes and the available ESPN game/defense context, and vetoes 0-minute or very-low-minute projections. Never treats a RotoWire projection as a confirmed starter or guaranteed prediction.
- Promotes Top 10 MORE/LESS only when historical and RotoWire directions agree and lines were observed within 75 minutes; otherwise displays HOLD/PASS with reasons. Grade Board can sort by model edge and projected minutes.
- The full player report displays the user-supplied RotoWire projected minutes, statistical projection, attempts and model-vs-line margin.
- Existing public ESPN injury/defense checks remain separate. Independent sportsbook prop prices, multiplier EV, lineup confirmation, rebound chances/potential assists, and multiple projection consensus stay pending if not present.

**One-time install:** Upload `NBA_Scout_RELEASE_v1.9.zip` to the GitHub repository root. The existing `NBA Scout Auto-Update` GitHub workflow extracts it and Render automatically redeploys source files.

**Every subsequent NBA day:** Open the site → set NBA date → tap **Import RotoWire XLSX** → select the export from the phone → rankings regrade automatically. No additional ZIP, GitHub edit or Render deployment. The data is retained only in that browser for that selected date. Send the XLSX to ChatGPT if you'd also like a deeper manual RFPP second-pass review.

**Known limits:** The workbook does not prove projected lineups, injury designations, or actual minutes. Its export-time timestamp is not embedded in the sample, so the website knows upload time but not the exact RotoWire generation time. Confirm a fresh export before using results. Historical source scores and model outputs are not validated win probabilities or a betting guarantee.

# Update NBA Shot-Zone Scout without uploading ZIP files

## One-time source setup

1. Find the **GitHub repository already linked** to your Render service (`nba-shotzone-scout`). On Render, open your web service, find **Settings → Build & Deploy → Repository**, and note the exact repo/branch.
2. Ensure that GitHub repository contains the **contents** of this v1.4 project at its root. If replacing earlier source, upload these files into that existing repo **once**. Keep any unrelated user secrets out of GitHub. A ZIP uploaded as one file is not executable source; extract it first.
3. In **Render → Settings → Build & Deploy**, choose **Auto-Deploy: After CI Checks Pass** (or **On Commit** if checks are unavailable). The Render service must watch the same branch (usually `main` or `master`). The start command should be `npm start`; health check `/api/health`.
4. GitHub Actions now runs `npm test` and Node syntax checks on pushes and pull requests using `.github/workflows/tests.yml`. Set Render to **After CI Checks Pass** to avoid deploying a commit whose tests failed. The `render.yaml` Blueprint also requests `checksPass` when Blueprint-managed.
5. Test after deploy: `/api/health`, `/api/status` (should report version `1.4.0`), `/api/research?offense=SAS&defense=POR&playerId=5104157&stat=PTS&line=26.5`.

## Future workflow

If ChatGPT's GitHub connector can see and write to **that repo**, authorized code changes can be made as direct commits/PRs (no ZIPs). You'll still review/approve connecting your account and repository. **Current ChatGPT GitHub access has returned zero visible repositories**, so a direct commit was not possible during this update. Connect/authorize GitHub from ChatGPT Plugins and share the repository URL or `owner/repo` name so we can target the correct project.

Alternatively, you can edit source files in the GitHub web interface and commit. Render then deploys automatically, without downloading an archive.

## Data and accuracy limitations

- ESPN game summaries are refreshed on the server into `data/cache.json`; Render's free ephemeral disk can discard that file on restart. A persistent disk/database is recommended for permanent history. A server refresh is required after this upgrade so v1.4 has **actual player PTS/REB/AST/3PA**, not just zone counts. The new research panel will display incomplete stats until that refresh finishes.
- The research desk does not scrape subscription-only RotoWire, NBA tracking potential assists/rebound chances, Synergy play types, or sportsbook odds. Those fields are user-entered and require independent source checks.
- Research ratings and hit rates are descriptive, not validated probabilities. The scorecard does not submit bets or guarantee positive expected value.
- The watchlist is stored in your browser (`localStorage`), not on the server; export CSV before changing devices or clearing browser data.

# Upgrade NBA Shot-Zone Scout to v1.3

The current live URL is https://nba-shotzone-scout.onrender.com.

## Upload to the existing GitHub repository

1. Download and extract the `NBA_ShotZone_Scout_v1.3_DeployReady.zip` package.
2. Open the existing GitHub repository used for the current Render deployment (`nba-shotzone-scout`).
3. Replace its existing source files with the extracted folder contents, preserving the `public/`, `lib/`, `data/`, and `test/` directories. The root must contain `server.mjs`, `package.json`, and `render.yaml`. **Do not just upload a ZIP to a Node repository configured to run `npm start`; it needs the extracted files.**
4. Commit the changes. Render will auto-deploy if this repository is connected to the Render service with automatic deploys on. If not, use Render's **Manual Deploy → Deploy latest commit** for the current service.
5. On the deployed site, inspect **Projected zone FGA + three independent grades** and **Postgame Accuracy Tracker**. Allow the ESPN refresh to finish before running a historical audit.

For legacy repositories configured with a special Render build command that unzips the project ZIP, use `NBA_ShotZone_Scout_v1.3_LegacyFolder.zip` instead, updating the zip filename in that build command to match. Do not change Render services or workspaces without confirming which is linked to the existing app.

## Tests

From the extracted project root, run:

```
npm test
npm start
```

Check `/api/health`, the player `/api/matchup` endpoint with a valid roster ID, and `/api/accuracy?date=2026-11-06` after a validated ESPN game cache is available.

The live site is not modified just by downloading this archive. Push/commit the source to the connected repo first.

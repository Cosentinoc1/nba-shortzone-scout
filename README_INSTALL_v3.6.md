# NBA Scout v3.6 — GitHub installation permission hotfix

This release corrects the root cause of failed GitHub Actions run #23. All 161 npm tests PASSED on the v3.5 release; only the final GitHub push was rejected: GitHub's built-in Actions token cannot CREATE a new workflow file under `.github/workflows/` with the current permissions.

v3.6 installs identical app code, including RFPP 2.7 graded rankings, the Performance Review page and the 30-team Defensive Zones explorer, but deliberately leaves **all files under `.github/workflows/` out of this ZIP**. This removes the rejected protected-file write from the existing installer. The app itself can then deploy through the existing `.github/workflows/install-v14.yml` workflow.

## Upload exactly one ZIP

Upload `NBA_Scout_RELEASE_v3.6.zip` to the GitHub repository root via Add file > Upload files. Do NOT unzip it first; the existing NBA Scout Auto-Update workflow picks the highest `NBA_Scout_RELEASE_v*.zip`, unzips it, runs `npm test` and commits changed app code.

Verify:
1. GitHub Actions > NBA Scout Auto-Update = green / success for the v3.6 upload.
2. Render redeploys after the new commit. `/api/status` should report version `2.7.1`.
3. Main site's Defense Zones tab opens, loads 30 teams and displays six zones, FGA allowed and FG%.
4. `/review.html` renders past daily grades and the v1.9 historical audit seed.

## Important: Daily Review SCHEDULING is a separate GitHub step

The Performance Review page and its grading scripts are installed by this ZIP. Automatic daily execution is not scheduled yet, because GitHub rejected the attempt to create `.github/workflows/nba-scout-review.yml` from an Actions token. To enable unattended daily captures/reviews, sign in to GitHub as the repository owner and add the separate file `NBA_Scout_Daily_Review_Workflow.yml` under `.github/workflows/nba-scout-review.yml` using GitHub's web UI (Add file > Create new file). Use the separate supplied YAML file's contents. If your repository has Actions workflow permissions restricted, approve the new workflow from Settings > Actions. Keep the existing auto-update workflow unchanged.

Without this manually added workflow, the review page loads its existing historical audit but won't capture new daily boards automatically. Do not claim otherwise. Pre-tip screenshots/files are immutable only once the review script has captured them.

## Source safety

This update does not bypass invalid lines, injury/DNP safety vetoes, failed future/past slate identity, or final market price checks. A research rank is not a calibrated bet probability or guarantee.

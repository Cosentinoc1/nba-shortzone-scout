# NBA Scout v3.10 — RotoWire matching repair

Why the previous status might say 225 imported / 0 matched:
- Importing valid forecast rows does **not** establish that their players match today's PrizePicks slate.
- Prior matching used exact team-and-name strings and rejected noncanonical opponent strings, so harmless RotoWire rendered initials or team aliases could block a match.
- A RotoWire **Today** export for the wrong date (rather than **Tomorrow**) can legitimately have zero overlapping players/opponents.

What this package changes:
- Safe, team-constrained RotoWire name normalization (initials and common suffixes), team aliases, and opponent text normalization.
- No fuzzy player guessing, no ignoring a genuine opponent mismatch.
- Explains the zero count: how many teams overlap, wrong opponents, names remapped, unique players and unique exact-line props matched.
- Recalculates RFPP 2.7 research rank with a genuinely matched RotoWire projection; it does not call an unverified lineup confirmed or make a guarantee.
- Makes the status message explicit. A report of zero after this update should be treated as a likely wrong-date/format issue, not a successful RotoWire match.

Installation: Upload NBA_Scout_RELEASE_v3.10.zip to the repository root without extracting. The existing GitHub auto-update workflow selects the highest version. No protected workflows are added.

Limits: The user's live browser-uploaded file is only in the browser; this package cannot inspect it until the updated site analyzes it. The true cause of *that* file's zero matches therefore is not yet proven. On reopening the app, if the saved RotoWire file is still for the chosen date, it will be re-analyzed automatically. If not, choose the correct Today/Tomorrow day in RotoWire and re-export.

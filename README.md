# Knockout Pool — Live Site

A self-updating standings site for our 2026 World Cup knockout pool. It reads the
live match feed directly, so there's **no database, no login, and no manual scoring** —
anyone who opens the link sees the same live results, updated every 30 seconds.

## What it does

- 8 players, each owning one team in every tier (group winner / second tier / runner-up / third place).
- **Scoring:** 1 pt per win in the Round of 32 and Round of 16, 2 pts in the quarterfinals and semifinals, 3 pts for the final. A champion is worth 9.
- **Tiebreaker:** total goals scored by a player's teams in the knockout stage (shown as "GF").
- Top two finishers are flagged as prize spots.

## Files

```
index.html         The page everyone sees
api/standings.js   Serverless function that reads the live feed and computes standings
package.json       Project marker
```

## Deploy to Vercel (about 5 minutes, free)

**Option A — GitHub (easiest to keep updated)**
1. Create a new GitHub repo and upload these files (keep the folder structure).
2. Go to https://vercel.com/new, import that repo.
3. Framework preset: **Other**. Leave build settings empty. Click **Deploy**.
4. Share the resulting `*.vercel.app` URL with the group.

**Option B — Command line**
1. Install the CLI: `npm i -g vercel`
2. From this folder, run: `vercel` (follow the prompts), then `vercel --prod`.

No environment variables or database are required.

## Good to know

- **Data source:** the live feed is ESPN's public World Cup endpoint. It's free and reliable but unofficial, so if ESPN ever changes it, the numbers could pause until the code is updated.
- **Refresh rate:** the function caches results for ~30 seconds to stay fast and avoid hammering the feed; the page re-checks every 30 seconds.
- **Advancement & goals are automatic.** There's intentionally no manual override. If you ever want one (e.g., a password-protected "edit results" mode as a backup), that's a small addition — ask and it can be bolted on with a lightweight database.
- **Tiebreaker scope:** currently knockout-stage goals only. If you'd rather count whole-tournament goals (including the group stage), it's a one-line change in `api/standings.js`.
- **Rosters** are hard-coded from the draw in `api/standings.js` (the `PLAYERS` list). Edit there if anything needs to change.

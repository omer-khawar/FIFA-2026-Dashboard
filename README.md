# WC26 — World Cup 2026 Live Dashboard

A one-screen, visual-first fan dashboard for the 2026 FIFA World Cup (Jun 11 – Jul 19, USA / Mexico / Canada, 48 teams, 104 matches). It's a pure static SPA — no backend, no API keys — that fetches live data from ESPN's public API in the browser on load and on manual refresh, and runs its own prediction engine client-side.

**Five visual features:**

- **3D host-cities map** — real WebGL globe-slabs of the three host nations with a glowing beacon per stadium; beacons pulse red when a match is live, amber on match days, cyan otherwise. Click a beacon (or a match card) and the camera eases in.
- **Live match strip** — horizontally scrolling cards ordered live → today → upcoming, each with flags, score/kickoff, and a Win/Draw/Loss probability bar.
- **Knockout bracket** — SVG bracket R32 → Final (+ 3rd place) with connectors derived from the feed's own slot labels; live ties glow, undecided slots show dim placeholder chips.
- **Groups grid** — all 12 group tables with points, goal difference, qualification-color stripes, and a per-team advance-probability bar.
- **"Who lifts it" odds + news** — top-12 championship probabilities as animated bars, plus the latest ESPN news with cover images.

## Architecture

- **Static SPA** (Vite + React 19 + TypeScript), deployed to GitHub Pages with `base: './'` so it works under any repo path.
- **Live data** fetched in-browser from ESPN's keyless, CORS-open API (scoreboard, standings, news) — no server, no secrets.
- **Committed sourced static data** under `public/data/`: stadium coordinates/capacity (Wikipedia), host-country polygons (Natural Earth 110m), and a pre-tournament Elo seed (eloratings.net) — each file carries a `source` field.
- **Prediction pipeline:** Elo replay of completed matches → Poisson score grids per pairing → a 10,000-iteration Monte Carlo simulation of the rest of the tournament, producing per-match W/D/L and per-team stage-reach probabilities.
- **The Monte Carlo runs in a Web Worker** so the UI never blocks; `zustand` holds state, `react-three-fiber` + `drei` + `postprocessing` render the map.
- The prediction model is statistics-only; a no-op `adjustments.ts` seam is left for future news/sentiment conditioning.

## Run locally (Windows)

Node is portable in this setup and not on `PATH`, so prefix each command. (Any Node ≥ 20 already on your `PATH` works too — then skip the prefix.)

```powershell
# Put the portable Node on PATH for this shell session
$env:Path = "C:\Users\Omer\AppData\Local\nodejs\node-v24.16.0-win-x64;$env:Path"

npm install        # first time only
npm run dev        # dev server at http://localhost:5173
```

Other scripts:

```powershell
npm run build      # type-check + production build → dist/
npm run preview    # serve the built dist/ locally
npm test           # run the engine unit tests (vitest)
```

## Deploy to GitHub Pages

The repo ships a workflow at `.github/workflows/deploy.yml` that builds and publishes on every push to `main`.

1. Create a new GitHub repository (any name).
2. Point this repo at it and push `main`:
   ```powershell
   git remote add origin https://github.com/<user>/<repo>.git
   git push -u origin main
   ```
3. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. The next push (or a manual run from the Actions tab) deploys it. The site will be live at:
   ```
   https://<user>.github.io/<repo>/
   ```

Because the build uses `base: './'`, no further configuration is needed regardless of the repo name.

## Data sources & credits

- **Match, standings & news data** — [ESPN public API](https://site.api.espn.com) (keyless, CORS-open).
- **Pre-tournament Elo ratings** — [World Football Elo Ratings (eloratings.net)](https://www.eloratings.net).
- **Host-country borders** — [Natural Earth](https://www.naturalearthdata.com) 110m Admin-0 Countries (public domain).
- **Stadium coordinates & capacities** — Wikipedia (2026 FIFA World Cup venue articles).

## Limitations (honest notes)

- **Manual refresh only** — there's no polling or websockets; click Refresh to pull new data and recompute.
- **Stats-only model** — predictions use Elo + Poisson + Monte Carlo with a home-advantage bonus, and ignore injuries, lineups, form narratives, and news (the `adjustments.ts` seam is intentionally a no-op).
- **Live matches are sampled, not score-conditioned** — an in-progress match is simulated from scratch (its current score doesn't bias the remaining minutes), so live W/D/L bars reflect pre-match expectancy rather than the live scoreline.
- Knockout ties are approximated through extra-time/penalties via a single advance probability rather than a separate ET/shootout model.

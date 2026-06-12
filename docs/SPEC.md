# World Cup 2026 Fan Dashboard — Build Spec

One-screen, visual-first fan dashboard for the 2026 FIFA World Cup (Jun 11 – Jul 19, 2026, USA/Mexico/Canada, 48 teams, 12 groups, 104 matches). Pure static site for GitHub Pages: no backend, no keys, all data fetched in the browser at load + manual refresh.

This spec is the contract between sub-agents. **Interfaces in this file are frozen.** Each agent owns only its directory (see Ownership). Everyone reads `docs/api-samples/*` for real payload shapes.

## Environment

- Windows. Node is portable at `C:\Users\Omer\AppData\Local\nodejs\node-v24.16.0-win-x64` (NOT on PATH).
  - PowerShell: `$env:Path = "C:\Users\Omer\AppData\Local\nodejs\node-v24.16.0-win-x64;$env:Path"` before any npm/node/npx command, every command invocation.
  - Bash: `export PATH="/c/Users/Omer/AppData/Local/nodejs/node-v24.16.0-win-x64:$PATH"`.
- Repo root: `C:\Users\Omer\OneDrive\Desktop\passionate` (git, branch `main`).

## Stack

Vite + React 19 + TypeScript (strict). zustand. three + @react-three/fiber@9 + @react-three/drei + @react-three/postprocessing. d3-geo (projection only). vitest (engine tests only). No router, no CSS framework, no chart lib (SVG/CSS), no other deps. All deps are installed by the Foundation agent; **no other agent edits package.json or installs anything.**

## Data sources (verified live, CORS `*`, keyless)

| What | URL |
|---|---|
| All 104 matches | `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=400` |
| Group standings | `https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings?season=2026` |
| News | `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/news` |

Payload facts (verified against `docs/api-samples/`):
- `events[].season.slug` ∈ `group-stage | round-of-32 | round-of-16 | quarterfinals | semifinals | 3rd-place-match | final` (72/16/8/4/2/1/1 events).
- Status: `competitions[0].status.type.state` ∈ `pre|in|post`, `.completed`, `.detail/shortDetail`, `displayClock`.
- Competitors: `competitions[0].competitors[]` with `homeAway`, `score`, `winner`, `team.{id,displayName,abbreviation}`. Undecided knockout slots are placeholder "teams" with displayNames:
  - `Group A Winner` / `Group A 2nd Place` (R32)
  - `Third Place Group A/B/C/D/F` … (R32, 8 slots; the listed letters are the allowed source groups — official FIFA allocation constraints, straight from the feed)
  - `Round of 32 9 Winner`, `Quarterfinal N Winner`, `Semifinal 1 Winner` etc. (later rounds; `N` = ordinal of that match within its round, resolve by sorting the round's events by date then id)
- Venue: `competitions[0].venue.{id,fullName,address.city}`. Group letter is NOT on the event — derive from the two teams' group membership (standings); knockout stage from `season.slug`.
- Standings: `children[]` = 12 groups (`name: "Group A"…`), `standings.entries[].team.{id,displayName,abbreviation,logos[0].href}` (flag PNG) + `stats[]` by name (`gamesPlayed,wins,ties,losses,pointsFor,pointsAgainst,points,rank` — inspect sample for exact names) + `note.{color,description,rank}` for qualification state.
- News: `articles[].{headline,description,published,links.web.href,images[]}`.

Refresh = refetch all three + recompute predictions. Browser-only fetch, no caching layer.

## The 16 venues (ESPN venue id → stadium; from the feed)

```
1672  Estadio Banorte           Mexico City        MEX
5009  Estadio Akron             Guadalajara        MEX
6351  Estadio BBVA              Guadalupe (MTY)    MEX
10143 BMO Field                 Toronto            CAN
4370  BC Place                  Vancouver          CAN
3871  AT&T Stadium              Arlington TX       USA
7485  Mercedes-Benz Stadium     Atlanta GA         USA
10660 Gillette Stadium          Foxborough MA      USA
6262  NRG Stadium               Houston TX         USA
10897 GEHA Field at Arrowhead   Kansas City MO     USA
9115  SoFi Stadium              Inglewood CA       USA
4643  Hard Rock Stadium         Miami Gardens FL   USA
4727  MetLife Stadium           E. Rutherford NJ   USA
1421  Lincoln Financial Field   Philadelphia PA    USA
5960  Levi's Stadium            Santa Clara CA     USA
4485  Lumen Field               Seattle WA         USA
```

Foundation agent adds lat/lon + capacity from Wikipedia ("2026 FIFA World Cup" venues section) into `public/data/stadiums.json` with a `source` field. Don't hand-wave coordinates — look them up per stadium.

## Directory layout & ownership

```
public/data/stadiums.json      Foundation   16 stadiums (sourced, see above)
public/data/hosts.geo.json     Foundation   Natural Earth 110m USA+CAN+MEX polygons, clipped to lon [-130,-60], lat [14,53] (drop AK/HI/arctic), `source` noted inside
public/data/elo-seed.json      Foundation   pre-tournament Elo per ESPN teamId (sourced; see Engine)
src/lib/types.ts               Foundation   FROZEN after foundation
src/lib/format.ts              Foundation   date/number helpers (Intl, local tz)
src/data/espn.ts               Foundation   raw fetchers + raw TS types
src/data/normalize.ts          Foundation   raw → domain model
src/data/store.ts              Foundation   zustand store + selectors
src/styles/global.css          Foundation   design tokens + layout grid + shared card styles
src/App.tsx, src/main.tsx      Foundation   layout shell; only Integration may edit after
src/engine/**                  Engine       elo.ts poisson.ts bracket.ts simulate.ts worker.ts usePredictions.ts __tests__/
src/map/**                     Map          MapPanel.tsx Scene.tsx CountryMesh.tsx StadiumBeacon.tsx CameraRig.tsx CityPopover.tsx projection.ts
src/panels/**                  Panels       Header.tsx MatchStrip.tsx GroupsGrid.tsx Bracket.tsx OddsPanel.tsx NewsRow.tsx panels.css
.github/workflows/deploy.yml   Integration
README.md                      Integration
```

Parallel agents (Engine, Map, Panels) may read anything but write ONLY inside their own directory. Foundation creates one stub file per parallel-owned entry component so the app compiles from day one; parallel agents replace stub internals, keeping the exported names/props identical.

## Domain model (`src/lib/types.ts`, frozen)

```ts
export type TeamId = string;                       // ESPN team id
export type Stage = 'group'|'r32'|'r16'|'qf'|'sf'|'third'|'final';
export type MatchState = 'pre'|'in'|'post';

export interface Team { id: TeamId; name: string; code: string; flagUrl: string; groupId?: string; }
export type Slot =
  | { kind: 'team'; teamId: TeamId }
  | { kind: 'placeholder'; label: string };        // raw ESPN placeholder displayName

export interface Match {
  id: string; date: string;                        // ISO
  stage: Stage; group?: string;                    // 'A'..'L' for group stage
  ordinal: number;                                 // 1-based index within its stage, by date then id
  home: Slot; away: Slot;
  homeScore?: number; awayScore?: number;
  homeShootout?: number; awayShootout?: number;
  winnerTeamId?: TeamId;                           // set when post (knockout: incl. pens)
  state: MatchState; statusDetail: string; clock?: string;
  venueId: string; venueName: string; city: string;
}
export interface GroupRow { teamId: TeamId; played: number; won: number; drawn: number; lost: number;
  gf: number; ga: number; gd: number; points: number; rank: number; noteColor?: string; noteDesc?: string; }
export interface Group { id: string; rows: GroupRow[]; }          // id: 'A'..'L'
export interface Stadium { venueId: string; name: string; city: string; country: 'USA'|'MEX'|'CAN';
  lat: number; lon: number; capacity: number; }
export interface NewsItem { id: string; headline: string; description: string; published: string;
  imageUrl?: string; link: string; }

export interface MatchProbs { matchId: string; pHome: number; pDraw: number; pAway: number;  // 90'
  pHomeAdvance?: number; }                                        // knockout only
export interface TeamOutlook { teamId: TeamId; pR32: number; pR16: number; pQF: number;
  pSF: number; pFinal: number; pChampion: number; }
export interface Predictions { asOf: string; iterations: number; elo: Record<TeamId, number>;
  matchProbs: Record<string, MatchProbs>; outlooks: Record<TeamId, TeamOutlook>; }
```

## Store (`src/data/store.ts`, frozen API)

```ts
interface WorldCupState {
  status: 'idle'|'loading'|'ready'|'error'; error?: string; lastUpdated?: string;
  teams: Record<TeamId, Team>; matches: Match[]; groups: Group[]; news: NewsItem[];
  stadiums: Stadium[]; hostGeo: GeoJSON.FeatureCollection | null;
  predictions: Predictions | null;
  focusVenueId: string | null;                       // map ⇄ UI link
  load(): Promise<void>; refresh(): Promise<void>;   // refresh = load with status kept 'ready'
  setPredictions(p: Predictions): void; setFocusVenue(id: string | null): void;
}
export const useWorldCup = create<WorldCupState>()(...);
// plain selector fns exported alongside:
export const selectLive = (s) => Match[];            // state==='in'
export const selectByVenue = (s, venueId) => Match[];
export const selectBracketRounds = (s) => { stage: Stage; matches: Match[] }[]; // r32→final order
```

`load()` fetches static files (`fetch(import.meta.env.BASE_URL + 'data/…')`) + the three ESPN endpoints, normalizes, sets state. App calls `load()` once on mount. Header's Refresh button calls `refresh()`.

## Engine (src/engine, opus)

Statistical only — NO news/sentiment inputs. Leave the seam: `adjustments.ts` exporting `applyAdjustments(elo: Record<TeamId,number>): Record<TeamId,number>` as identity, called once in the pipeline; build nothing else there.

1. **Elo** (`elo.ts`): start from `elo-seed.json` (pre-tournament snapshot). Replay all `state==='post'` matches chronologically: `R' = R + K·G·(W − We)`, K=60, `We = 1/(1+10^(−d/400))` where d includes **+100 home bonus** when the team's country equals the stadium country (MEX/USA/CAN only). Goal-diff multiplier G: 1 (margin ≤1), 1.5 (margin 2), (11+margin)/8 (≥3). Shootout result counts as W=0.5 for Elo (eloratings.net convention: draw after 90'+ET — use the 90'/120' result, i.e. draw → 0.5 each).
2. **Poisson** (`poisson.ts`): for a pairing with win expectancies `We` (home-adjusted where applicable): expected goals `λ_home = base · (We_home / 0.5)^0.85`, `λ_away = base · (We_away / 0.5)^0.85`, `base = 1.35` (≈2.7 goals/match WC average, halved). Clamp λ to [0.25, 4]. Independent Poisson over a 0..8 score grid → `pHome/pDraw/pAway` (normalize the grid). Knockout: `pHomeAdvance = pHome + pDraw · We_home_noBonus` (ET/pens approximation).
3. **Bracket parsing** (`bracket.ts`): resolve `Slot` placeholders into a tournament DAG using ONLY the fetched labels: `Group X Winner`, `Group X 2nd Place`, `Third Place Group A/B/C/…` (allowed-groups set), `<Round> N Winner` (ordinal within stage). Third-place slot assignment in sims: 8 best thirds → 8 constrained slots = bipartite matching via backtracking; if unsolvable in an iteration (shouldn't happen), fall back to rank-order assignment ignoring constraints.
4. **Monte Carlo** (`simulate.ts`, runs in `worker.ts` Web Worker, Vite `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })`): 10,000 iterations. Per iteration: sample scores for unplayed/in-progress group matches from the Poisson grid (played matches use real results); build group tables (tiebreak: points → GD → GF → head-to-head points among tied → uniform random); rank thirds (points → GD → GF → random); fill R32 via bracket.ts; sample knockout matches (winner by `pHomeAdvance`); record per team the deepest stage reached. Elo static within an iteration. Output `Predictions` (matchProbs analytic for all `pre`/`in` matches with both slots decided; outlooks from MC counts).
5. **`usePredictions.ts`**: hook mounted once in App (foundation stubs it as no-op). Effect on `[matches, teams, status==='ready']`: spawn worker, post `{teams, matches, eloSeed, stadiums, iterations: 10000}`, on message call `setPredictions`, terminate worker. Debounce trivially (one in flight at a time).
6. **Tests** (`__tests__/engine.test.ts`, vitest): probabilities sum to 1; Elo favorite gains < underdog would; higher-Elo team has pChampion advantage in a toy 4-team sim; thirds matcher solves a known-feasible case; full MC on the committed `schedule-full.json` sample fixture completes < 10 s and every group's pR32 sums to ~2 (top-2 advance) — tolerances loose.

**elo-seed.json**: build at authoring time (curl, not browser) from World Football Elo Ratings — try `https://www.eloratings.net/World.tsv` (their own data file); fallback: Wikipedia “World Football Elo Ratings” current table. Map names → ESPN team ids using `docs/api-samples/standings.json` (all 48 teams). File shape: `{ "source": "<url>", "asOf": "<date>", "ratings": { "<espnTeamId>": 2120, … } }`. A team missing from the source gets 1450 with a `"approx": ["<id>", …]` note. All 48 must be present.

## Map (src/map, opus)

`MapPanel.tsx` (DOM wrapper + `CityPopover`) → `Scene.tsx` (Canvas). Visual bar is HIGH — this is the hero.

- **Geometry**: real WebGL meshes. `projection.ts`: `d3-geo` `geoMercator().fitExtent` over the clipped hosts GeoJSON → XY plane (y flipped). Each country → `THREE.Shape[]` → `ExtrudeGeometry` slab (depth ~0.5% of width), subtle per-country tint (USA `#1d4ed8`, MEX `#15803d`, CAN `#b91c1c`, all dark/desaturated on a near-black scene, thin brighter edge line via `EdgesGeometry` or outline mesh).
- **Beacons**: one per stadium at projected lat/lon: small emissive base + vertical light pillar (cylinder, additive blending) + `drei` `Billboard`/sprite glow. States: idle (cool cyan, low intensity), has-match-today (warm amber), **live now (red-hot, pulsing scale/intensity via useFrame sine)**. Live state from store `selectLive` venueIds.
- **Post**: `@react-three/postprocessing` `Bloom` (selective-ish via emissive intensity), slight vignette. Background: transparent canvas over CSS radial gradient, plus a faint `drei` Stars or custom particle field.
- **Camera**: `drei` `CameraControls`. Idle: slow auto-drift (gentle orbit). Click beacon/city → `setFocusVenue(venueId)` + `controls.setLookAt(...)` smooth-ease to that city; `CityPopover` (DOM overlay, right side) lists that city's matches (from `selectByVenue`): flags, score/time, stage chip. Close → ease back to overview + `setFocusVenue(null)`.
- Hover: pointer cursor + floating label (`drei` `Html`) with stadium + city name.
- 16 beacons, 3 slabs — keep draw calls trivial; `dpr={[1,2]}`, no shadows.

## Panels (src/panels, sonnet)

Shared look: dark glass cards (`--panel` bg, 1px `--line` border, 14px radius), minimal text, flags everywhere (ESPN country PNGs from `Team.flagUrl`), numbers tabular-nums. All probabilities shown as compact percent bars, not prose.

- **Header**: title "WC26 · LIVE TRACKER" style lockup, tournament progress (n/104 matches, thin bar), `lastUpdated` time, Refresh button (spins while `status==='loading'`/refreshing).
- **MatchStrip**: one horizontal scroll row, ordered: LIVE (red pulsing border, clock) → today upcoming → next. Card: stage/group chip, two rows (flag, code, score or –), kickoff in local time, W/D/L tri-segment probability bar (from `predictions.matchProbs`, hidden if absent), city label. Clicking a card calls `setFocusVenue(match.venueId)` (map flies there).
- **GroupsGrid**: 12 compact cards (A–L), rows: rank, flag, code, Pts, GD; left color stripe from ESPN `noteColor` (qualification state); right edge: thin vertical advance-probability bar per team (`outlooks[t].pR32`).
- **Bracket**: SVG, columns R32→R16→QF→SF→Final (+3rd place small, below SF), built from `selectBracketRounds`. Decided slots: flag+code+score, winner bold; placeholders: dim chip with shortened label ("A1", "3rd A/B/C/D/F", "W R32-9"). Live match glows. Connector lines between rounds. Horizontal scroll on narrow screens.
- **OddsPanel**: "WHO LIFTS IT" — top 12 by `pChampion`: flag, code, animated horizontal bar (width transition on refresh), percent. Smaller secondary row of stage-reach dots optional.
- **NewsRow**: up to 8 compact cards: image (cover), headline (2-line clamp), time-ago; whole card is `<a target="_blank" rel="noopener noreferrer">` to `link`.

## App layout (foundation shell, one screen, desktop-first)

CSS grid, full-width dark page (`--bg0` `#070b14`, text `#e8eefc`, accent `#22d3ee`, live `#f43f5e`, gold `#fbbf24`; font Inter via Google Fonts link in index.html, fallback system-ui):

```
[Header                                                  ]
[Map (≈58%, min 420px tall)        | Bracket (≈42%)      ]
[MatchStrip (horizontal scroll)                          ]
[GroupsGrid (12 cards, 4 cols)     | OddsPanel           ]
[NewsRow                                                  ]
```

Stacks to single column < 1000px. Subtle page-level radial glow background. CSS only (transitions/keyframes), no animation lib.

## Build / deploy

- `vite.config.ts`: `base: './'` (works on any repo name for Pages), worker format es. Scripts: `dev`, `build` (`tsc -b && vite build`), `preview`, `test` (`vitest run`).
- `.github/workflows/deploy.yml` (Integration): on push to `main`: setup-node 24, `npm ci`, `npm run build`, `actions/upload-pages-artifact` (dist) + `actions/deploy-pages`, with `permissions: pages: write, id-token: write`. README documents: create GitHub repo → push → Settings ▸ Pages ▸ Source: GitHub Actions.

## Out of scope (do not build)

Accounts, login, betting, multi-user, auto-refresh/polling/websockets, service workers, news-aware predictions (seam only), error handling for impossible states, settings screens, i18n, light theme.

## Definition of done per agent

`npx tsc` clean via `npm run build` succeeding from repo root (with Node PATH prefix), plus your own acceptance items. Do not commit (the orchestrator commits between phases). Report deviations from this spec explicitly in your final message.

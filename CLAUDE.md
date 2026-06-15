# WC26 — World Cup 2026 Fan Dashboard

Single‑screen, visual‑first fan dashboard for the 2026 FIFA World Cup (48 teams, 12 groups,
104 matches, USA/Mexico/Canada, Jun 11 – Jul 19 2026). React + Three.js, deployed as a **pure
static site on GitHub Pages**. "Low on text, high on visuals, feels alive."

## Hard product constraints (non‑negotiable)
- **Static only.** No backend, no DB, no scheduled jobs. All data fetched client‑side at load + a
  manual Refresh button. No background polling/auto‑update.
- **No API keys; CORS‑friendly sources only.** Live data = keyless ESPN site API.
- Sports facts are **fetched or loaded from sourced static files**, never hardcoded.
- **Out of scope (do NOT build):** accounts, login, landing/profile pages, settings/customization,
  betting, multi‑user, news‑aware predictions (the engine's adjustment seam stays empty).

## Stack
Vite + React 19 + TypeScript (strict) · zustand · three + @react-three/fiber + drei +
@react-three/postprocessing · d3‑geo · **Tailwind v4** (CSS‑first `@theme` tokens) · vitest.

---

## ⚠️ Running things — Node is NOT on PATH
`npm`/`node`/`npx` are not resolvable from any shell. Use the absolute node binary:

```
C:\Users\Omer\AppData\Local\nodejs\node-v24.16.0-win-x64\node.exe
```

- **Typecheck:** `& "<node>" "node_modules\typescript\bin\tsc" -b`  (must be exit 0)
- **Tests:** `& "<node>" "node_modules\vitest\vitest.mjs" run`  (currently **44 passing**)
- **Dev server:** use the Claude **preview tools** (`preview_start` with the `hud` config in
  `.claude/launch.json`, which runs `node node_modules/vite/bin/vite.js --port 5198`). App at
  `http://localhost:5198`.
- **Build:** vite build. `vite.config.ts` has `base: './'` for GH Pages + a manual `three` chunk.

### ⚠️ The preview environment is a throttled headless tab
- rAF is throttled (~1 fps, occasional bursts); `gl.readPixels`/`drawImage` stall the pipeline;
  `preview_screenshot` captures a surface **much larger than the CSS viewport** so the app renders
  correct‑but‑small in the top‑left. The GPU is real hardware (NVIDIA via ANGLE/D3D11).
- **Consequence:** you cannot reproduce a 60 fps motion artifact (e.g. the WebGL flashing) here, and
  full‑frame screenshots are unreliable. **Use `preview_inspect` (computed geometry/styles) as the
  authoritative check** for sizes/positions/fonts; screenshots only for coarse structure. For
  per‑frame analysis, hook `gl.drawElements`/`gl.clear` counters (cheap) rather than reading pixels.
  The user is the reliable oracle for live motion behavior — ask them to verify at localhost:5198.

---

## Architecture

```
src/
  main.tsx              app entry
  App.tsx               HUD shell: grid-rows-[52px 1fr 118px], h-dvh overflow-hidden (ZERO-SCROLL)
  data/                 ── FROZEN (data layer) ──
    store.ts            zustand WorldCupState: matches/groups/teams/news/stadiums/hostGeo/
                        predictions/focusVenueId + load()/refresh()/setPredictions()/setFocusVenue()
    espn.ts             keyless ESPN fetchers (scoreboard/standings/news)
    normalize.ts        raw ESPN → frozen domain model
  engine/               ── FROZEN (prediction engine) ──
    elo.ts poisson.ts simulate.ts bracket.ts worker.ts usePredictions.ts
                        Elo replay → Poisson grids → 10k Monte Carlo in a Web Worker (~570ms)
    __tests__/          engine.test.ts, normalize.test.ts
  lib/                  ── FROZEN ── types.ts (domain types), format.ts (kickoffTime/dateLabel/timeAgo/pct)
  map/                  ── FROZEN (3D map) — see "Frozen map" below ──
    Scene.tsx CountryMesh.tsx StadiumBeacon.tsx CameraRig.tsx
    projection.ts       Lambert Conformal Conic; projectToScene(lon,lat)→[x,z] = THE single transform
    framing.ts          PURE camera-framing math (extracted for testing)
    beaconMaterials.ts MapPanel.tsx
    __tests__/          projection.test.ts (geoContains anchor tests), framing.test.ts (beacon→screen
                        clearance gate)
  panels/               ── PRESENTATION (this is the editable surface) ──
    TopBar.tsx          header: "World Cup 2026" title + progress (n/104) + Updated + Refresh
    IconRail.tsx        slim 56px left nav rail (brand mark + Home/Groups/Bracket/Odds shortcuts)
    DataDeck.tsx        left rail: STACKED sections (Groups / Bracket / Who Lifts It), each a
                        <SectionHeading> + "view all" → Theater. Exports FLOATING_PANEL.
    deck/GroupsTab.tsx  compact single-group standings + A–L pill selector
    deck/BracketSpine.tsx compact next/current-round teaser
    deck/OddsTab.tsx    top-8 champion odds (already aligned: fixed w-4/w-18/w-8 columns)
    ContextRail.tsx     right rail: VENUE / LIVE MATCHES / RELATED NEWS (focus-aware)
    NewsRow.tsx         prominent image-led news cards (84px)
    TickerDock.tsx      bottom dock: collapsed match strip ↔ expanded "All Matches" sheet
    Calendar.tsx        Jun+Jul 2026 month calendar (replaces old date-tab strip)
    Theater.tsx         z-50 modal: bracket (transform-free pan/zoom) / groups grid / odds table
    Bracket.tsx         full SVG knockout tree (foreignObject nodes; width/height 100% + viewBox)
    RailShell.tsx       responsive wrapper (≥1280 full / 1000–1279 pill+drawer / <1000 sheet)
    bits.tsx            shared atoms: TriBar, Flag, SectionLabel, SectionHeading, StatTag
    uiStore.ts          transient HUD state: tab/focusTeamId/theater/dockOpen
    hud.ts              pure helpers: stageChip, shortenLabel, formatPct, slotView, dayKey,
                        contextualNews (client-side news scoring)
  styles/global.css     Tailwind import + @theme tokens + reset (SEE Tailwind gotcha)
  panels/panels.css     hud-corners, hud-swap, keyframes (imported once from DataDeck)
public/data/            stadiums.json, hosts.geo.json, elo-seed.json (committed, sourced)
```

### Frozen layers — do NOT edit (presentation-only engagement)
`src/data/**`, `src/engine/**`, `src/lib/**`, `src/map/**` (Scene/CountryMesh/StadiumBeacon/
CameraRig/projection/framing/beaconMaterials + the map tests), `public/data/**`, build config.
Exception that's allowed: the **Legend DOM overlay** position inside `MapPanel.tsx` (NOT the `<Scene>`).
Every new surface must render gracefully when `predictions === null` (worker mid‑flight) — always
optional‑chain `predictions?.outlooks?.[id]?.pChampion` etc.

---

## Layout / design system

- **Zero‑scroll:** root is `h-dvh overflow-hidden`; the page never scrolls; panels scroll internally.
  The map is the full‑bleed **stage** (`absolute inset-0 z-0`); everything else floats over it.
- **Frozen‑map rail edges (CRITICAL invariant):** the camera framing assumes the left panel stack
  occludes the map up to **x=348px** and the right rail starts at **x=960px** (at 1280px width).
  Layout geometry: IconRail `fixed left-0 w-14` (56px) · DataDeck container `left-[68px] w-[280px]`
  (right edge 68+280 = **348**) · ContextRail container `right-3 w-[308px]` (left edge 1280−12−308 =
  **960**). Keep these edges or you silently break the frozen camera. (At 1440/1920 the right edge
  scales: 1120 / 1600; left stays 348.)
- **Aesthetic = dark neon "Stadium HUD"** (NOT the light mockups). Tokens (Tailwind `@theme`):
  `void #050608 / pitch #0B0E14 / glass`, text `chalk` (primary) / `dust` (secondary), accents
  `neon` (cyan #00E5FF) / `ember #FF7A1A` / `live #FF4655` / `gold #FFC53D`, `border-hairline`,
  `font-display` = Rajdhani. Glass panels use `FLOATING_PANEL` (exported from DataDeck.tsx).
- **Type scale (apply via utilities):** page title `font-display text-[22px] font-bold` · section
  heading = `<SectionHeading>` (13px) · sub‑label `text-[10px] uppercase tracking-[0.14em] text-dust`
  · body `text-[12px] text-chalk/85` · numeric hero `font-display tabular-nums font-bold`. Standard
  list‑row height `h-7`; comfortable padding (`p-3.5`); never flush to edges.

---

## ⚠️ Hard‑won gotchas (read before editing)

1. **Tailwind v4 reset layering (FIXED — keep it):** an *unlayered* `*{margin:0;padding:0}` reset
   beats Tailwind's *layered* utilities, silently zeroing **every** `p-*`/`m-*` app‑wide. The reset
   in `global.css` is now wrapped in `@layer base { … }`. Do not un‑wrap it. (This was the root cause
   of the original "cramped / text flush to edges" complaints.)
2. **WebGL flashing (fix applied, PENDING USER VERIFICATION):** transparent canvas + EffectComposer
   dropped intermittent black frames during camera motion. Fix in `Scene.tsx`: `alpha:false` +
   opaque `<color attach="background" args={['#080d18']}/>` + `<EffectComposer multisampling={0}>` +
   `<SMAA/>` + `antialias:false`. Cannot be reproduced in the headless preview — the user must
   confirm at localhost:5198 during real pan/zoom/rotate. If it persists, ranked fallbacks:
   drop `mipmapBlur` on Bloom → remove manual `controls.update()` in CameraRig → rework bloom.
3. **Map transform is ONE chain (don't re‑introduce splits):** countries and beacons must land at the
   same world point. `projectToScene` is the single source; `CountryMesh` uses `geo.rotateX(+π/2)`
   (NOT −π/2 — that negated Z and flipped beacons N–S vs the landmass). Camera azimuth = 0 (south,
   looking north) → north‑up / east‑right. `framing.test.ts` projects every beacon and asserts it
   clears the rails; `projection.test.ts` runs geoContains anchoring. Keep both green.
4. **Bracket pan (FIXED — keep transform‑free):** `Theater.tsx` `BracketStage` pans via container
   `scrollLeft/scrollTop` and zooms by resizing an inner box (the `<Bracket>` svg rescales via its
   `viewBox`). NEVER put a CSS `transform` on a `<foreignObject>` ancestor — that blanks the bracket
   to black in Blink during drag (the original bug).

---

## Current status (uncommitted working tree — nothing committed this engagement yet)
Done & verified (tsc 0, 44 tests): LCC map orientation + beacon anchoring + clearance gate;
Tailwind padding fix; HUD overhaul to the mockup layout (icon rail, stacked deck, sectioned rail,
prominent news, Calendar, header title, legend relocation); bracket pan fix.

Applied, pending **user** check at localhost:5198: the WebGL flashing fix; and the latest
mockup‑alignment pass — collapsed ticker → centered floating pill + single‑line GRP chip + larger
cards; "All Matches" sheet → Calendar moved to a right column + larger match cards + numeric W/D/L
win % on the bars; Theater odds table → bars share a uniform X column; Full Bracket → smaller modal
(`w-[min(980px,92vw)] h-[82vh]`) + fit‑to‑width initial zoom (vertical pan acceptable).

Work has been presentation‑only; the data/engine/map‑math layers are trustworthy and frozen.

# handoff.md
## WC26 — FIFA World Cup 2026 Fan Dashboard
**Document type:** Engineering & design handoff
**From:** Exiting Lead UX/UI Architect
**To:** Incoming UI / WebGL development team
**Status of codebase at handoff:** Reverted to the clean, functional baseline (pre-HUD-refactor). Data, engine, and 3D layers are working; presentation layer is the scope of your engagement.

---

## 1. Project Context

WC26 is a **single-screen, visual-first fan dashboard** for the 2026 FIFA World Cup (48 teams, 12 groups, 104 matches, USA/Mexico/Canada, June 11 – July 19 2026). It is built for fans, not analysts — the brief is "low on text, high on visuals, feels alive."

**Hard architectural constraints (non-negotiable, they shaped everything):**
- **Pure static site.** No backend, no database, no scheduled jobs. It deploys to **GitHub Pages** as a browser-only app.
- **All data fetched client-side at load**, plus a manual Refresh button. No background polling, no auto-update.
- **No API keys, CORS-friendly sources only** (there is no server to hide a key behind).
- Sports facts are **fetched or loaded from sourced static files**, never hardcoded.

**Current functional state (what works and must be preserved):**
- **Stack:** Vite + React 19 + TypeScript (strict), zustand store, three + react-three-fiber + drei + postprocessing, d3-geo, vitest.
- **Data layer:** Live data pulls from the keyless ESPN site API (scoreboard / standings / news), normalized into a frozen domain model. A zustand store exposes `matches` (all 104), `groups` (12), `teams`, `news`, `stadiums`, `hostGeo`, `predictions`, plus `focusVenueId` and `load()/refresh()/setFocusVenue()`.
- **Prediction engine:** Elo (replayed from a sourced pre-tournament seed) → Poisson match grids → a **10,000-iteration Monte Carlo** tournament simulation running in a **Web Worker** (~570 ms). Produces per-match W/D/L probabilities and each team's advance/championship odds. 34 vitest checks pass.
- **Static sourced data (committed):** clipped Natural Earth host-country GeoJSON, 16 stadium coordinates, Elo seed — each carries a `source` field.
- **Functional UI today:** header + refresh, a horizontal match strip, 12 group tables, an SVG knockout bracket, a championship-odds chart, a news feed, and a 3D host-cities map with stadium beacons.

**The dashboard is technically complete. It is not yet fan-grade.** Your mandate is to transform a working data tool into an immersive experience without disturbing the data, engine, or deployment model beneath it.

---

## 2. Core Directives

Three mandates were agreed and are the heart of this engagement.

### Directive A — The "Zero-Scroll" Architecture
The entire dashboard **must fit one screen with zero vertical page scrolling** at desktop sizes (target floor 1280×800). The page shell is `100dvh` with `overflow: hidden`; a page-level scrollbar must never appear.

The structural pivot: the **3D map becomes the full-bleed "stage,"** and all data UI becomes **floating HUD layers above it** rather than stacked rows. Density is absorbed through **tabs, slide-up sheets, and pop-out overlays — never through page height:**
- A **left "Data Deck"** tabbing between Groups, Bracket, and Odds.
- A **right "Context Rail"** that is selection-aware and houses **contextual news side-by-side with the relevant component** (relevance scored client-side over the already-fetched articles), eliminating the detached bottom news feed.
- A **bottom ticker dock** for matches that expands into a full-schedule sheet on demand.
- A **theater overlay** for the full knockout bracket, which cannot honestly fit a rail.

### Directive B — WebGL Map & Beacon Math (precision over approximation)
Treat the spatial mapping with **CAD-level discipline: coordinates are mathematically sound projections, not flat approximations.**
- **Adopt a conic projection (Lambert Conformal Conic)** with standard parallels bracketing the 16 cities and a central meridian on the continental spine. Mercator is wrong for a mid-latitude continent (it over-stretches Canada); conic keeps shape and bearing true across the host nations.
- **One projection instance, one transform chain.** Country meshes and stadium beacons must derive from the **same** `project(lon,lat)` under a **single** scene parent. No component computes its own world position; no second `fitExtent`; no per-element axis flip.
- **Frame the cities, not the polygons** (`fitExtent` on the padded stadium extent), and fix the camera tilt so geography is no longer foreshortened into a pancake.
- **Beacons must be accurately anchored and verifiable** — every stadium must pass a point-in-polygon test against its own country. Anchoring is *tested*, not eyeballed.
- Beacons should be **sleek instruments, not blobs**: a slab-anchored pulse ring, a non-billboarded vertical needle, and a single HDR-emissive tip, with bloom tuned (`luminanceThreshold ≈ 1.0`) so **only** beacons and coastline edges glow. State-driven: idle (cyan) / today (ember) / live (red, pulsing).

### Directive C — The High-Contrast "Fan-First" Aesthetic
Pivot from the sterile gray/blue grid to an **immersive, high-energy "Stadium HUD"** language in the spirit of Valorant / Forza:
- **Deep blacks with restrained neon** (cyan + ember accents, red reserved exclusively for live, gold for champion odds). ~95% matte surface, ~5% neon — glow is *information*, not decoration.
- **Subtle glassmorphism:** floating, blurred, hairline-bordered panels with soft elevation and optional HUD corner-brackets on active panels. **Remove the harsh boxed grid and visible seams** — the stage shows through.
- **Numbers are heroes:** a squared display typeface for scores, percentages, and group letters; micro uppercase letter-spaced labels; tabular numerals throughout.
- **Motion signals state, not idle decoration:** quick eased transitions, animated probability bars, live pulses, and number micro-flips — all respecting `prefers-reduced-motion`.

---

## 3. Known Limitations (baseline issues to resolve)

These are the concrete defects in the reverted baseline that the overhaul must clear:

**Layout / structure**
- The dashboard reads as a **dense, corporate database**: five full-width stacked rows of equal visual weight.
- It **requires vertical scrolling** — roughly two viewports tall; Groups and News sit below the fold, defeating the single-screen brief.
- The bracket is given a slot it cannot fit and **truncates mid-column**.
- **News is a detached bottom feed** with loose relevance to anything the user is looking at.

**WebGL geometry**
- The North American map is **vertically squashed** — caused by camera foreshortening, Mercator latitude stretch, and a hard bounding-box clip that manufactures an artificial straight border across Canada.
- **Beacons are mis-anchored** (two render offshore in the Pacific) and **look amateurish** — oversized gaussian blobs from an over-eager bloom pass, plus one stray streak from a pillar receiving billboard rotation. The geometry and beacons do **not** share a transform chain.

**Data presentation bugs**
- **Group rows are not sorted by rank** (they render in feed order).
- **Unplayed matches show "0 – 0"** instead of a neutral placeholder.
- The header progress bar is effectively **invisible** against its track.

**Aesthetic**
- Flat slate-gray panels, hairline boxes everywhere, uniform visual hierarchy — **no energy, no focal point, no sense of a live event.**

---

## 4. Strategic Roadmap

High-level approach for the overhaul. This is presentation-layer surgery on a healthy patient — sequence the work to protect what already functions.

**Phase 0 — Lock the invariants.**
Before touching anything, treat these as frozen: the **store API, the prediction engine and worker protocol, the normalize layer, the static sourced data files, and the ESPN endpoints.** Every new surface must still render gracefully when `predictions` is `null` (the worker is mid-flight) and must respect the out-of-scope list (no accounts, no betting, no auto-refresh, no news-aware predictions — the engine's adjustment seam stays empty). Contextual news is **client-side filtering of the existing feed**, not a new data source, so the keyless/static/Pages constraints stay intact.

**Phase 1 — Establish the design system first.**
Stand up the color tokens, typography, glass/panel recipes, chip and bar primitives, and the motion curve **before** rebuilding screens, so every component is restyled against one source of truth. Decide the styling vehicle up front (utility framework vs. the existing CSS-variable system — the aesthetic recipes map cleanly onto either).

**Phase 2 — Re-architect the shell for zero-scroll.**
Build the HUD layer model — stage + left Data Deck + right Context Rail + ticker dock + theater overlay — as empty, correctly-sized, `100dvh` containers. Prove zero-scroll at the 1280×800 floor with placeholder content before migrating real panels in. Define the responsive collapse behavior (rails → icon strips → drawers) at this stage.

**Phase 3 — Fix the WebGL foundation (math before polish).**
Replace the projection with the conic model, consolidate to a single transform chain, and **commit the point-in-polygon anchor tests** as the correctness gate. Only once anchoring and projection are provably right should the team invest in beacon shaders, bloom tuning, camera framing, and the ground-fade. Resist the temptation to "polish" a geometry that is still mathematically wrong.

**Phase 4 — Migrate panels into the HUD and clear the defect register.**
Move Groups (rank-sorted), Bracket (spine + theater), Odds, and the ticker (placeholder for unplayed scores) into their HUD homes; wire the Context Rail to selection state and implement contextual-news scoring. Retire the bottom feed.

**Phase 5 — Verify against the brief.**
Confirm zero vertical scroll across the supported breakpoints, validate the map visually and via the anchor tests, exercise the `predictions === null` path, confirm Refresh re-runs the pipeline, and re-run the engine's vitest suite to prove the presentation overhaul left the data and simulation layers untouched.

**Guiding principle:** the data and the simulation are already trustworthy — your job is to make a fan *feel* the tournament. Lead with the map as hero, let neon carry meaning rather than fill space, and measure every structural decision against the single-screen, fan-first mandate.

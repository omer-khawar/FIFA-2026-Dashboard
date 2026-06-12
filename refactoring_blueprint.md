# refactoring_blueprint.md
## WC26 Dashboard — Structural & Aesthetic Refactoring Blueprint
**Role:** Lead UX/UI Architect & Creative WebGL Director
**Inputs:** Screenshots `image_2818dd.jpg` / `image_2818db.jpg`, current codebase (Vite + React 19 + TS, vanilla-CSS tokens, r3f map, zustand store)
**Verdict:** The build is data-complete but presentation-broken. It reads as a BI tool: five stacked full-width rows forcing ~2 viewports of scroll, a geographically distorted map with blob-like beacons, and a flat slate-gray card grammar with zero energy. Everything below is a re-architecture of *presentation only* — the store, engine, and data layer are correct and must not change shape.

---

## 0. Executive Diagnosis (what the screenshots show)

| # | Observation | Root cause | Severity |
|---|---|---|---|
| D1 | Page is ~2 viewports tall; News/Groups below the fold | Stacked-row CSS grid; no z-axis (overlay) usage | Blocker |
| D2 | Map is vertically squashed; Canada's top edge is an artificial straight line | Camera foreshortening (~50% N–S compression at current tilt) + Mercator stretch + hard bbox clip at lat 53° | Blocker |
| D3 | Beacons are oversized gaussian blobs; two sit offshore in the Pacific; one stray diagonal streak near Texas | Bloom threshold < 1.0 with LDR colors; beacon transform chain not shared with country meshes; a pillar receiving billboard rotation | Blocker |
| D4 | Group cards list rows in feed order, not rank (Group A renders 1,3,2,4; Group I renders 4,1,2,3) | Rows never sorted by `row.rank` before render | High |
| D5 | Upcoming matches display "0 — 0" | Score rendered for `state === 'pre'` instead of "–" | High |
| D6 | Bracket R32 column truncated mid-list; placeholders dominate visual weight | Bracket given a fixed card slot it can't fit; no pop-out | High |
| D7 | News is a detached bottom feed; relevance is loose (e.g. driverless-taxi feature) | No contextual binding to selection state | Med |
| D8 | Overall grammar: boxed gray panels, visible seams, identical visual weight everywhere | Token palette too timid; `.card` grid with hairline borders everywhere | Med |

---

## 1. The "Zero-Scroll" Architecture

### 1.1 Viewport contract
- Shell: `height: 100dvh; overflow: hidden` on `#root`'s single child. **No page scrollbar may ever exist.** Internal panels own their scroll (`overflow-y: auto`, `overscroll-behavior: contain`).
- Layout grid (desktop ≥1280px):
  ```
  grid-template-rows: 52px 1fr 118px;   /* TopBar / Stage / Ticker Dock */
  grid-template-columns: 1fr;            /* the Stage is full-bleed */
  ```
- Density budget @1440×900: TopBar 52 + Dock 118 → Stage = 730px tall. Left rail 416px + right rail 360px float **over** the stage, leaving ≥650px of clear map center. Verified minimum target: 1280×800 (rails shrink to 360/320; type scale clamps down).

### 1.2 The HUD layer model (this is the core structural pivot)
The 3D map stops being "a card in row 2" and becomes the **stage** — a full-bleed canvas behind everything. All data UI becomes floating HUD layers above it:

```
z0  Stage        — r3f Canvas, absolute inset-0 (within the middle grid row)
z10 Left Rail    — "DATA DECK": tabbed Groups | Bracket | Odds
z10 Right Rail   — "CONTEXT": selection-aware details + contextual news
z20 Ticker Dock  — bottom match strip (also a slide-up sheet)
z30 Theater      — modal overlays (full bracket / full group / full odds)
z40 TopBar       — brand, progress, refresh
```
Nothing is "below" anything; density is handled by *tabs, sheets, and pop-outs*, never by page height.

### 1.3 Left Rail — the Data Deck (tabs)
- Segmented control header: `GROUPS · BRACKET · ODDS` (single active tab; 200ms slide+fade swap; keyboard ←/→).
- **GROUPS tab:** 12 groups don't fit a 416px rail at once. Use a vertical scroll-snap carousel: pages of 4 group micro-cards (2×2), `scroll-snap-type: y mandatory`, with an A–L letter jump-rail pinned on the panel edge (click = `scrollIntoView`). Rows inside each card: rank-dot, flag, code, Pts, GD, advance-prob micro-bar — **sorted by `rank`** (fixes D4). Clicking a team pins it into the Context Rail.
- **BRACKET tab:** a 5-column tree cannot live honestly in a rail (D6). Two-tier strategy:
  - In-rail: a vertical "knockout spine" — rounds as collapsible sections (R32…Final), each match a one-line node (flags/codes/score or dim placeholder chip). Live nodes glow.
  - `⤢ FULL BRACKET` button → **Theater overlay** (z30): 92vw × 84vh glass panel, the existing SVG tree with `touch-action: none` pan + wheel zoom (transform on an inner `<g>`), Esc/✕ to close. This is where the full tree breathes.
- **ODDS tab:** the "WHO LIFTS IT" list, full 48-team scrollable (top 12 above an internal fold), bars animated on refresh.

### 1.4 Right Rail — the Context Rail (kills the bottom news feed)
A single stateful panel driven by existing store state (`focusVenueId`, plus a new transient `focusTeamId` UI-state — presentation state only, not data):
- **Nothing focused →** "NOW & NEXT": live matches (with W/D/L tri-bars), next 3 kickoffs, then 3 compact headline rows.
- **City focused** (map beacon or ticker card click) → stadium identity block (name/city/capacity), that venue's match list, then **contextual news**.
- **Team focused** (click in Groups/Odds) → team header (flag, Elo, pChampion trend), their remaining fixtures, then contextual news.
- **Contextual news = client-side relevance scoring** over the already-fetched ESPN articles (no new sources, keyless constraint intact):
  ```
  score(article, ctx) = 3·(team name in headline) + 1·(team name in description)
                      + 2·(city/stadium name in headline∨description)
  → sort desc, take 4; if all scores 0, fall back to 4 most recent.
  ```
- News card form factor: 64px row — 56×42 thumb, 2-line clamped headline, time-ago. Whole row is the outbound `<a>`. The bottom-of-page news band is **deleted**.

### 1.5 Ticker Dock (bottom, 118px)
- Keeps the horizontal match strip — it is the most HUD-native element we have (works like a race-position strip). Order: LIVE → today → upcoming. Auto-scroll to first live card on load.
- Card fixes: kickoff matches show `–` not `0` (D5); score only for `in|post`; live cards get the pulse treatment (§3.6).
- **Slider behavior:** the dock is a snap-sheet. Drag handle / chevron expands it to a 58vh overlay (z20) showing the full 104-match grid grouped by day with a date jump-strip — then snaps back. `scroll-snap-points` + `transition: height 280ms cubic-bezier(.16,1,.3,1)`. This is the "see everything" valve that zero-scroll requires.

### 1.6 TopBar
52px: WC26 lockup (display face, §3.3) · stage progress (n/104, 2px neon bar — current one is invisible) · last-updated · Refresh (icon spins while in flight). Center: nothing. Right-aligned controls. No card chrome — it floats on the stage gradient.

### 1.7 Breakpoints
- ≥1280: full HUD as above.
- 1000–1279: rails collapse to 48px icon strips (⊞ groups, ⑂ bracket, 🏆 odds, ◎ context); tapping flies out the panel as an overlay drawer (same components, `position: absolute`, slide-in 220ms).
- <1000: zero-scroll mandate is desktop-scoped; rails become bottom sheets stacked behind the dock. Map remains the stage. (State this as an accepted scope decision.)

---

## 2. WebGL Map & Beacon Math

### 2.1 Why it looks squashed — three compounding factors, with numbers
1. **Camera foreshortening (dominant).** Viewing a ground plane at polar angle θ (from vertical), apparent N–S scale ≈ `cos θ`. The current framing reads as θ ≈ 55–60° → the continent is rendered at ~50–58% of its true depth. That alone produces the "pancake" look.
2. **Mercator latitude stretch.** Mercator vertical scale ∝ `sec φ`: 1.04 at Mexico City (19°N) vs 1.66 at the 53°N clip line. Canada is projected ~60% "taller per degree" than Mexico, so when the camera compresses depth, the distortion is uneven and reads as "wrong" rather than "stylized".
3. **The bbox clip.** Slicing rings at lat 53 manufactures a straight artificial top border (the flat red line in the screenshot). Real geography has no ruler lines.

### 2.2 The projection fix — Lambert Conformal Conic (CAD-grade choice)
Mercator is the wrong tool for a mid-latitude continent. The cartographic standard for North America is a **conic** projection. Adopt:

```ts
// src/map/projection.ts — single instance, exported once
geoConicConformal()
  .parallels([17.5, 49.5])   // standard parallels bracketing all 16 cities
  .rotate([96, 0])           // central meridian 96°W (continent spine)
  .fitExtent([[pad, pad], [W - pad, H - pad]], stadiumExtentFeature)
```
- `stadiumExtentFeature` = convex hull (or simple bbox) of the **16 stadium coordinates** padded 6–8%, *not* the country polygons. Frame the cities; let geography be the backdrop.
- Between its standard parallels, LCC distortion is <≈2.5% across our extent — shapes and bearings read true ("looks like the map in your head"), and Canada's border curves naturally.
- Equirectangular is acceptable only with `scale ∝ cos(φ₀)` aspect correction and still smears Canada; Mercator stays wrong here. LCC is the answer; document it as such.

### 2.3 One transform chain — the anchoring contract (fixes offshore beacons)
Rule: **exactly one** projection instance and **exactly one** spatial parent.
```
project(lon, lat) → [px, py]                  (d3, y grows "down"/south)
scene:   x = (px − cx) · s,   z = (py − cy) · s   (XZ ground plane, +Y up)
<group name="mapRoot">  ← the ONLY transform (if Extrude requires a rotateX,
                            it lives here, once, and EVERYTHING is its child)
  ├── CountryMesh ×3   (shapes built from project())
  └── StadiumBeacon ×16 (positioned from the same project(); base y = slabDepth)
```
- No child computes its own world position; no second `fitExtent`; no per-component y-flip. The offshore blobs and the mirror-risk both die here.
- Beacon base sits at `y = extrudeDepth` (on the slab's top face), not 0 — eliminates the "floating halo" detachment.
- **Anchor verification table (commit as a vitest spec):**

  | Anchor | lon, lat | Assertion |
  |---|---|---|
  | Estadio Banorte | −99.13, 19.43 | point-in-polygon: MEX feature |
  | BC Place | −123.11, 49.28 | NW of Lumen Field (x smaller, z smaller) |
  | Gillette | −71.26, 42.09 | easternmost beacon |
  | SoFi vs Levi's | — | Levi's strictly NW of SoFi |

  All 16 must pass point-in-polygon against their own country's feature. This is the CAD discipline: projected coordinates are *tested*, not eyeballed.

### 2.4 Camera & lens
- **Polar angle ≤ 40°** (elevation ≥ 50°): N–S compression `cos 38° ≈ 0.79` — a cinematic tilt that no longer lies about geography.
- **Long lens:** FOV 22–26°, dolly back to fit (distance `d = (extentDepth/2) / tan(FOV/2)` against the fitted extent). Narrow FOV minimizes perspective convergence → the "tilt-shift premium miniature" look instead of fisheye sprawl.
- Default target: stadium-extent centroid nudged ~4% north (visual mass balance). Idle drift: ±4° azimuth sine, 30s period. City focus: `setLookAt` ease 1.2s, dolly to ~12% extent width. Clamp user zoom/rotate to [overview, city] range.

### 2.5 Geometry hygiene
- **Delete the bbox clip.** Keep full country polygons; drop only *non-contiguous* polygons by centroid filter (Alaska: centroid lon < −141 ∨ lat > 60; Hawaii: lon < −150 ∧ lat < 25; arctic islands: lat > 60). Filtering whole polygons is a data decision; slicing rings is mutilation.
- Composition crops the far north via framing, plus a **radial ground-fade**: a shader or vertex-alpha falloff from the stadium-extent centroid (`alpha = smoothstep(rMax, rMid, dist)`) so Canada dissolves into the void instead of terminating.
- Slab styling: matte near-black fills tinted per country (keep hue identity, drop saturation: USA `#0E1C3A`, MEX `#0E2A1C`, CAN `#2A0F14`), `EdgesGeometry` line on top in the country accent at emissive ~1.3 so bloom traces the coastlines as thin neon — the map itself becomes the HUD's biggest line-art element.

### 2.6 Beacon redesign — from blobs to instruments
Current failure: LDR colors + low bloom threshold → bloom amplifies *everything*, producing 60-px gaussian splats (and hiding the actual geometry). The streak is a pillar that received billboard rotation.

Per-stadium stack (all children of `mapRoot`, sizes relative to map width `M`):
1. **Anchor ring** — flat annulus on the slab, outer r ≈ 0.008·M. Shader ripple: `d = dist(uv,.5)·2; w = fract(d − t·0.4); alpha = smoothstep(.15,.0,abs(w−.5))·(1−d)` — a radar pulse expanding outward, period 2.4s.
2. **Needle pillar** — vertical thin cylinder (or two crossed planes), height ≈ 0.05·M, additive, fragment alpha `pow(1 − uv.y, 2.2)` so it dissolves upward. **Never billboarded; Y-up in local space** (kills the streak).
3. **Tip core** — 8-triangle icosahedron, `emissiveIntensity` 2–6 (HDR). This is the only thing bloom should bite.
4. **Hover** — drei `Html` label (stadium · city), cursor pointer, ring brightens.

State machine (driven by existing store selectors):

| State | Color | emissive | Motion |
|---|---|---|---|
| idle | `#00E5FF` | 1.6 | ripple only |
| today | `#FF7A1A` | 2.4 | ripple ×1.5 speed |
| LIVE | `#FF4655` | 3 + 2·sin(t·4) | ripple ×2 + pillar height pulse ±15% |

**Bloom pipeline (the actual fix):** ACES tone mapping; `<Bloom mipmapBlur intensity={0.7} luminanceThreshold={1.0} luminanceSmoothing={0.2} />` + `<Vignette offset={0.3} darkness={0.85} />`. With threshold at 1.0, only emissive>1 surfaces glow: beacon tips, coastline edges, live pulses. Everything else stays matte. Glow becomes *information*, not fog.

### 2.7 Performance guardrails
16 beacons → merge ring/pillar materials (shared ShaderMaterial, per-instance uniforms or InstancedMesh attributes); one EffectComposer pass; `dpr=[1,2]`; no shadows, no real point lights (emissive+bloom only); all geometry `useMemo`'d off `hostGeo`/`stadiums`. Frame budget unchanged (≈3 slabs + 48 small meshes).

---

## 3. The "Fan-First" Aesthetic — "Stadium HUD" design language

### 3.1 Principles (Valorant/Forza grammar)
1. **95% matte, 5% neon.** Neon is only for: live state, interactive focus, data lines. Large surfaces are near-black glass.
2. **No boxed grid.** Panels float; seams disappear; the stage shows through everywhere.
3. **Numbers are heroes.** Scores, percentages, Elo — big, tabular, display-face. Labels are micro, uppercase, letter-spaced.
4. **Motion = state change only.** Nothing idles except live pulses and the map.

### 3.2 Color system
Adopt Tailwind v4 (CSS-first) so tokens stay single-source; current CSS vars map 1:1 during migration:
```css
@import "tailwindcss";
@theme {
  --color-void:  #050608;   /* page base */
  --color-pitch: #0B0E14;   /* panel base under glass */
  --color-glass: rgb(13 16 24 / 0.55);
  --color-hairline: rgb(255 255 255 / 0.06);
  --color-neon:  #00E5FF;   /* data / interactive / home-win */
  --color-ember: #FF7A1A;   /* energy / today / away-win */
  --color-live:  #FF4655;   /* live only — never decorative */
  --color-chalk: #EAF2FF;   /* primary text */
  --color-dust:  #7E8AA3;   /* secondary text */
  --color-gold:  #FFC53D;   /* champion odds accents */
}
```
Page background is layered, not flat: `bg-void` + two radial floodlight gradients (top-center cyan at 4% alpha, bottom-right ember at 3%) + a 3% noise texture (data-URI) to kill banding.

### 3.3 Typography
- **Display/numerals:** Rajdhani (or Chakra Petch) 600/700 — squared esports voice for the lockup, scores, percentages, group letters.
- **Data/body:** keep Inter. `font-variant-numeric: tabular-nums` globally.
- Micro-labels: `text-[10px] font-semibold uppercase tracking-[0.2em] text-dust`.
- Fluid scale so zero-scroll survives laptop sizes: e.g. score `text-[clamp(15px,1.15vw,18px)]`.

### 3.4 Surface recipes (exact classes)
- **Floating panel (rails, theater):**
  `rounded-2xl border border-hairline bg-glass backdrop-blur-xl shadow-[0_8px_40px_rgb(0_0_0/0.5),inset_0_1px_0_rgb(255_255_255/0.04)]`
- **HUD corner brackets** (the Valorant signature — use instead of clip-path notches, which fight rounded corners): `::before/::after` 10×10px L-shapes, `border-neon/60`, top-left + bottom-right, shown on `:hover` and `[data-active]` panels only.
- **Active-panel edge:** `border-l-2 border-l-neon` + `shadow-[0_0_24px_-12px_var(--color-neon)]`.
- **Chip:** `inline-flex items-center gap-1 rounded-[4px] bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-dust`
- **Live chip:** `bg-live/15 text-live shadow-[0_0_12px_rgb(255_70_85/0.35)]` + pulse keyframe (§3.6).
- **Tab (segmented):** base `flex-1 py-1.5 text-[11px] uppercase tracking-[0.16em] text-dust transition-colors` · active `data-[active=true]:text-neon data-[active=true]:bg-neon/10 data-[active=true]:shadow-[inset_0_-2px_0_var(--color-neon)]`
- **W/D/L tri-bar:** `flex h-1 overflow-hidden rounded-full bg-white/5` with segments `bg-neon` / `bg-white/15` / `bg-ember`, widths = probabilities, `transition-[width] duration-700`.
- **Odds bar:** track `h-[5px] rounded-full bg-white/5`, fill `bg-gradient-to-r from-neon to-gold shadow-[0_0_10px_rgb(0_229_255/0.35)]`, leader row gets the gold end and a crown-free rank numeral (no emoji in HUD; use the display face).

### 3.5 Component restyle notes
- **Ticker card:** chip row (stage + city) → two team rows (24px flag, code in display face, score or `–`) → tri-bar footer. Live card: `border-live/40` + pulse ring. Width 188px, `scroll-snap-align: start`.
- **Group micro-card:** group letter as oversized 28px display glyph watermark behind rows; qualification stripe stays (ESPN `noteColor`) but as a 2px inner-left bar, not a hard border.
- **Bracket node:** transparent fill, hairline outline; decided winner row `text-chalk` + neon left tick; placeholders `text-dust/60 italic`; connectors `stroke-white/8`, live path `stroke-live` with 6px glow filter.
- **Refresh:** icon-first button, `border-hairline hover:border-neon/40 hover:text-neon`; spinner = the icon itself rotating, no layout shift.

### 3.6 Motion system
- Curve: `cubic-bezier(0.16, 1, 0.3, 1)`; durations 150ms (hover) / 220ms (tab, drawer) / 280ms (sheet) / 700ms (bars).
- `@keyframes pulse-live`: box-shadow `0 0 0 0 rgb(255 70 85/0.4)` → `0 0 0 8px transparent`, 1.6s infinite.
- Number changes (scores, %) micro-flip: old value `translateY(-6px) opacity-0`, new in from `+6px`, 180ms.
- Honor `prefers-reduced-motion`: kill drift, ripples, pulses; keep state colors.

---

## 4. Defect register to clear during the refactor
1. **Sort group rows by `rank`** before render (D4 — visible in Groups A, I).
2. **`–` for unplayed scores**; numerals only when `state ∈ {in, post}` (D5).
3. Bracket truncation eliminated by spine + theater pattern (D6).
4. Beacon mis-anchoring + streak: single transform chain (§2.3) + non-billboarded pillars (§2.6).
5. Remove bbox ring-clip; centroid-filter whole polygons instead (§2.5).
6. TopBar progress bar: 2px neon on hairline track — currently illegible.
7. News relevance scoring + Context Rail placement (§1.4) retires the misfit bottom feed.
8. Odds bars: normalize to leader but print the % beside every bar (already present — keep 1-decimal <10%).

## 5. Invariants — do not touch
- Store API, engine, worker protocol, normalize, static data files, ESPN endpoints: **unchanged**. This is a presentation-layer refactor; `predictions` may still be `null` mid-flight and every new surface must degrade gracefully exactly as today.
- Static/keyless/GitHub-Pages constraints stand: contextual news is client-side filtering of the existing feed; no new APIs.
- Out-of-scope list from SPEC.md §"Out of scope" remains binding (no auto-refresh, no accounts, no news-aware predictions — the `adjustments.ts` seam stays empty).
- Only sanctioned dependency change: Tailwind v4 (+ the two display fonts via Google Fonts). If dependency budget is vetoed, every recipe in §3 maps 1:1 onto the existing CSS-variable system — classes become utility-equivalent rules in `panels.css`.

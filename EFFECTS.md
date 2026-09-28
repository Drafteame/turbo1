# Effects catalog — One Click Bet (buttonPreviewMomios baseline)

A running list of every animation, microinteraction, transition, and motion behavior in the prototype. Grouped by tier (each tier is **additive** on top of the lower tiers), then by **cross-cutting** sections (tier-crossing flourishes, bet-slip lifecycle, accessibility).

> ⚠️ **On `main`, the progression system is currently OFF.** The master switch `cfg.animationsEnabled` (in `src/buttonProgressionConfig.ts`) is set to `false`, so **every effect catalogued below is suppressed** — the button renders static. Only the slip's entry/exit mount transition and the per-digit number rolls still play. Everything documented here still describes the intended behavior when the switch is flipped back to `true`; the fully-animated version is snapshotted on the `bet-slip-progression` branch. See the "Master switch" section at the bottom.

> Keep this file in sync. Whenever an effect is added, removed, retuned, or moved between tiers, update the relevant section here in the **same commit**.

> Conventions used below:
> - **Ambient** = always running while the tier is active (loop, frame-driven, or CSS-keyframe).
> - **On-event** = fires in response to a user action (mostly selection add/remove).
> - **One-shot** = fires once on a specific transition (tier crossing, mount/unmount, etc.).
> - "T*N*+" means inherited at every higher tier; "T*N* only" means exclusive to that tier.

---

## T0 — Default *(odds < 2.00x)*

**Static styling**
- Flat `#191919` background, 1px static `#4b20ff` border, `linear-gradient(58.9°, #4b20ff → #9730ff)` Gana CTA.

**Always-on at any tier**
- **Slot-style per-digit counter** *(ambient + on-update)* — selection count and odds animate per character. Digits that change unmount/remount with vertical slide+fade; static glyphs (`.`, `x`, `$`, ` `) don't animate. Stable per-position key (`{i}-{value}`) so React only re-renders the changed glyphs.
- **Press feedback** *(on-event)* — scale `0.97` on press, spring back on release (Framer Motion `whileTap`).
- **Anticipation compress** *(on-event)* — `0.99` scale, 40ms, immediately before each slot roll. Gives digits physical weight.
- **Settle overshoot** *(on-event, microinteraction d)* — after a slot lands, the digit briefly overshoots to `1.04` scale (120ms) before settling. Driven by `oddsSettleControls`.
- **Recoil** *(on-event)* — on every selection add OR remove (after the initial 0→1 mount), the slip is pushed down 4px and springs back with bounce (stiffness 260, damping 14, mass 0.7).

**On selection add (T0–T2 — suppressed at T3+)**
- **Center radial burst** — a white outline ring (`box-shadow: 0 0 0 1.5px rgba(255,255,255,0.8)`) radiates from the button center, scaling from 1px → 60px while fading to 0 over 500ms (ease-out). Active at T0/T1/T2; **suppressed at T3+** because the OddsRipple + outline ripple cover the same on-add feedback role there.

## T1 — *Intermedio* *(≥ 2.00x)*

- **Ambient breathing** *(ambient, microinteraction e)* — soft sine inhale/exhale, `1.000 → 1.008 → 1.000` on the slip. Period **4000ms** at T1 (scales per tier — see comparison table).
- **Count badge pulse** *(on-event)* — the Bets number's `text-shadow` flashes purple briefly whenever `selectionCount` changes (~1.4× of base). Driven by Framer Motion `animate` keyed on count.
- **Edge-flash sparkles** *(ambient)* — small white circles flash at random points around the perimeter. T1 cadence: 1–2 per burst every 8000ms (700ms lifetime each). Density scales per tier — see table.

## T2 — *Súper* *(≥ 5.00x)*

**Ambient**
- **Background crossfade** *(transition at T1↔T2)* — a `linear-gradient(to right, #14083d → #230c3e → #5224f1)` overlay fades in over 500ms ease-out at the T1↔T2 boundary. The shell underneath keeps flat `#191919` as base. Smoothed cross-fade, no instant flip.
- **Gana CTA upgrade** — gradient end-stop shifts to `#a954ff`, and a `drop-shadow(0 2px 6px rgba(29,11,68,0.3))` is added. Stays at all higher tiers.
- **Outer glow swirl** — diffuse blurred sibling element (Apple Intelligence–style `conic-gradient(#4E7BFF, #9730FF, ...)` with an `@property --glow-angle` rotated continuously, 7s cycle). Masked by a radial-ellipse so it falls off softly at the slip's vertical edges. Opacity envelope breathes between 0.18 and 0.26 on a 6000ms cycle.
- **Border stroke shine sweep** — SVG `linearGradient` with stops `#a954ff → #c98fff → #dcb0ff (peak) → #c98fff → #a954ff` travels L→R along the 1px border. T2: 2800ms cycle, 2.5px stroke, ~30% opacity. T3: 2000ms, 1.5px, full opacity.
- **Faster breathing** — period drops from 4000ms (T1) → **3000ms** at T2.
- **More frequent sparkles** — T2: 1–3 per burst every 5500ms (denser than T1).
- **Lerp-smoothed outer-glow opacity** — `glowOpacity` motion value passes through a low-pass filter (factor 0.08, ~250ms half-life) so tier-boundary changes ease into/out of 0 instead of snapping. Tracks the breath envelope without perceptible lag.

**On selection add**
- **Glow flash on update** — outer glow opacity gets a +40% boost for `tier2.glowFlashDurationMs`, multiplied by a decay factor `k = (flashUntil − now) / duration` so the flash visibly fades back.
- **Outline ripple** *(on-event, T2+)* — a ghost border (purple `#9730ff` stroke) expands outward from the pill outline. Initial scale `1`, peak `1.18`, opacity `0.85 → 0`, stroke 3px → 1px, 600ms with cubic ease `[0.16, 1, 0.3, 1]`. Stacks up to 3 simultaneous ripples on rapid adds; older drop off. *Inherited at T3+.*

## T3 — *Máximo* *(≥ 15.00x)*

**Typography**
- **Italic Black** — the four bet-slip numbers (Bets, Momio, Monto, Gana) switch to Red Hat Display **Black Italic** (900 weight, italic), matching the Figma "Buscador" component. *Inherited at T4.*

**Ambient (T3 only — most of these scale at T4 via overrides)**
- **Per-character brightness wave** on the Momio and Gana digits — vertical white-band gradient (`fire-shimmer` + `odds-char-wave` CSS classes) sweeps top-to-bottom over each glyph on a 2s cycle, with a 150ms-per-character L→R stagger driven by the SlotNumber's `--ci` CSS var. *Inherited at T4.*
- **Gana glow filter (halo)** — layered `drop-shadow()` halo around the Gana digits whose intensity breathes on a 2000ms cycle (`ganaGlowFilter` motion value). Scaled to 0.7× of the underlying odds-halo intensity via `cfg.tier3.ganaGlowScaleDown`. *Momio's purple halo was removed* — at T3 Momio has no breathing halo (the per-character wave + OddsRipple carry it instead). At T4, the Gana halo is replaced by the white `numberGlow` (see T4).
- **Odds halo flicker (flames variant — default)** — a 5th layer on top of the 4-layer `drop-shadow` stack uses a fast deterministic sum-of-3-sines (8.3 / 13.7 / 19.1 Hz, weighted 0.45 / 0.35 / 0.20) for "flames" flicker between 30–70% opacity. Reproducible, pausable for `prefers-reduced-motion`.
- **Odds halo (smoke variant)** — alternative T3 odds effect (`tier3OddsEffect: 'smoke'`, togglable in the debug overlay). Rises blurred purple smoke blobs behind the digits at 350ms spawn interval, lifetime 1800–2400ms, size 8–14px, peak opacity 0.08–0.15, scale grows to 1.6×, layer-level 3px blur. Caps at 12 active.
- **Glow intensifies (outer)** — opacity envelope `0.36 → 0.50` (was 0.18–0.26 at T2). Faster pulse — 4800ms cycle (was 6000ms).
- **Inner rim glow** — a separate `innerRimOpacity` motion value runs the same breath cycle as the outer glow but **phase-offset** by `cfg.tier2.innerRimPhaseOffsetMs`. Renders as an inset ring brightness that interleaves with the outer glow (one waxes while the other wanes).
- **Border stroke sweep brightens but thins** — same SVG sweep as T2, full opacity, faster (2000ms cycle), but the rect's strokeWidth drops from 2.5px to **1.5px** so the brighter pixel weight matches T2's dim-stroke perceived thickness.
- **Fire-spark emitter (outflow)** — small purple streaks spawn at the top edge of the pill and rise straight up, fading. T3 cadence: 1–2 per spawn every 220ms, rise 22–48px, drift ±12px, size 2–3.5px, lifetime 800–1400ms, max 20 active. *Overridden at T4* (denser + faster).
- **Micro-tremor (intermittent)** — sub-pixel X/Y jitter on the pill: amplitude 0.3px, frequency 12Hz, with a burst envelope — active 220ms every 1500ms (quiet between), so it reads as alive rather than buzzing. Inner sin-wave is enveloped by `sin(phase / burstMs * π)` to fade in/out of each burst. **T3 only — T4 has no shake.**
- **Even faster breathing** — period drops to **2000ms** at T3.
- **Most sparkles** (within T3 family) — 2–4 per burst every 4500ms.
- **Magnetic pointer attraction** — when the cursor is within 60px of the button, the slip translates up to 3px toward the pointer. Spring-damped (stiffness 280, damping 28). **T3 only.**

**On selection add (T3+)**
- **Odds-value add-burst** — the Momio digits get a one-shot scale pop `1 → 1.08 → 1` over 300ms ease-out, paired with a synchronized **white `drop-shadow` flash** on the source digits (`drop-shadow(0 0 14px rgba(255,255,255,0.9))`, same 300ms timing). Driven by `oddsBurstControls`.
- **OddsRipple — ghost-text ripple** — a white ghost copy of the Momio digits is snapshotted from the current odds string, rendered as absolute overlay, scaled `1 → 1.5` from the text center, opacity `0.95 → 0` over **1200ms** with cubic ease `[0.16, 1, 0.3, 1]`. Pairs with the white source flash above so the source briefly brightens as the ghost emanates outward. Stacks up to 3 simultaneous ripples on rapid adds; each snapshots its odds text at spawn so it doesn't morph mid-animation. *Inherited at T4.*
- **Odds halo update surge** — `oddsHaloOverrideMultRef` boosts the breathing halo to 2.0× (i.e. +100%) for `cfg.tier2.oddsHaloUpdateDurationMs`, then fades back. Reinforces the on-add moment with extra ambient glow.

**On entering T3 (T2 → T3 crossing, one-shot)**
- **Weight-gain anchor** — the Momio digits drop 1px (`weightAnchorY` translate) AND gain a purple text-shadow underneath, then settle back to 0 over `cfg.tier2.weightAnchorDurationMs` with an ease-out × decay envelope. Reads as "the number suddenly has weight". Fires only on the up-cross into T3.

## T1 — *Intermedio* — first-selection sweep (NEW)

Fires exactly once per session, on the very first 0 → 1 selection change. Distinguishes the moment the user starts building a bet slip from all subsequent count changes.

- **Longer slot roll** — the odds digit roll uses `cfg.tier1.firstSelectionCountUp.slotDurationMs` (800ms vs default 380ms) so the number visibly RAMPS UP instead of snapping into place. The longer duration is computed at render time from `lastCountRef + hasFirstSelectedRef`, so the *very render* that triggers the roll uses the right transition duration. Subsequent renders fall back to the default.
- **Celebratory scale pulse** — `oddsBurstControls` runs a 1 → 1.08 → 1 scale animation on the odds container over 500ms. Reuses the same `oddsBurstControls` that drives the T3+ on-add burst (safe to share because tiers don't overlap — T0 → T1 transition only).
- **Settle overshoot retimed** — the post-slot settle overshoot (microinteraction d) is scheduled with `setTimeout(..., effectiveSlotMs)` so it lands the moment the longer slot animation completes, not 380ms in.

Subsequent count changes use the default 380ms slot. `hasFirstSelectedRef` is per-session — it resets if the user reloads the page but persists across reset / select-all-debug-tiers within one session.

---

## T4 — *Legendario* *(≥ 50.00x)*

Everything from T3 stays. T4 layers on top:

- **Fire-spark emitter — denser + faster** *(ambient override)* — spawn interval `220ms → 130ms`, count `1–2 → 2–3`, lifetime `800–1400ms → 500–900ms`, max active `20 → 32`. Streaks race upward in a thicker stream.
- **Boosted outer glow** — opacity envelope `0.55 → 0.78` (was 0.36–0.50 at T3), pulse cycle `3600ms` (was 4800ms). Reads as visibly more "stoked".
- **Subtle white glow on all four numbers** — `drop-shadow(0 0 4px rgba(255,255,255,0.55))` filter applied to Bets, Momio, Monto, AND Gana wrappers. Light enough not to blur the digits. At T4 this **replaces** Gana's purple `ganaGlowFilter` halo so the four numbers read as one luminous group.
- **Edge-flash sparkles — much denser** — same per-burst look as T2, but spawn interval `5500ms → 1300ms` (≈4× more often) and count `1–3 → 4–8` (≈2× per burst).
- **OddsRipple inherited** — the ghost-text ripple + source flash on add fires at T4 (gate widened from `tier === 3` to `tier >= 3`).
- **Outline ripple inherited** — same behavior as T2/T3.
- **No micro-tremor** — T3's burst-tremor is intentionally not inherited. The shake tuning is parked on the `tier_4` branch in case we want to revisit.
- *No font/color shift on the digits at T4 — the typography stays italic 900 in white. Color escalation continues to come from glow + sparks + breath, not the digit color itself.*

### T4 qualitative differentiators (distinguish T4 from "T3 turned up")

The original T4 spec was largely quantitative (denser sparks, brighter glow, more breath). These additions make T4 feel like a different *category* — dignified / weighty / once-in-a-while — instead of "T3 but more."

- **Magnetic spark INFLOW** — flips the T3 fire-spark vector. Container expands `cfg.tier4.fireSparksInflowOffsetPx` (50px) outward in all four directions. Round particles (white core, purple bloom) spawn on a random outer edge and converge toward a jittered point inside the button rectangle. Ease-in curve (`[0.45, 0, 0.7, 1]`) — slow start, fast finish — reads as gravitational acceleration. Particles fade as they "absorb" into the button. Same density as T3's outflow; opposite vector. T3 keeps its rising streaks (filtered by `!s.inflow`); T4 renders only the inflow particles (filtered by `s.inflow`).
- **Weightier slot roll** — odds digit changes use `cfg.tier4.slotDurationMs` (480ms vs default 380ms). The number arrives like a coronation. Computed at render time from `tier === 4`, so it applies from the very render that triggers the slot at T4. Settle overshoot is rescheduled with `effectiveSlotMs` so it still lands the moment the longer slot completes.
- **iOS 26 Siri-style ambient vignette** — full-perimeter color halo in `App.tsx` (lives at `z-[15]`, above scrollable content but below the bet slip + navbar). Composed of:
  - **Outer mask layer** — a radial mask whose ellipse `--vw`, `--vh`, `--vcx`, `--vcy`, `--vstop` CSS custom properties are declared with `@property` and animated by an 14s `vignetteShapeBreathe` keyframe (see `src/index.css`). The mask's transparent hole subtly stretches wider, then taller, then off-axis, then back — 9 keyframes with ~2-6 pt deltas each, creating a continuous wavy morph rather than discrete shape jumps.
  - **Inner rotating conic gradient** — a 200% × 200% layer with `inset:-50%` so rotation never reveals empty corners. Background is `conic-gradient(from 0deg, #4e7bff, #9730ff, #4e7bff, #9730ff, #4e7bff)` — same blue + purple palette as the bet-slip's outer-glow swirl, locked so the two color systems feel like one organism. `filter: blur(40px)` softens the four hard color stops into a continuous bloom. `animate={{ rotate: 360 }}` over 16s linear infinite.
  - **Tier gate** — outer div opacity tweens to `cfg.tier4.vignette.opacityMax` (0.85) over 700ms when `tier === 4`; back to 0 on tier-down. `useReducedMotion()` halts the conic rotation under reduced-motion preference; the shape-morph also disables via `@media (prefers-reduced-motion: reduce) { .vignette-shape-breathe { animation: none; } }`.
  - The 14s shape period and 16s color rotation period are co-prime so the two animations never align identically — the vignette never visually repeats.
- **Bottom-area gradient softens at T4** — the dark fade above the bet slip (anchoring it against the markets) is `0.8 → 0.95` opacity at T0-T3. At T4 it drops to `0.35 → 0.6` so the colored vignette bloom shows through the bottom area edges instead of being darkened into a visible rectangular "panel" sitting on top of the Siri colors. A 700ms `transition: background` smooths the swap.
- *Heartbeat breath rhythm (tried + reverted)* — at one point T4 used a lub-dub heartbeat pattern instead of sine. Reverted because the steady sine at T4's larger amplitude reads as more eye-catching than the pulse-rest-pulse pattern. The `'heartbeat'` code branch lives in `ButtonPreviewMomios.tsx` and re-enables by adding `4: 'heartbeat'` back to `cfg.breath.rhythmByTier`. See `pre-heartbeat-revert` git tag.

---

## Per-tier comparison tables

### Outer glow

| Tier | Opacity range | Pulse cycle |
|---|---|---|
| T0/T1 | (off) | — |
| T2 | 0.18 – 0.26 | 6000ms |
| T3 | 0.36 – 0.50 | 4800ms |
| T4 | 0.55 – 0.78 | 3600ms |

### Breathing

| Tier | Amplitude | Period |
|---|---|---|
| T0 | — | — |
| T1 | 0.008 | 4000ms |
| T2 | 0.008 | 3000ms |
| T3 | 0.008 | 2000ms |
| T4 | **0.020** | 2200ms |

### Edge-flash sparkles

| Tier | Count / burst | Interval |
|---|---|---|
| T0 | (off) | — |
| T1 | 1 – 2 | 8000ms |
| T2 | 1 – 3 | 5500ms |
| T3 | 2 – 4 | 4500ms |
| T4 | **4 – 8** | **1300ms** |

### Fire-spark emitter (T3+ only)

| Tier | Spawn interval | Count / spawn | Lifetime | Max active |
|---|---|---|---|---|
| T3 | 220ms | 1 – 2 | 800 – 1400ms | 20 |
| T4 | 130ms | 2 – 3 | 500 – 900ms | 32 |

### Border stroke shine sweep (T2+ only)

| Tier | Cycle | Stroke width | Opacity |
|---|---|---|---|
| T2 | 2800ms | 2.5px | ~0.3 |
| T3 / T4 | 2000ms | 1.5px | 1.0 |

---

## Tier-crossing flourishes *(one-shot)*

Fire on any tier change (`prevTier → newTier` mismatch in `useEffect`), captured by a `crossing` state that auto-clears after the longest sub-effect's lifetime.

**Up-cross** *(prevTier → higherTier)*
- **Radial bloom** — large purple radial gradient from button center. Scale `1 → 1.6 × 6` (visually filling the area), opacity `0 → 0.4 → 0` over 650ms ease-out.
- **Collision flash** — white radial burst at bottom-center of the pill, 300ms after the cross. Scale `0.3 → 1.1 → 0.9`, opacity `0 → 1 → 0` over 220ms ease-out, with a 2px blur. Reads as "two light heads meeting" even though the orbital heads were removed.
- **Floating sparkle** — single 3px white dot floats up from the collision point ~18px over 800ms while fading. Stays close to the button.
- **Scale pulse** — button scales `1 → 1.06 → 1` with a bumpy spring (stiffness 320, damping 11) over 450ms.
- **Border-glow surge** — the shell's `borderBoxShadow` motion value gets multiplied by ~3× via `borderOverride` refs for 700ms, then fades back. Reinforces the "tier-up payoff" beat.
- **Prominent outline ripple with motion-blur trace** *(up-cross into T3 or T4 only)* — a single `OutlineRipple` with the `prominent` flag spawns from the same crossing useEffect. Bigger / longer / brighter than the standard add-ripple: scale `1.55` (vs 1.18), stroke `5px → 2px` (vs 3px → 1px), opacity `1.0` start (vs 0.85), duration `1100ms` (vs 600ms). Plus a `filter: blur(0px → 4px)` ramp over the flight — the expanding ring smears progressively, leaving a soft motion-blur trail behind the leading edge. Treated as a sibling to the T3 oddsRipple that fires every odds change — same family of motion, scaled to the level-up moment. Standard add-ripple keeps firing alongside it from the selection-change effect.
- **Haptic thump** — `playTierCrossingHaptic()` fires a 20ms `navigator.vibrate(20)`. See **Haptic feedback** below.
- **Tier-up sound** — `playSound('tier-up')` no-op hook (audio call site, currently unimplemented).

**Down-cross** *(prevTier → lowerTier)*
- **Border-glow dim** — the inverse of the up-cross surge: `borderBoxShadow` is multiplied by ~0.25 for `downSweepDurationMs` (600ms) then returns. Quiet acknowledgment of the drop.
- **Tier-down sound** — `playSound('tier-down')` no-op.

---

## Bet-slip lifecycle (BetSlipShell wrapper)

Drives the slip's entry/exit when `selectionCount` crosses 0↔1.

- **Bouncy entry on first mount** — on the very first 0→1 transition in a session, the slip enters with a spring from Y `+80px` (below) → `0`, scale `0.85 → 1.0`, opacity `0 → 1`. Spring config: stiffness 260, damping 14, mass 0.7. The `onMounted` callback flips the `hasBouncedOnceRef` so subsequent re-adds **skip** the bounce.
- **Velocity-derived landing squash** — during the spring descent, the slip's `y` velocity drives a brief `scaleY` compress + `scaleX` stretch via `useTransform([velocity], ...)`. Reads as the slip "squashing" as it lands.
- **AnimatePresence with reserved 88px slot** — the slip mounts/unmounts inside an `AnimatePresence mode="wait"` wrapper that holds an 88px-tall reserved region so the navbar below doesn't shift when the slip enters/leaves.
- **Sharp exit** — on 1→0, the slip drops out to Y `+30px`, scale `0.4`, opacity `0` over 280ms with curve `[0.7, 0, 0.84, 0]` (fast accelerate-out); opacity finishes earlier (200ms).
- **Springy recoil on subsequent adds/removes** — once mounted, every selection add or remove triggers the recoil push-down 4px + spring-back described under T0 (no bounce on the initial mount; only on re-adds).

---

## Haptic feedback

Wired in `src/haptics.ts`; called from `App.tsx`. Two patterns, both no-ops on devices without `navigator.vibrate` (most notably **iOS Safari** — Apple has not shipped a Web Haptics API, so on iPhone web these calls are silent. They still serve as **spec markers** for the Flutter port).

| Trigger | Function | Duration | Flutter equivalent |
|---|---|---|---|
| Tap to add or remove a pick (via market card, debug "Añadir selección", or "Quitar") | `playSelectionHaptic()` | `navigator.vibrate(10)` | `HapticFeedback.selectionClick()` |
| Cumulative odds cross a tier boundary in either direction (T0↔T1, T1↔T2, T2↔T3, T3↔T4) | `playTierCrossingHaptic()` | `navigator.vibrate(20)` | `HapticFeedback.mediumImpact()` |

- Tier-crossing detection: a `useEffect` watches the derived `tier` value and compares against a `prevTierRef`. Fires on every change; the initial mount is naturally skipped because the ref starts equal to the first tier.
- The selection haptic fires **before** `setSelections` so the user feels the confirmation in the same animation frame as their tap.
- The CTA (pressing the bet-slip button) is **not** wired with a haptic in this branch — punt to a follow-up if/when that interaction lands.

---

## Responsive layout

App-level shell (`App.tsx`), not an effect per se but worth documenting:

- **Phone-only breakpoint at 431px** via Tailwind's arbitrary `min-[431px]:` variant. Below 431px the prototype renders **full-bleed** — no phone-mockup chrome, no bezel, no shadow, no notch. Above 431px (desktop demo + tablets) the original 390×844 mockup is centered with bezel, rounded corners, notch.
- **431 chosen instead of 430** so iPhone Pro Max (14/15/16) at exactly 430pt portrait lands in mobile mode (`min-[430px]:` would be inclusive).
- **`100dvh` (dynamic viewport height)** on the inner phone-screen container so the navbar tracks iOS Safari's URL-bar expand/collapse instead of getting pushed under browser chrome.
- **`padding-bottom: env(safe-area-inset-bottom)`** on the bottom anchor so iPhones with a home indicator float the navbar above it.

## Accessibility

- **`prefers-reduced-motion: reduce`** disables:
  - Tremor, all fire-shimmer / per-character brightness wave keyframes (`@media (prefers-reduced-motion: reduce) { .fire-shimmer, .odds-char-wave { animation: none; } }`)
  - Edge-flash sparkles + fire-spark emitter (gated by `reduced` early-return in their effect hooks)
  - Outer glow swirl rotation + the T4 Siri-style vignette's color rotation + its shape morph (`@media ... { .outer-glow-swirl, .vignette-shape-breathe { animation: none; } }`, plus framer-motion `useReducedMotion()` halting the conic-gradient rotation)
- **Slot rolls survive but compressed** — `cfg.reducedMotionSlotDurationMs` (180ms) replaces the normal 380ms so digit changes still read but don't dwell.
- **All ambient effects throttleable** via `?debug=true` overlay (1× normal or 3× slow speed). Each tier has a jump-to-tier button (T0–T4) that auto-selects a pre-built combo from `selectionsForTier(N)` in App.tsx.
- **T3 odds effect togglable** at runtime — `flames` (default, layered drop-shadow halo with flicker) or `smoke` (rising blurred blobs). Lives in `cfg.tier3OddsEffect`.

---

## One Click Bet — slip & entry-creation interactions (`main`)

These are the "One Click Bet" exploration effects, distinct from the tier-progression system above and **not** gated by the `cfg.animationsEnabled` master switch (they gate on `prefers-reduced-motion` where relevant).

**Bet slip — liquid-glass morph** (`BetSlipSheet.tsx`)
- **Single morphing surface:** one always-opaque glass element morphs its *shape* — height (measured expanded height → `COLLAPSED_GLASS_H`) and corner radius (`20`→`28`, capsule), bottom-anchored — between the expanded card and the collapsed pill. Card content fades out over the first ~60%; the real pill fades in only over the last ~20%, onto the identical capsule → seamless, never an empty frame. All derived from one `collapseP` motion value (0 = expanded, 1 = collapsed) blended with the `expandedH` motion value.
- **Gesture-driven collapse:** dragging down writes `collapseP` from the raw pointer offset (range = height delta), so the surface shrinks 1:1 with the finger (top edge tracks it, bottom anchored). Elastic 0 — no translate. Past `COLLAPSE_OFFSET_PX`/velocity → commit; else spring back.
- **Swipe up** → opens the full-screen `BetSlipFullSheet`. **Swipe down / 10s inactivity** → collapse.
- **Squash-&-stretch pulses:** subtle on appear (`ENTRY_PULSE_*`, springier) and on collapse (`COLLAPSE_PULSE_*`), composed onto the shell scale with a mid-transition `MORPH_DEFORM_*` squash. Plus a per-selection-add pulse (`ADD_PULSE_*`).
- **Summarized content + measured-height grow/shrink:** the expanded card shows **1–2 selections only** — 1 keeps its single row (date on the right), 2 stack vertically (Figma `newSelectionPreviewOSB`: × + divider · shield · uppercase market / pick · odds). No "2+" parlay header — every count uses the single-selection handle. Expanded shell height is measured from the content via a `ResizeObserver` into `expandedH` (first measure snaps; later changes spring with `COLLAPSE_SPRING`), so adding/removing the 2nd row springs the card taller/shorter — composed with, not replacing, the add pulse. A **3rd** selection auto-collapses to the pill (`App.tsx`).

**Floating card — shape-morph open/close** (`BetSlipFullSheet.tsx`)
- The "Resumen" floating card no longer slides up from off-screen. It **grows out of the bet-slip footprint**: one `openP` motion value (0 = slip-sized capsule, 1 = full card) drives a bottom-up `clip-path: inset(top … round 28px)` reveal (top inset from `fullH − START_H` → 0, `START_H` = 56px pill height, `fullH` measured from the card) plus a content crossfade (`opacity` [0.2,0.8]) and a backdrop-scrim fade — mirroring the collapsed-pill↔summarized-card morph in `BetSlipSheet` so all three states read as ONE surface changing shape. The card background stays opaque during the reveal so the growing capsule looks solid; only the inner content fades. **Both directions use the same `OPEN_SPRING`** — open springs `openP` 0→1, close springs 1→0 so the card shrinks *in place* back into the pill (never a fast slide-away or a bottom-sheet dismiss).
- **Swipe-down closes by driving the morph, not translating.** The close drag writes `openP` from the finger offset (`1 − offset.y / (fullH − START_H)`, clamped) — the card shrinks with the finger exactly like `BetSlipSheet`'s gesture-collapse. Past `CLOSE_OFFSET_PX`/velocity on release → commit (the unmount spring finishes the shrink into the pill); otherwise spring back open. The card element has no `y` transform (`dragElastic={0}`), so it never slides.
- **Color morph → the capsule becomes the purple pill.** The card fill is two stacked layers — a purple pill base (`PILL_BG`, matches `BetSlipSheet`'s `GLASS_BG`) with the dark card fill (`SHEET_BG`) crossfading over it by `cardDarkOpacity` (`openP` [0.15,0.55]) — plus a border that morphs `#4b20ff` (pill) ↔ `rgba(251,251,251,0.12)` (card). So the full card reads dark and the shrunk capsule reads as the purple pill, not the (similarly-dark) navbar behind it.
- **Position morph → the capsule lands ON the pill, not the navbar.** The card sits at the navbar line, but the pill sits ~`PILL_RISE_PX` (62px) higher; a `morphY` translate (`openP` [0,0.5]) lifts the card up by that much as it shrinks, so the final capsule overlaps the pill's footprint (the full card stays anchored at the navbar line). Applied on a wrapper so it never fights the drag (which drives `openP`).
- **Pill-content reveal → no "empty pill" gap.** The whole card cross-fades against the real pill behind it at the ends of the morph (`cardOpacity`, `openP` [0,0.12]). On close, as the bare capsule fades out the real pill (with its `3 Bets · odds · Gana` content) is revealed underneath — so the moment before unmount never shows an empty capsule. On open the card fades in from the pill.
- **Close squash-&-stretch.** A subtle pulse (`scaleX`/`scaleY` → `1.03`/`0.95`, `PULSE_SPRING`, anchored bottom-center) fires as the card shrinks in — the same collapse pulse the summarized slip uses — so the card visibly squashes into the pill. Applied on the same wrapper as `morphY`.
- Selections list scrollbar hidden (`no-scrollbar`).

**Swipe-to-confirm** (`BetSlipSheet` + `BetSlipFullSheet`)
- Confirms **only** when the thumb reaches the measured end of the track (not a fixed px). On completion the thumb pins and shows a spinner for `CONFIRM_LOADER_MS` (900ms, simulated ticket creation) before firing the success flow.

**Success animation** (`EntryCreatedOverlay.tsx`) — ONE ticket shape for every success flow (swipe-confirm on the expanded slip, swipe-to-play on the Resumen full sheet, AND lightning bet)
- **Shape:** a green **ticket/stub** (Figma 33822:171080) — **233×108**, rounded corners + a semicircular notch on the mid-left/right edges, drawn as the exact Figma vector path (`TICKET_FILL_PATH`, viewBox `16 16 233 108`). Radial-green fill (`#29C28A→#1DAC7C→#059669` @95%), gradient rim stroke (`#34D399`@56%→`#1B6D4F`), green glow (`#36E5A9`@36%) via a wrapper `drop-shadow`. A centered stroke clipped by the SVG viewport reads as Figma's inside stroke. Sits 12px above the navbar, centered via `left:50%`+`marginLeft` (not a transform, to avoid subpixel edge glitches). `cfg.ticket`.
- **Icon + message:** the 36px checkmark (`src/assets/success-check.png`) above **`¡ENTRADA CREADA!`** (uppercase, Red Hat Display Black Italic, 14px/21px, `#fbfbfb`).
- **Entrance:** circular clip-path reveal (`greenCircleIn`) + check/text pop (`greenContentIn`, same 0.2s timing/easing as the reveal) for swipe-confirm/Resumen. **Lightning Straight Bet instead morphs in from the floating pill** (`originRect` prop, `cfg.morphIn`) — a 280ms FLIP transform (transform/opacity only, no layout thrash) carries a pill-colored echo from the pill's exact rect/size into the ticket's resting rect while crossfading it into the real ticket face over the tail ~48% of the tween, so completing a hold reads as the pill itself changing shape rather than the pill vanishing and an unrelated ticket appearing. `morphIn.ease` is the same smooth `cubic-bezier(0.4, 0, 0.2, 1)` deceleration as `longPress.reverseEasing` (POLISH PASS — was the more elastic `0.16,1,0.3,1`), so a completed hold's "settle" and the ticket's "arrive" read as one continuous material. The pill (`App.tsx`'s `oneClickBetPillVisible`) unmounts in the same render that the overlay mounts, so the two are never both on screen. The ticket stays **upright** throughout (message read level).
- **On reveal-complete:** green spark burst (recolored T4 fire-spark dots), a squash/stretch "pop" (`cfg.pop`), and a green glow flash — glow decay (`glowDecayMs`, 480ms) tuned to finish alongside the pop spring's settle (POLISH PASS — was 620ms, a beat longer than the spring, so the glow used to visibly linger after the squash/stretch had already stopped).
- **Hold:** stays upright + readable for `cfg.confirmedHoldMs` (1700ms) before the flight.
- **Flight:** genie into "Mis entradas" — snappy y + x springs launched together (no anticipation); the shrink, squash/stretch and **opacity fade are all driven by overall flight PROGRESS (both axes)** — the path is a short near-horizontal diagonal, so a y-only fade blinked it out early. As it flies it **leans left**, growing with flight progress (`cfg.genie.flightTiltDeg`, ~-8°; 0 at launch so it matches the upright resting ticket) plus a subtle velocity wobble. Stays fully visible through the trajectory, fades over the last ~15%. `onCatch` bumps the tab icon on arrival; `onDone` finishes.

**Lightning Straight Bet** (`useOneClickBetSession` in `oneClickBetSession.ts`, `onAccept`/`onSubmit` in `App.tsx`)
- Long-press (3s, `cfg.longPress.durationMs`) a pick → after a short 150ms engage threshold the floating **One Click Bet pill** (`OneClickBetPill.tsx`) appears, showing live odds/stake/potential-win and a left-to-right progress fill (written every frame, no easing — a direct linear feed of elapsed/duration). The pressed pick itself shows no inline progress, only the ordinary CSS `:active` press feedback. Releasing before completion doesn't just hide the pill — the fill **animates back down to 0** first (a 500ms `cubic-bezier(0.4, 0, 0.2, 1)` CSS transition, `cfg.longPress.reverseMs`/`reverseEasing`), THEN the pill's own squash/stretch exit plays (`ocbPillMotion.exit`, 160ms smooth ease-in `[0.5, 0, 0.3, 1]`), THEN it dismisses and the bet slip is restored, untouched. POLISH PASS — both curves were retuned from a more elastic/bouncy `cubic-bezier(0.16, 1, 0.3, 1)`/ease-in `[0.4, 0, 1, 1]` pair (the retired inline-button's forward-fill curve, which read as bouncy rather than settling when reused for a *reversal*) to matched smooth-deceleration curves, so reversal → exit now reads as one continuous decelerating motion instead of two visually distinct animation styles back to back. On completion (no reversal), the pressed pick shows its **selected state**, then an entry is created a beat later (`LIGHTNING_SELECT_MS`), skipping the slip entirely.
- **Movement cancels the hold** — a pointer moving more than `cfg.longPress.cancelTolerancePx` (10px) from its start position is reclassified as a scroll or carousel drag: before the engage threshold this cancels silently (pill never shown, no tap fires); after it, the pill reverses and dismisses exactly like an early release. Never blocks native scrolling/dragging. A quick tap still toggles the pick into the slip.
- **Gesture cleanup happens the instant progress hits 100%** — not when the success animation finishes: the session stops its rAF loop, clears the active pointer, and suppresses only the matching tap, all synchronously in the same tick as `HOLD_COMPLETE`. Scrolling and further taps work immediately even while entry creation and the ticket morph are still playing out.
- **Existing selections are preserved, not discarded** — any parlay already in the slip before the hold is remembered (`App.tsx`'s `preLightningSelectionsRef`) and restored once the gesture resolves, success or failure; a Quick Bet never permanently drops the user's other selections.
- **Submission failure** (`?debug=true` → "Simulate next Quick Bet failure", one-shot) — skips the success animation entirely, restores the preserved selections, and dismisses the pill (the session's existing `cancelActive()` path, triggered by `onSubmit` returning `false`). Surfaces a brief toast in the app's one existing error color (`#ff6b6b`, from `OnboardingSheet`'s `ERROR_COLOR`).

**Sticky header** (`HomeScreenChrome` in `HomeScreen.tsx`)
- Two-tier CSS sticky: topbar (status + logo/balance) pins at `top:0`; match tabs + pill markets pin just below it (offset = measured topbar height); the league tabs scroll away/hide under the topbar. Pure CSS, no scroll listener.

**Post-entry actions** (`App.tsx` + `Navbar` in `HomeScreen.tsx`) — Figma "navbarFooter" 33563:154460
- **Count badge:** `#3d3d3d` pill, 2px `#191919` ring, bold white count at the icon's top-right. Squash-stretch pop on appear (`@keyframes badgePop`, keyed per entry to replay) + opacity fade-out.
- **Action buttons:** 44px circular reuse / share / discard (`#191919` fill, `rgba(251,251,251,0.16)` border), 12px above the navbar, slide-in (`promptIn`) + fade-out.
- **Shared 5s window:** the badge and the action buttons appear together and auto-hide **together** after 5s (one timer keyed to each entry). Both fade out (opacity transition + delayed unmount), not a hard pop.

---

## Master switch — `cfg.animationsEnabled`

A single global flag in `src/buttonProgressionConfig.ts` that turns the entire progression system on or off. **Currently `false` on `main`** (static button); the fully-animated version lives on the `bet-slip-progression` branch.

**What it suppresses when `false`:** every effect in this document — all ambient tier effects (breathing, glow, border-light sweep, shimmer, tremor, sparkles, fire-sparks, smoke/flames, magnetic attraction, T4 Siri vignette), all on-event micro-interactions (press scale, recoil, anticipation, settle overshoot, count-badge pulse, radial/odds/outline ripples), all tier-crossing one-shots, and haptics + sound.

**What it preserves (functional motion):** the slip's entry/exit mount transition (`BetSlipShell` — bouncy entry, exit fall, velocity landing-squash) and the per-digit number rolls (`SlotNumber`). The tier is still computed from cumulative odds, so any *static* per-tier styling (background palette, font weight, static text-shadow) still applies — only motion/reactivity is removed.

**How it's wired** (deliberately minimal, reuses the reduced-motion paths):
- `ButtonPreviewMomios.tsx` — `const reduced = usePrefersReducedMotion() || !cfg.animationsEnabled;` This one line gates every `!reduced` effect. Plus the `whileTap` press-scale is gated on `!reduced`.
- `App.tsx` — `reducedMotion` OR-s the flag (halts vignette rotation); the vignette opacity is additionally gated on `!reducedMotion`.
- `haptics.ts` — both `playSelectionHaptic` / `playTierCrossingHaptic` early-return when the flag is `false`.
- `playSound.ts` — already a no-op; unaffected.

Flip to `true` to restore everything documented above.

---

*If something significant changes — an effect is added, removed, moved between tiers, retuned, or its gate condition changes — update this file in the same commit. The `audit` agent prompt that produced the current version is preserved in chat history if a full re-audit is needed later.*

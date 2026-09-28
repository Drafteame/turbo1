# Turbo1

> **Exploration base.** This repo is a fork of [`Drafteame/draftea-momios-prototype`](https://github.com/Drafteame/draftea-momios-prototype) — the buttonPreviewMomios progressive-engagement prototype — used as a starting point for new "One Click Bet" explorations. The original is left untouched; iterate here.

> **Working in Claude Code?** Read [`CLAUDE.md`](./CLAUDE.md) first — it has the architecture, file map, tier system, branch model, conventions, and gotchas the AI needs to be efficient in this repo. Auto-loaded by any Claude session opened here. See also [`EFFECTS.md`](./EFFECTS.md) for the canonical effect catalog.
>
> **Porting this to Flutter?** This repo is the visual + behavioral spec for a Flutter feature. Read [`FLUTTER_PORTING.md`](./FLUTTER_PORTING.md) — it has the React → Flutter API mapping (Framer Motion → `AnimationController`, conic-gradient → `CustomPainter`, etc.) and per-effect porting notes. The TS code is reference-only; the live site + `EFFECTS.md` + `buttonProgressionConfig.ts` are the actual spec.

High-fidelity interactive prototype of the Draftea sports-betting home
screen, focused on the **buttonPreviewMomios** component at the bottom of
the screen. As the user adds picks to the slip the cumulative odds grow
multiplicatively and the button progresses through five tiers of
microinteraction intensity — **without ever shifting its base color
palette**. Differentiation comes from motion, light, and behavior.

Built from the Figma frame
[Draftea-Global / home](https://www.figma.com/design/OBq6XxCPiveHmdSKScTtq2/Draftea-Global?node-id=30881-290311)
with design tokens (colors, typography, radii) pulled directly from the
Figma MCP connector.

## Run

```bash
npm install
npm run dev
```

Opens on `http://127.0.0.1:5174`. Sized for **iPhone 14 (390×844)**.

| URL                              | What it does                                  |
| -------------------------------- | --------------------------------------------- |
| `/`                              | Normal prototype.                             |
| `/?debug=true`                   | Tier overlay + jump-to-tier + 1×/3× speed toggle + live phase readouts. |

## Regressions fixed in this pass

- **Diffuse outer glow (Approach B).** The previous `box-shadow` with
  non-zero `spread` was inflating a visible pill outline before blurring
  it, producing a shape-y halo. Replaced with a **duplicate blurred
  sibling element**: a div sized just slightly beyond the button, filled
  with a radial purple gradient, run through `filter: blur(20px)`, with
  opacity driven by the existing `glowOpacity` motion value. The blur
  acts on the *whole shape* rather than just an outline, so the result
  is genuinely shapeless. Spread is 0; nothing violates spread ≤ blur.
- **Crisp odds at Tier 3 (no doubled text).** Every duplicate `<span>`
  that was being used to render a glow has been removed — the previous
  `OddsFlamesEffect` (two duplicate halo spans), the T2 halo duplicate
  introduced in the polish pass, and the Gana halo duplicate are all
  gone. The glow is now a **layered `text-shadow` stack applied to the
  real text via a motion value**. A per-frame `useAnimationFrame` loop
  composes the string (4 base halo layers at T2 baseline, breathing at
  T3, plus a 5th flicker layer at T3+flames driven by a deterministic
  sum-of-sines). Result: real text stays perfectly crisp, glow extends
  outside the glyph edges, no doubling.
- **Bouncy bottom-up entry (springs that actually overshoot).** The
  bug was timing: `hasBouncedOnceRef.current = true` was being set in a
  `queueMicrotask` inside the `setSelections` updater, which ran
  *before* React re-rendered the App, so `BetSlipShell` mounted with
  `bouncy={false}` on the very first mount. Fix: the ref is now flipped
  via an `onMounted` callback fired from inside `BetSlipShell`'s entry
  effect — after the render that consumed `bouncy`. Springs updated to
  `y: 80 → 0 (stiffness 380, damping 14, mass 1)` and `scale:
  0.85 → 1 (stiffness 300, damping 12, mass 1)`; both deliberately
  underdamped so the bob past final position is clearly visible. The
  velocity-derived landing squash (scaleX/scaleY from `useVelocity(y)`)
  is preserved and now actually fires because the spring physics it
  derives from are running.

## Pass 3 changes

- **Heat-haze duplicate-text layer removed.** The blurred duplicate of
  the odds value that was causing the "doubled appearance" bug at Tier 3
  is gone. Replaced with a clean **`OddsFlamesEffect`** (default) and an
  optional **`OddsSmokeEffect`** — both keep the actual odds text
  perfectly crisp. Flames stack four purple text-shadow halos *outside*
  the glyph edges plus a fifth fast flicker layer driven by a
  deterministic sum-of-sines (8.3 Hz / 13.7 Hz / 19.1 Hz weighted),
  pulsing in sync over a 2 s cycle. Smoke spawns 3–5 blurred purple
  radial-gradient blobs every 350 ms behind the text that rise 30–50 px
  while fading; the `filter: blur(3px)` lives on the smoke layer only,
  never on the text. Runtime-togglable via `?debug=true` (flames default).
- **Bet slip hides at 0 selections.** The `buttonPreviewMomios` is now
  conditionally rendered via `AnimatePresence` with `mode="wait"`. When
  `selections.length === 0` it fully unmounts; a fixed-height (88 px)
  reserved slot inside the bottom-fixed area keeps the navbar pinned so
  the rest of the screen never shifts. `mode="wait"` queues any new
  entry until the in-flight exit finishes.
- **Bouncy / liquid entry on first mount.** New `BetSlipShell` wrapper
  sits OUTSIDE the existing breath/magnetic/tremor stack and owns the
  entry/exit + landing squash. Mount springs `y: +40 → 0` (stiffness
  320, damping 14, mass 1.1) and `scale: 0.3 → 1` (stiffness 280,
  damping 12, mass 1.0) with an `opacity: 0 → 1` over 180 ms and a
  `borderRadius: 50% → 56px` "blob → pill" liquification over 240 ms.
  Squash on landing is **derived continuously from y velocity** via
  `useVelocity` + `useTransform` — `scaleY` compresses and `scaleX`
  stretches as velocity peaks negative (the moment of impact), then
  both return to 1 as velocity decays. It's not a separate canned
  animation; it emerges from the bounce physics. The bouncy entry
  fires only on the **first mount of the session**; subsequent 0 → 1
  remounts appear instantly. Exit is always a sharp non-bouncy
  compress-and-fall (scale 1 → 0.4, y 0 → +30, opacity 1 → 0, radius
  → 50%, 280 ms with cubic ease `[0.7, 0, 0.84, 0]`).

## Polish pass adjustments

- **Single border light, two-layer halo.** The Tier 3 secondary head is
  gone — every tier now has exactly one traveling light. T3 differentiates
  from T2 via cycle speed (1.6 s) and opacity (0.8), not a second head.
  Each head is rendered as two stacked SVG strokes (3 px sharp core with
  Gaussian blur σ=2.5 + 4 px halo with σ=6 at 50% opacity), color
  `#9730FF`, so the light reads as glow rather than a drawn line.
- **Outer glow breathing slowed.** Tier 2 glow cycle 2.0 s → **3.6 s**;
  Tier 3 1.2 s → **2.4 s**. Inner highlight rim cycle follows; phase
  offset doubled to 1200 ms so it stays out of phase with the outer
  glow. Reads as slow inhale/exhale.
- **Outline outward ripple.** New `OutlineRipple` component — a
  button-shaped ghost border that expands outward from the button's
  perimeter into the surrounding UI on every selection add at Tier 3
  (scale 1 → 1.18, opacity 0.55 → 0, border-width 2 → 0.5 px,
  600 ms cubic-bezier(0.16, 1, 0.3, 1)). Rendered as a sibling of the
  button inside the breath/magnetic wrapper so it escapes the shell's
  `overflow:hidden`. Stacks up to 3 simultaneous on rapid adds. Coexists
  with the center radial burst.
- **Odds glow layers.** A halo span sits behind the odds value at T2+
  (`text-shadow: 0 0 8px / 0 0 16px` purple stack) whose opacity is a
  motion value. T2 stays at static 0.4; on update it surges +50% for
  300 ms then settles. T3 breathes 0.4 ↔ 0.7 on a 2 s cycle, and an
  add-event surges it to 1.0. T3 also adds a **per-character brightness
  wave** every 3 s (`filter: brightness(1.4)` 120 ms staggered 60 ms via
  CSS `--ci` variable), and a **1.08 scale burst on selection add**
  layered over the slot animation. The same halo treatment is applied
  to the Gana potential-winnings number at 0.7× intensity, so the odds
  stays the focal point but the winnings share the energy.

## What changed in this pass

- **SVG border light.** The conic-gradient hack is gone. The traveling
  light is now an SVG `<rect>` with `stroke-dasharray` carving a short
  visible dash and `stroke-dashoffset` animated to move that dash along
  the rounded-pill perimeter. Light visibly travels *on* the border
  stroke, including around the corners.
- **Nested motion composition.** Tremor (`tremorX`/`tremorY`) is now
  applied to the inner `motion.button`'s `x`/`y`. Breathing scale and
  magnetic-attraction translate live on an outer `motion.div`. Press
  scale and crossing scale-pulse compose cleanly with the inner button,
  so every transform stacks rather than fighting.
- **Calmer intermittent tremor.** Tremor is now active for only a
  220 ms burst inside each 1500 ms cycle, with a sin-envelope fade in/
  out. You feel it without seeing it twitching.
- **Layered emotional escalation per tier.** Each tier gained
  additional layers — Tier 1 now breathes; Tier 2 gained an inner
  highlight rim, weight-anchor on entry, and a +40% glow flash on every
  odds update; Tier 3 gained a heat-haze duplicate layer behind the
  odds, a cross-flicker overlay, on-add radial ring burst, and pointer
  magnetic attraction.
- **Stronger tier-crossing flourishes.** Up-cross now spawns TWO light
  heads from the top traveling in opposite directions, meeting at the
  bottom in a collision flash with one floating sparkle, plus a
  mandatory radial bloom and an overshoot-spring scale pulse to 1.06.
  Down-cross is intentionally quieter — single dim reverse sweep, no
  pulse, no sparkle.
- **playSound() audio hook.** A silent no-op `playSound(eventName)`
  stub lives in `src/playSound.ts` with hooks already wired at tier
  crossings, the Tier 3 radial burst, and slot-counter completion. Add
  audio later in one line.
- **Debug overlay live phases.** With `?debug=true` the overlay now
  shows live readouts of the border-light cycle phase, the breathing
  cycle phase, and whether the tremor envelope is currently active.

## The conceptual bet

> **Motion over color, because color is already saturated.** Promotional
> carousel banners, league rings, match pills, and CTA gradients all
> compete for attention through hue. Adding more color to signal
> escalation would either blend in or look chaotic. Motion, by contrast,
> is quiet across the rest of the screen — so every micro-pulse, every
> border light, every sweep registers as a deliberate signal of value
> building. The button earns the user's eye not by shouting louder than
> the banners, but by being the only thing on the screen that's *alive*.

## Tier thresholds

| Tier | Name        | Cumulative odds | Picks (typical) |
| ---- | ----------- | --------------- | --------------- |
| 0    | Default     | < 2.00          | 1               |
| 1    | Intermedio  | 2.00 – 5.00     | 2–3             |
| 2    | Súper       | 5.00 – 15.00    | 3–5             |
| 3    | Máximo      | > 15.00         | 5+              |

All thresholds, durations, opacities, and amplitudes live in
[`src/buttonProgressionConfig.ts`](src/buttonProgressionConfig.ts).

## Tier effects (each tier additive on the previous)

### Tier 0
Resting state. Press scales 0.97 on tap, springs back.

### Tier 1 — *Intermedio*
- Slow SVG border-light sweep (4.5 s cycle, faint, with quiet pauses).
- Odds typography micro-pulse (scale 1.00 → 1.02, opacity 1 → 0.92).
- **Soft inhale/exhale on the whole button** (scale 1.000 → 1.008,
  4 s cycle — see microinteraction (e) for tier-paced timing).
- **Selection count badge pulse** on every change (scale 1 → 1.08
  with a brief glow flash in the existing accent color).

### Tier 2 — *Súper*
- Faster brighter border sweep (2.5 s, 0.55 opacity, dash 34 px).
- Soft outer purple glow pulsing on 2 s cycle (palette-derived).
- Heavier odds font-weight (900 → 800 contextual) + accent text-shadow.
- **One-shot weight-gain anchor** when crossing into T2: the odds
  drop 1 px and gain a temporary 0→2 px text-shadow underneath,
  simulating digits "settling" with more gravity.
- **Inner highlight rim** out of phase with the outer glow by 600 ms.
- **+40% outer-glow flash for 300 ms on every odds update** — each new
  selection literally lights the button up momentarily.
- Selection counter gets a soft glow when it updates.
- Button breathing accelerates to a 3 s cycle.

### Tier 3 — *Máximo*
- Continuous border sweep (1.8 s) + secondary slower offset sweep
  (3.2 s, opposite direction) for layered light.
- Intensified outer glow at 1.2 s pulse cycle.
- **Layered fire effect**: the per-character vertical light-gradient
  shimmer on the odds (2 s) is overlaid with a faster (1.2 s)
  cross-flicker overlay across the whole button surface using
  `mix-blend-mode: overlay`. Cross-flicker without literal flame.
- **Heat-haze**: a blurred duplicate of the odds value sits behind the
  real value, with opacity pulsing 0 → 0.3 → 0 on a 1.5 s cycle.
- **Calmer intermittent tremor** (0.3 px amplitude, 12 Hz, only active
  for 220 ms bursts every 1500 ms, sine-enveloped).
- **Radial ring burst on every selection add** — a 1 px → 60 px white
  ring expanding from button center over 500 ms, opacity 0.5 → 0.
- **Magnetic pointer attraction** — within 60 px of the button center,
  the button translates up to 3 px toward the pointer via a spring.
  Works for mouse and touchmove.
- Sparse sparkle particles every 4.5 s at random border points.
- Button breathing accelerates to a 2 s cycle.

## Tier-crossing flourishes

### Up-cross (entering a higher tier)
- **Two border-light heads** spawn from the top-center and travel in
  opposite directions around the perimeter, meeting at the bottom.
- 300 ms after spawn, a **collision flash** appears at the bottom-
  center, radial gradient blurred 2 px.
- A **single floating sparkle** rises from the collision point and
  fades over 800 ms.
- **Mandatory radial bloom** from button center, scale 0 → 1.6× ×6,
  opacity 0 → 0.4 → 0 over 650 ms.
- **Overshoot scale pulse** 1 → 1.06 → 1 with a spring at stiffness
  320 / damping 11 for the bounce.
- `playSound('tier-up')` fires (currently silent).

### Down-cross (returning to a lower tier)
Intentionally quieter — the user shouldn't feel punished for backing up.
- **Single dim reverse sweep** around the border (0.7 s, opacity 0.4).
- No scale pulse, no sparkle, no bloom.
- `playSound('tier-down')` fires.

## Microinteractions — picked and rejected

### Picked from this pass's suggestion list

- **(d) Odds settle overshoot.** After the slot animation completes
  (380 ms), the new value briefly scales 1.04 → 1 over 120 ms — the
  number "lands" with weight. Cheap, ubiquitous, and pairs beautifully
  with the 40 ms anticipation compress before the slot rolls.
- **(e) Tier-paced breathing.** The whole-button inhale/exhale cycle
  shortens with tier: 4 s at T1, 3 s at T2, 2 s at T3. The button
  literally breathes faster as the cumulative odds (and excitement)
  grow. This makes the escalation feel embodied rather than just
  layered-on.

### Rejected

- **(a) Selection-cards pulse toward the button.** Would have required
  computing card-to-button trajectory in screen space and emitting a
  duplicate flying element from each market card. Strong causality
  signal, but the implementation cost was high and the visual would
  have competed with the carousel banner's existing motion.
- **(b) Magnetic field viz behind the button at Tier 3.** Already
  implemented Tier 3 pointer magnetic attraction (per the brief);
  adding a visible field gradient would either be too faint to read or
  loud enough to violate the "no new color" rule.
- **(c) Counter wheels 8° tilt.** Slot-machine reel-tilt is a strong
  signature but it pushes the slot animation past "subtle" into a
  named visual metaphor that doesn't otherwise live in the Draftea
  design system. Felt off-brand.
- **(f) Tier-progress micro-indicator.** A 1 px bar at the bottom of
  the button filling toward the next tier was tempting, but it creates
  a second, competing focal-point inside the button. The tier system
  is supposed to be felt, not measured.

### Carried over from the previous pass

- Anticipation breath before slot animation (40 ms compress).
- Layered Tier 3 border lights (primary + secondary sweep).
- Sparse sparkle particles at Tier 3.
- Audio cue hook left as `playSound()` — now fully wired, still silent.

## Perceived emotional escalation T0 → T3

- **Tier 0** — *Quiet.* The button is just there. The user notices it
  because it sits at the bottom in a fixed dock; no other reason.
- **Tier 1** — *Alive.* The button starts breathing. A thin light
  travels around its border, slowly, with long quiet pauses. The
  odds value itself breathes in sync. Adding a selection produces a
  visible kick on the count badge. The feeling: "something just woke
  up."
- **Tier 2** — *Watched.* The breath quickens by a second. A soft
  purple halo blooms in and out around the button. Inside the border,
  a second highlight rim breathes out of phase, lending depth. Every
  selection now flashes the halo brighter by 40% — instant feedback.
  The odds gain weight; their digits visibly settle. The feeling:
  "this thing is reacting to me."
- **Tier 3** — *Reaching.* Breath at its fastest. The light no longer
  pauses — it travels continuously, with a second slower light running
  the opposite direction underneath. The odds shimmer; a heat-haze
  blurs behind them. The whole button trembles in tiny intermittent
  bursts. When the pointer approaches it, the button *reaches* toward
  the finger by a few pixels. Every new selection emits a radial ring
  that flares outward. The feeling: "I'm not just adding picks
  anymore — this thing is on fire and waiting to be hit."

Crossing between any two tiers, the two-head border collision +
overshoot scale + radial bloom acts as a sharp punctuation mark. The
user knows, viscerally, that something changed. Crossing back down,
the dim reverse sweep is the gentle "OK, easing off" — not a slap on
the wrist.

## Tunable values (from `buttonProgressionConfig`)

Every tunable in the file has a comment explaining its purpose. Major
groups:

| Group                  | Controls                                                  |
| ---------------------- | --------------------------------------------------------- |
| `tiers`                | Tier thresholds (odds cutoffs)                            |
| `maxSelections`        | Slip cap                                                  |
| `pressScale`           | All-tier tap feedback                                     |
| `slotDurationMs`       | Per-digit slot roll                                       |
| `anticipationScale/Ms` | Pre-slot 40 ms compress                                   |
| `settleOvershoot…`     | Post-slot 1.04 → 1 overshoot (microinteraction d)         |
| `breath.amplitude`     | All-tier breathing amplitude (0.008)                      |
| `breath.periodByTier`  | Tier-paced breath rate (microinteraction e)               |
| `tier1.*`              | Border sweep, odds pulse, count badge pulse               |
| `tier2.*`              | Border, glow, inner rim, weight anchor, glow flash boost  |
| `tier3.*`              | Border (1° + 2°), fire (1° + 2°), heat haze, tremor       |
| `tier3.magnetic*`      | Pointer-attraction radius, max translate, spring config   |
| `tier3.radialBurst*`   | On-add radial ring burst                                  |
| `crossing.twoHead*`    | Up-cross border-head animation                            |
| `crossing.collision*`  | Up-cross collision flash + delay                          |
| `crossing.upPulse*`    | Up-cross overshoot spring                                 |
| `crossing.bloom*`      | Mandatory up-cross radial bloom                           |
| `crossing.downSweep*`  | Down-cross quieter inverse                                |
| `reducedMotion*`       | A11y-fallback slot duration                               |

## Reduced motion

When `prefers-reduced-motion: reduce` is set:

- All ambient animations are disabled (border sweep, glow pulse, odds
  micro-pulse, fire shimmer + cross-flicker, heat haze, micro-tremor,
  breathing, sparkles, magnetic attraction).
- Tier-crossing flourishes (two-head, collision, sparkle, bloom,
  scale pulse, down-sweep) are also disabled.
- Tier 3 radial-burst on selection add is disabled.
- Per-digit slot roll **survives** and is compressed to 180 ms.

## Debug mode (`?debug=true`)

Overlay (left of button, above the navbar) shows:
- Tier ID + name
- Cumulative odds
- Selection count / max
- Live **TREMOR** active-state pip (on during burst windows)
- Live **BORDER** sweep cycle phase (0..1)
- Live **BREATH** breathing cycle phase (0..1)

Below the carousel:
- **T0 / T1 / T2 / T3** jump buttons with hand-picked combos that land
  squarely inside each tier (no overshoot).
- **Animation speed 1× / 3×** toggle to slow all ambient animations.

## File map

```
src/
  buttonProgressionConfig.ts   single source of truth for tunables
  BorderLight.tsx              SVG stroke-dashoffset border light
  ButtonPreviewMomios.tsx      hero component (state, ambient, one-shots)
  SlotNumber.tsx               per-digit slot animation primitive
  HomeScreen.tsx               surrounding chrome
  playSound.ts                 silent audio hook + call-site enum
  usePrefersReducedMotion.ts   a11y hook
  App.tsx                      composition + state + debug overlay
  index.css                    keyframes (fire-shimmer, cross-flicker)
  types.ts                     shared types
```

## Stack

Vite + React 18 + TypeScript (strict) + Tailwind CSS + Framer Motion.
No other UI libraries.

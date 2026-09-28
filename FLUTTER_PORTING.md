# Porting this prototype to Flutter

This repo is the **visual + behavioral spec** for a Flutter mobile app feature. The code here (React + Framer Motion + Tailwind) is NOT a translation source — Flutter and React render very differently. But the prototype is highly useful as a spec.

## How to use this repo if you're porting to Flutter

**Read in this order:**

1. **The live site** — https://drafteame.github.io/one-click-bet/ — open with `?debug=true` to jump between tiers and slow to 3× for inspecting motion. This is the visual ground truth.
2. **[`EFFECTS.md`](./EFFECTS.md)** — plain-English catalog of every animation/microinteraction, grouped by tier. This is your feature spec.
3. **[`src/buttonProgressionConfig.ts`](./src/buttonProgressionConfig.ts)** — every magic number (durations, amplitudes, opacities, easing curves, tier thresholds) lives here with a comment. **Copy these values verbatim** into Dart — they're tuned, not arbitrary.
4. **This file** — translation hints + gotchas (below).
5. **The TS code** — last. Use it only as a reference for *when* things fire and the relationships between effects, not as a source for how to implement.

## Direct value translations (copy verbatim)

| TypeScript | Dart / Flutter |
|---|---|
| `cfg.tiers[*].minOdds` | const `const tierThresholds = [0, 2.0, 5.0, 15.0, 50.0];` |
| Easing `[0.16, 1, 0.3, 1]` | `Cubic(0.16, 1.0, 0.3, 1.0)` |
| Easing `'easeOut'` | `Curves.easeOut` |
| Easing `'easeIn'` | `Curves.easeIn` |
| `duration: 1200ms` | `Duration(milliseconds: 1200)` |
| Opacity keyframes `[0, 1, 1, 0]` with times `[0, 0.05, 0.97, 1]` | `TweenSequence` with `weight:` proportional to `Δtime` |
| Spring `{ stiffness, damping, mass }` (recoil) | `SpringSimulation(SpringDescription(stiffness: ..., damping: ..., mass: ...))` |

## API mapping

| This repo uses | Flutter equivalent |
|---|---|
| Framer Motion `useMotionValue` / `useSpring` / `useTransform` | `AnimationController` + `Tween` + `Animation.drive(CurveTween)` |
| `useAnimationFrame((t) => ...)` (custom per-frame ticker) | `Ticker` (raw) or `AnimationController` with `addListener` |
| `AnimatePresence` mount/unmount | `AnimatedSwitcher`, `AnimatedSize`, or manual `AnimationController` w/ disposal in a `StatefulWidget` |
| CSS `conic-gradient` + `@property --angle` (the outer-glow swirl) | `CustomPainter` with `SweepGradient` and an `AnimationController` rotating the start angle |
| CSS `background-clip: text` (fire-shimmer wave) | `ShaderMask` widget wrapping a `Text`, with a `LinearGradient` whose offset animates |
| CSS `mask-composite: exclude` (Magic UI border ring, parked on `explorations`) | `CustomPainter` with `Path.combine(PathOperation.difference, outer, inner)` or `ClipPath` |
| CSS `offset-path: inset(0 round Npx)` (orbital spark on Magic UI shimmer) | Hand-roll the rounded-rect perimeter math in a `CustomPainter`; advance a parametric `t` ∈ [0,1] |
| `filter: drop-shadow(...)` motion value | `BoxShadow` list on a container, or `ImageFiltered` with `ImageFilter.blur` for filter-style halos |
| DOM z-stacking via `position: absolute; inset: 0` | `Stack` + `Positioned.fill` |
| SVG `<rect stroke="url(#gradient)" />` (stroke shine sweep) | `CustomPainter` drawing the rounded-rect stroke with a `Paint..shader = LinearGradient.createShader(...)` whose origin animates |

## Per-effect porting notes

Numbers below all live in `buttonProgressionConfig.ts` — read there for the canonical tuning.

### Slot-style per-digit counter (`SlotNumber.tsx`)

Split the value string into characters; for digits that change between renders, slide the old digit up + out while the new one slides in from below. In Flutter: `Row` of per-character widgets, each wrapping its current digit in an `AnimatedSwitcher` keyed by the digit value, with `SlideTransition` as the `transitionBuilder`. Non-digits (`.`, `x`, `$`) skip animation. Stagger via per-character `Animation`s if you want a cascade.

### Press feedback + anticipation + settle overshoot + recoil

Four small spring/tween moments on the slip wrapper. In Flutter: one `AnimationController` per behavior, composed into a single `Transform` via `Listenable.merge([...])` in an `AnimatedBuilder`. The recoil spring is the most complex — use a `SpringSimulation` with stiffness 260, damping 14, mass 0.7 (see config).

### Ambient breathing (T1+, period scales per tier)

Single `AnimationController` with infinite repeat. `Transform.scale` driven by `1 + amplitude * sin(2π * controller.value)`. Per-tier period and (at T4) amplitude live in `cfg.breath.periodByTier` / `cfg.breath.amplitudeByTier`.

### Outer glow (conic swirl, T2+)

The hardest visual. In React: a blurred sibling `div` with a CSS conic-gradient and an animated angle via `@property`. In Flutter: a `CustomPainter` drawing the slip's pill shape with a `SweepGradient` shader, then wrapping the whole painter in `ImageFiltered(imageFilter: ImageFilter.blur(sigmaX: 20, sigmaY: 20))`. Rotate the gradient's start angle with an `AnimationController` (7s cycle in this repo). Mask the result with a soft radial ellipse so the glow falls off at the top/bottom — Flutter's `ShaderMask` over the blurred layer.

### Border stroke shine sweep (T2+)

A linear-gradient stripe that travels around the rounded-rect border. The Magic UI variant (parked on `explorations`) uses a conic wedge + mask-composite for a true around-the-perimeter orbit. **The mainline (and `main` branch) uses a simpler L→R sweep along a horizontal stripe.** For Flutter:
- Simple horizontal sweep → `CustomPainter` with a `LinearGradient` shader whose `start`/`end` translate along x.
- Around-the-perimeter orbit → parametric `t` ∈ [0,1] mapped to a point on the pill perimeter, draw a small spark there.

### Fire-shimmer per-character brightness wave (T3+, Gana + Momio)

For each character, a vertical lavender→white→lavender gradient sweeps top-to-bottom over 2s, staggered by 150ms × character index. In Flutter: per-character `ShaderMask` widget wrapping the `Text` with a `LinearGradient` whose offset animates. Stagger each character's controller by `i * 150ms`. There's also a `.fire-shimmer-gold` variant (white text + gold band) parked unused in CSS — same mechanic, different gradient.

### OddsRipple (T3+, ghost-text ripple on every selection add)

When a selection is added, render a ghost copy of the Momio digits at the same position with `transformOrigin: center`. Animate `scale: 1 → 1.5` and `opacity: 0.95 → 0` over 1200ms with curve `(0.16, 1, 0.3, 1)`. The source digits get a synchronized 300ms ease-out white drop-shadow flash. Stacks up to 3 simultaneous ripples on rapid adds. Snapshots the odds string at spawn so the ghost doesn't morph mid-animation.

In Flutter: `Stack` containing the real `Text` and a list of ghost `Positioned.fill` overlays. Each ghost is its own `StatefulWidget` with an `AnimationController` (1200ms). Composite `ScaleTransition` + `FadeTransition`. Source flash via a separate controller animating a `BoxShadow` opacity.

### OutlineRipple (T2+, ghost border on every add)

Similar to OddsRipple but the ghost is the **button outline**, not text. Same 600ms duration, scale `1.18` peak, easing `(0.16, 1, 0.3, 1)`. Stacks up to 3.

In Flutter: `Stack` overlay with a `Container` whose `border` (or `OutlinedBorder`) animates from full opacity to transparent while scaling outward. Use `Transform.scale` over a `DecoratedBox`.

### Fire-spark emitter (T3+, rising purple embers)

Particles spawn every 220ms (T3) or 130ms (T4), 1–2 per spawn (T3) or 2–3 (T4), each a small vertical streak (size × 5 height) with a purple linear-gradient (transparent → solid `#9730ff` at top). They rise straight up `riseMin..riseMax`px while fading. Lifetime 800–1400ms (T3) or 500–900ms (T4). Capped at 20 or 32 active. Note: the `odds-effect` branch has a parked **inflow** variant (sparks attracted FROM all directions instead).

In Flutter: a `StatefulWidget` maintaining a `List<_Spark>` state. A periodic `Timer.periodic` adds new particles; each particle has its own short-lived `AnimationController` or computes its progress against `spawnTime` in a single global `AnimationController`. Render each as a `Positioned` with a `LinearGradient`-painted container + `ImageFiltered` for the glow. Garbage-collect on lifetime end.

### Tier-crossing flourishes (one-shot, on `prev_tier → new_tier`)

Up-cross: radial bloom from center, collision flash, floating sparkle, scale pulse, border-glow surge. Down-cross: quick down-sweep. Driven by a state hook that detects tier change and renders/unmounts a short-lived overlay.

In Flutter: detect tier change in `didUpdateWidget` of a `StatefulWidget`. Push a short-lived overlay (key by a crossing-id) that runs an `AnimationController` once and removes itself.

### T1 first-selection count-up sweep

Fires exactly once per session on the very first 0→1 selection. The Momio slot roll uses an 800ms duration instead of the default 380ms, AND the odds container runs a 1 → 1.08 → 1 scale pulse over 500ms (the "you've started building something" celebration). After this one-shot, subsequent count changes use the default 380ms.

In Flutter: a `bool _hasFirstSelected = false;` field in the slip widget. On each `didUpdateWidget` selection change, compute `isFirstSel = prevCount == 0 && newCount == 1 && !_hasFirstSelected`. If true, use the longer slot duration for the upcoming `AnimatedSwitcher` transition AND trigger a one-shot scale `AnimationController` for the container. Then `_hasFirstSelected = true`. **Important**: the long duration must be applied in the same frame that triggers the slot roll — in React this is solved via render-time computation reading the ref; in Flutter, set the controller's duration before calling `forward()`.

### T4 magnetic spark INFLOW (replaces T3 outflow at T4)

T3 emits sparks UPWARD from the top of the button (energy escaping). T4 flips the vector: round particles spawn at the four outer edges of a container that extends `inflowOffsetPx` (50px) outside the pill on all sides, then converge toward a jittered point inside the button rectangle. Easing `(0.45, 0, 0.7, 1)` reads as gravitational acceleration. Particles fade as they "absorb" into the button.

In Flutter: same emitter widget as the T3 spark notes above, but at T4:
- The `Stack`'s `Positioned.fill` is wrapped in `Padding(padding: EdgeInsets.all(-50))` (or use a `Transform` with overflow) so the container extends outside the button.
- Each particle's `startX`/`startY` is computed by picking one of 4 sides (top/bottom/left/right) and a random position along it.
- `endX`/`endY` is a jittered point inside the button rect.
- Render as a `Container` with `decoration: BoxDecoration(shape: BoxShape.circle, gradient: RadialGradient(colors: [Colors.white, purple, transparent]))` — round particles, not vertical streaks. Direction reads from motion alone.

### T4 weightier slot roll

T0-T3 use `cfg.slotDurationMs` (380ms). T4 uses `cfg.tier4.slotDurationMs` (480ms) — the number arrives like a coronation. Settle overshoot timer is rescheduled with `effectiveSlotMs` so it lands the moment the longer slot completes.

In Flutter: the slot widget reads its duration from a per-tier `Duration` lookup. Settle overshoot kicks off with `Future.delayed(effectiveSlotMs)`.

### Siri-style ambient vignette (T4 only, lives in App.tsx)

iOS 26 Siri activation: blue + purple conic gradient rotates around the screen perimeter while the gradient's masked "hole" subtly morphs in shape. Tonally locked to the bet-slip's outer-glow palette (`#4e7bff` + `#9730ff`) so the screen edges and the button read as one color system.

Two-layer structure:
- **Outer mask layer** — a radial mask whose ellipse width/height/center/inner-stop oscillate over a 14s loop (9 keyframes, ~2-6 pt deltas each — continuous wave, no discrete jumps). Drives the fade-in/out opacity on tier enter/leave.
- **Inner rotating conic** — sized 200% × 200% with `inset:-50%` (so rotation doesn't reveal empty corners). Conic gradient with 5 stops alternating `#4e7bff` and `#9730ff`. `filter: blur(40px)`. Rotates 0 → 360° over 16s linear infinite.
- The 14s shape period and 16s color period are co-prime so the two animations never align identically.

In Flutter:
- **Outer mask layer**: `ShaderMask(blendMode: BlendMode.dstIn, shaderCallback: ...)` returning a `RadialGradient` with animated `radius` / `center` parameters. Drive each parameter with its own `AnimationController` on different periods (or compute from a single 14s controller's `value` with offset phases for each parameter).
- **Inner rotating conic**: a `CustomPainter` filling a 200% rect with `Paint..shader = SweepGradient(colors: [blue, purple, blue, purple, blue]).createShader(rect)`. Wrap the painter in `ImageFiltered(imageFilter: ImageFilter.blur(sigmaX: 40, sigmaY: 40))`. Compose inside an `AnimatedBuilder` that rotates the entire layer via `Transform.rotate(angle: controller.value * 2 * pi)`.
- **Tier gate**: `AnimatedOpacity` on the outer container driven by `tier == 4`.

### Prominent outline ripple with motion-blur trace (T3 / T4 tier-up only)

A bigger / longer / brighter `OutlineRipple` fires on the up-cross moment (NOT on regular adds at T3/T4 — those keep the standard ripple). Scale `1.55` (vs 1.18), opacity `1.0 → 0` (vs 0.85), stroke `5px → 2px` (vs 3px → 1px), duration `1100ms` (vs 600ms), PLUS a `filter: blur(0 → 4px)` ramp over its flight — the ring smears progressively, leaving a motion-blur trail.

In Flutter: the same overlay widget used for the standard ripple, but with a `bool prominent` constructor flag. When `prominent`, use the larger numbers AND add a `Tween<double>(begin: 0, end: 4)` for an `ImageFiltered(imageFilter: ImageFilter.blur(sigmaX: blur, sigmaY: blur))` wrapping the ring. The blur tween shares the controller with the scale/opacity tweens so the motion blur deepens as the ring expands.

### Bottom-area gradient softens at T4

The dark fade above the bet slip (anchoring it against the markets) is `rgba(0,0,0,0.8) → 0.95` at T0-T3. At T4 it drops to `0.35 → 0.6` so the colored vignette bloom can show through the bottom area edges rather than being darkened into a visible rectangular "panel" on top of the Siri colors.

In Flutter: a tier-conditional `LinearGradient` on the bottom container, plus `AnimatedContainer` wrapping it so the swap fades over ~700ms when tier crosses 3↔4.

### Tier-paced tremor (T3 only)

A burst-and-quiet pattern: tremor is active for `tremorBurstMs` (220ms) every `tremorCycleMs` (1500ms), so quiet between. Amplitude 0.3px, frequency 12Hz, x/y noise via two phase-offset sines with a fade-in/out envelope.

In Flutter: continuous `Ticker` (`SchedulerBinding.instance.scheduleFrameCallback`). Each frame computes `phase = t % cycleMs`; if `phase > burstMs` apply zero offset; otherwise apply `sin(t * 2π * Hz / 1000) * amp * envelope`. Apply the result as a `Transform.translate` on the slip wrapper.

T4 on the parked `tier_4` branch turns this into a continuous (non-burst) shake. **`main` keeps T4 shake-free.**

### Background crossfade at T1↔T2

The slip's flat `#191919` background crossfades to a purple gradient at the T1→T2 boundary over 500ms ease-out. The shell keeps `#191919` as a base; an overlay `div` with the gradient animates its opacity.

In Flutter: `Stack` of two `Container`s (one flat, one gradient). `AnimatedOpacity` on the gradient layer driven by `tier >= 2`.

### Italic typography switch at T3+

The four bet-slip numbers (Bets, Momio, Monto, Gana) switch from `Red Hat Display Regular 900` to `Red Hat Display Black Italic 900` at T3+. Pre-load the italic font (loaded via Google Fonts in the prototype). In Flutter: load both styles via `pubspec.yaml` and toggle `TextStyle.fontStyle: tier >= 3 ? FontStyle.italic : FontStyle.normal`.

### Haptic feedback (this is where Flutter wins big over the web)

The web prototype calls `navigator.vibrate(10)` (selection) and `navigator.vibrate(20)` (tier crossing) — works on Android Chrome, **silent no-op on iOS Safari** (Apple has never shipped a Web Haptics API). The web calls live in `src/haptics.ts` and fire from `App.tsx` handlers.

In Flutter on iOS this becomes a first-class user-felt experience via `HapticFeedback`:

| Trigger | Web call | Flutter equivalent |
|---|---|---|
| Pick add OR remove (every selection toggle, every debug "Añadir" / "Quitar") | `playSelectionHaptic()` → `navigator.vibrate(10)` | `HapticFeedback.selectionClick()` |
| Cumulative odds cross a tier boundary in either direction (T0↔T1↔T2↔T3↔T4) | `playTierCrossingHaptic()` → `navigator.vibrate(20)` | `HapticFeedback.mediumImpact()` |

- Selection haptic fires **before** the state mutation so the user feels the confirmation in the same animation frame as their tap. In Flutter, call `HapticFeedback.selectionClick()` synchronously at the top of the `onTap` handler.
- Tier crossing is detected via a `useEffect` watching `tier` against a `prevTierRef`. In Flutter, mirror this in `didUpdateWidget` comparing `widget.tier` to `oldWidget.tier`. Skip the initial mount (the ref starts equal to the first tier).
- The CTA press is **NOT** wired with a haptic in this prototype — punt to a follow-up. If the spec calls for it later, `HapticFeedback.heavyImpact()` would be the right intensity.

### Responsive layout shell (App.tsx)

Not an effect but worth noting for the porter: the web shell switches between **full-bleed mobile** (≤430px) and a **390×844 desktop mockup frame** (≥431px). 431 is chosen so iPhone Pro Max at exactly 430pt portrait lands in mobile mode.

Flutter doesn't need this — the device is always the device. But the porter should know that the bet slip's bottom anchor uses `padding-bottom: env(safe-area-inset-bottom)` so the navbar floats above the iPhone home indicator. In Flutter: wrap the bottom area in `SafeArea(top: false)`.

## Gotchas + tips

- **Reduced motion**: respect `MediaQuery.disableAnimations` everywhere — disable particle emitters, swirls, shimmers, tremor. The React code uses `prefers-reduced-motion`; mirror that.
- **Tier gating idiom**: this repo uses both `tier === N` (exclusive) and `tier >= N` (additive). Audit every gate when extending — Effects.md notes which apply where.
- **`vsync`**: most `AnimationController`s need a `TickerProvider`. Use `SingleTickerProviderStateMixin` for one, `TickerProviderStateMixin` for many.
- **GC discipline**: dispose every `AnimationController` in `dispose()`. The React equivalent is the `useEffect` cleanup return.
- **Color philosophy**: do NOT vary base colors across tiers. Effects come from motion, light, and behavior. This is a Draftea design principle — the prototype enforces it.
- **Tunability**: keep equivalent of `buttonProgressionConfig.ts` as a single Dart file (`button_progression_config.dart`) so the design team can dial values without code spelunking.

## Useful Flutter packages

- `flutter_animate` — concise builder API for chained sequences (`.fadeIn().slideY()`). Useful for the simpler ambient stuff.
- `rive` — if you want to author the swirl/glow as a designer-driven state machine instead of code. Worth considering for the outer glow.
- `confetti` or `particles_flutter` — drop-in for the spark emitter if you don't want to hand-roll it.
- Stick with Flutter's built-in `CustomPainter` + `AnimationController` for anything Apple-Intelligence-grade — third-party libs hit a ceiling.

## Branch reference for the porter

| Branch | What's there | Worth porting? |
|---|---|---|
| `main` | Production-shape: T0–T4 + responsive layout + haptics + T1 first-selection sweep + T4 differentiators (magnetic spark inflow, weightier slot, Siri-style vignette) + prominent outline ripple with motion-blur trace on T3/T4 crossings | ✅ Yes — this is the deployable spec |
| `responsive-and-haptics` | Merged into main (kept as historical reference for the iteration commits) | Historical only |
| `explorations` | Magic UI shimmer-border (CSS mask-composite trick) | Reference-only; the Flutter equivalent is a `CustomPainter` |
| `odds-effect` | Earlier fire-spark inflow variant + dim ripple iterations (older than the version now on main) | Skip — main has the production inflow |
| `tier_4` | Earlier T4 work including the continuous shake (excluded from main) | Reference for the shake math if you re-enable it |

Tags worth knowing — visual checkpoints to diff against:
- `main-simple-baseline` — main before the responsive/haptics/Siri-vignette merge. The "keep it simple" version.
- `pre-t4-differentiation` — before the four T4 quality additions (magnetic inflow, weightier slot, vignette).
- `pre-heartbeat-revert` — has the T4 heartbeat breath variant (lub-dub vs the current sine).
- `pre-stroke-thin-t3`, `pre-attracted-sparks` — older checkpoints before risky changes.

import type { TierConfig } from './types';

/**
 * Central tunable configuration for the buttonPreviewMomios progression.
 * Every "magic number" used by the animated button lives here with a comment.
 *
 * Rule of thumb: if a tier feels weak, do NOT crank up an existing effect's
 * intensity — add a NEW layer. Each individual effect must stay restrained.
 */
export const buttonProgressionConfig = {
  /* --------------------------------------------------------------- */
  /*  TIER THRESHOLDS — driven by cumulative odds                    */
  /* --------------------------------------------------------------- */
  tiers: [
    { id: 0, name: 'Default', minOdds: 0 },
    { id: 1, name: 'Intermedio', minOdds: 2.0 },
    { id: 2, name: 'Súper', minOdds: 5.0 },
    { id: 3, name: 'Máximo', minOdds: 15.0 },
    { id: 4, name: 'Legendario', minOdds: 50.0 },
  ] as TierConfig[],

  /* --------------------------------------------------------------- */
  /*  GLOBAL                                                          */
  /* --------------------------------------------------------------- */
  // MASTER SWITCH — bet-slip progression animations/micro-interactions.
  // When `false`, the button renders in a static state: ALL tier ambient
  // effects, progression micro-interactions (recoil, press scale,
  // anticipation, settle overshoot, count pulse, radial/odds/outline
  // ripples, tier-crossing flourishes, magnetic attraction, sparkles,
  // fire-sparks, smoke/flames, glow, border-light sweep, breathing) and
  // the T4 Siri vignette are suppressed, and haptics + sound are silenced.
  // The slip's functional motion is preserved: entry/exit mount transition
  // (BetSlipShell) and the per-digit number rolls (SlotNumber) still play.
  // Flip to `true` to restore the full progression system (see also the
  // `bet-slip-progression` branch, which snapshots the fully-animated
  // version). Implemented by OR-ing this into the reduced-motion flag in
  // ButtonPreviewMomios + App, so it reuses the existing reduced-motion
  // gating paths rather than threading a new flag through every effect.
  animationsEnabled: false as boolean,
  // Cap selections at this count to prevent runaway tiers.
  maxSelections: 8,
  // Press feedback — scale on press, spring back on release (all tiers).
  pressScale: 0.97,
  // Slot animation duration for per-digit roll (selection count + odds).
  slotDurationMs: 380,
  // Anticipation compress before slot roll: gives digit motion physical weight.
  anticipationScale: 0.99,
  anticipationDurationMs: 40,
  // Microinteraction (d) — overshoot when a digit lands after slot.
  settleOvershootScale: 1.04,
  settleOvershootDurationMs: 120,
  // EXPLORATION — recoil: the whole slip gets pushed DOWN a little on
  // every selection add/remove, then springs back to its rest position.
  // Fires on changes while showing (not on the initial 0→1 mount).
  recoil: {
    pushDownPx: 4, // subtler shove (was 6)
    // Spring back to 0 — softer + slower + clearly underdamped so it
    // bounces a couple of times before settling (springy feel).
    // Lower stiffness = slower; lower damping ratio = more bounce.
    spring: { stiffness: 260, damping: 14, mass: 0.7 },
  },
  // Geometry — radius of the rounded-pill border (matches Figma 56/2).
  borderRadiusPx: 28,
  borderHeightPx: 56,
  // Reserved vertical space the bet slip occupies (px). Used to keep the
  // navbar pinned when the slip unmounts at 0 selections.
  // Was 88px (= 8 pt + 56 button + 24 pb). Slip pb reduced to 8px so
  // the slip sits only 8px above the navbar; slot height follows.
  slotReservedHeightPx: 72,

  /* --------------------------------------------------------------- */
  /*  QUICK BET — hold-to-confirm (long-press) progress               */
  /*  Single source of truth for the long-press duration: the same    */
  /*  value drives BOTH the visual fill/stroke progress on the pick     */
  /*  button (see .qb-hold in index.css) AND the moment the entry is    */
  /*  actually confirmed (useLongPress in HomeScreen.tsx) — one clock,  */
  /*  so the visual and the confirmation can never drift apart.         */
  /*                                                                    */
  /*  reverseMs is the OTHER shared timing constant: how long the        */
  /*  fill takes to animate back to 0 when a hold is cancelled (early      */
  /*  release / pointer leave / cancel) — built directly into an inline     */
  /*  `transition` in useLongPress's reset() (HomeScreen.tsx), so there's     */
  /*  one shared value rather than a hardcoded duplicate in CSS.               */
  /*                                                                         */
  /*  strokeCompleteMs — EXPERIMENTAL (background-only progress treatment,    */
  /*  branch qb-background-only-experiment): during the hold, only the fill   */
  /*  (--qb-progress) communicates progress; the stroke stays static. On       */
  /*  successful completion, the stroke plays a single fast accent sweep        */
  /*  (--qb-stroke-progress, a SEPARATE custom property so it never tracks       */
  /*  the 3s hold) using this duration, then clears. Previous version (fill+     */
  /*  stroke moving together throughout the hold) is preserved at git tag        */
  /*  pre-bg-only-qb-experiment.                                                  */
  /* --------------------------------------------------------------- */
  longPress: {
    durationMs: 3000,
    reverseMs: 500,
    // Smooth deceleration for the reverse-fill animation. The old inline
    // button's 0.16,1,0.3,1 elastic curve felt bouncy for reversals —
    // this is a cleaner ease-out that decelerates smoothly without overshoot.
    reverseEasing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    strokeCompleteMs: 220,
    // Movement tolerance (px) for the candidate/pressing hold — a pointer
    // moving further than this before release is classified as a scroll or
    // carousel drag, not a hold, and cancels the session (see
    // oneClickBetSession.ts's onPointerMove). Standard touch-slop range.
    cancelTolerancePx: 10,
  },

  /* --------------------------------------------------------------- */
  /*  ONE CLICK BET FLOATING PILL — mount/cancel motion. Squash &      */
  /*  stretch entrance/exit, same spring language as BetSlipSheet's    */
  /*  appear/collapse pulses (ENTRY_PULSE_SCALE_x / PULSE_SPRING in     */
  /*  BetSlipSheet.tsx) adapted to a scale-in-from-compressed mount     */
  /*  instead of an in-place pulse, since the pill has no prior on-      */
  /*  screen shape to morph from.                                        */
  /* --------------------------------------------------------------- */
  ocbPillMotion: {
    // Entrance — from a compressed state, overshoots slightly, settles.
    enter: {
      fromScaleX: 0.9,
      fromScaleY: 0.72,
      overshootScaleX: 1.04,
      overshootScaleY: 1.08,
      // Same family as BetSlipSheet's ENTRY_PULSE_SPRING (stiffness 320,
      // damping 12) — a touch more damped so the overshoot reads as
      // "subtle" per spec, not a bounce.
      spring: { stiffness: 320, damping: 14 },
      // Reduced-motion fallback: no overshoot, just a short scale+opacity
      // tween straight to rest.
      reducedDurationMs: 140,
    },
    // Exit — plays ONLY after a cancelled hold's fill has finished
    // reversing to 0 (session phase 'exiting'), never on successful
    // completion. Compresses vertically, stretches slightly horizontally,
    // fades out near the end. Smooth ease-in for a controlled, natural exit.
    exit: {
      toScaleX: 1.05,
      toScaleY: 0.82,
      durationMs: 160,
      easing: [0.5, 0, 0.3, 1] as const, // smooth ease-in
      reducedDurationMs: 120,
    },
  },

  /* --------------------------------------------------------------- */
  /*  ONE CLICK BET FLOATING PILL — progress VFX (moving edge glow,     */
  /*  outer glow, internal particles). All driven by the SAME             */
  /*  `progress` value the pill already receives every rAF frame from      */
  /*  the session — no separate timers, no extra React state. Primary       */
  /*  accent is #8F2EFF (new Figma energy color), distinct from the           */
  /*  retired inline hold's lime/cyan selected-state palette (that palette     */
  /*  belonged to the selection button itself, not this pill, so it wasn't      */
  /*  transferred — see CLAUDE.md).                                              */
  /* --------------------------------------------------------------- */
  ocbVfx: {
    energyColor: '#8F2EFF',
    // Moving edge — reworked from the retired inline hold's own trailing-
    // edge treatment (`.qb-hold::before`'s `box-shadow: inset -10px 0 14px
    // -6px rgba(...progress*0.5)`), NOT the free-floating radial band this
    // originally shipped with. That band was centered ON the fill/unfilled
    // boundary and bled a soft halo across it in both directions, which
    // read as a blurry border and made the true completion point hard to
    // judge. The inline hold's version stayed INSET — glowing inward from
    // the edge, never past it — because an `inset` shadow can't escape its
    // own element's box. Reproduced here the same way: `insetGlow` is
    // applied directly to the fill div (which is exactly `progress`-wide),
    // so it's always masked to the already-filled track and can never
    // bleed into unfilled territory. `cap` adds a crisp (non-blurred)
    // bright line flush with the fill's true right edge on top of that
    // glow, so the exact completion boundary stays legible even while the
    // soft glow is going.
    edge: {
      insetGlow: {
        offsetPx: -14,
        blurPx: 20,
        spreadPx: -6,
        maxAlpha: 0.55,
      },
      cap: {
        // Widened from an initial 3px + hard-edged gradient (which, once
        // masked flush with the fill's clipped edge, read as a rigid
        // vertical LINE rather than a glow) to a wider, multi-stop gradient
        // + a small blur so it feathers into a genuine soft glow instead —
        // still fully contained by the fill div's own `overflow-hidden`,
        // same as the inset glow above.
        widthPx: 26,
        blurPx: 3,
        maxOpacity: 0.95,
        // Fraction of progress over which the cap fades in from 0 — avoids
        // a static bright line sitting at the pill's start the instant a
        // hold begins.
        fadeInEnd: 0.05,
      },
    },
    // Outer glow — layered box-shadow on the pill root, intensity mapped
    // from progress^glowExponent (matches the retired inline hold's
    // progress-squared curve: stays nearly invisible early, builds
    // noticeably by mid-hold). No independent animation — recomputed
    // every render alongside the progress prop.
    glow: {
      glowExponent: 2,
      innerBlurPx: 18,
      innerSpreadPx: 1,
      innerMaxAlpha: 0.55,
      outerBlurPx: 32,
      outerSpreadPx: 2,
      outerMaxAlpha: 0.35,
    },
    // Internal energy particles — small fixed pool, CSS-driven travel
    // (no per-frame JS/state). Each has a size/duration/delay so the set
    // reads as varied without generating random values on every render.
    // `delayMs` is deliberately NEGATIVE for every particle: a positive
    // `animation-delay` holds the element at its un-animated resting spot
    // (roughly mid-pill, since the animation's own "from" transform hasn't
    // applied yet) until the delay elapses — with 5 staggered positive
    // delays that read as particles frozen in place at the start of every
    // hold, only "waking up" one by one. A negative delay instead starts
    // the animation as if it were already that far into its cycle, so on
    // the very first rendered frame every particle is already mid-flight
    // (different position per particle, since the offsets differ) rather
    // than static.
    particles: [
      { sizePx: 3, topPct: 30, durationMs: 1400, delayMs: -200 },
      { sizePx: 2, topPct: 60, durationMs: 1700, delayMs: -900 },
      { sizePx: 4, topPct: 45, durationMs: 1550, delayMs: -300 },
      { sizePx: 2, topPct: 72, durationMs: 1900, delayMs: -1400 },
      { sizePx: 3, topPct: 18, durationMs: 1650, delayMs: -700 },
    ],
    // Particle opacity floor/ceiling — interpolated by progress so density
    // *reads* as increasing slightly as the hold advances, per spec. Bumped
    // up from an initial 0.25/0.7 — the white-cored glow below reads softer
    // than the original flat-purple dot, so it needed more opacity headroom
    // to stay clearly visible rather than washing out.
    particleMinOpacity: 0.35,
    particleMaxOpacity: 0.9,
  },

  /* --------------------------------------------------------------- */
  /*  EXPLORATION — Sparkles + fire sparks                           */
  /* --------------------------------------------------------------- */
  // Edge-flash sparkles now appear at T1+, with density rising per tier.
  // (Previously T3-only at 4500ms/2-4 count.)
  sparkles: {
    byTier: {
      1: { intervalMs: 8000, countMin: 1, countMax: 2 },
      2: { intervalMs: 5500, countMin: 1, countMax: 3 },
      3: { intervalMs: 4500, countMin: 2, countMax: 4 },
      // T4 — same per-burst behavior as T2 (the "edge-flash" look the
      // user asked for) but at much higher density. Fires roughly
      // 4× more often with 2× more flashes per burst.
      4: { intervalMs: 1300, countMin: 4, countMax: 8 },
    } as Record<number, { intervalMs: number; countMin: number; countMax: number }>,
    durationMs: 700, // lifetime of each flash (carried over from tier3.sparkleDurationMs)
  },
  // T3 only — rising "fire sparks" emitted from the TOP of the button
  // that float upward past the button while fading. Continuous emission.
  // Spawn position is at/near the top edge so the visible flight happens
  // OUTSIDE the button rather than within it.
  fireSparks: {
    spawnIntervalMs: 220, // new particle every ~220ms
    spawnCountMin: 1,
    spawnCountMax: 2,
    // Rise distance (px upward). Kept short so embers stay CLOSE to the
    // button — like sparks just above a flame, not a tall fountain.
    riseMinPx: 22,
    riseMaxPx: 48,
    // Horizontal drift/sway range (px, ±) — subtle wander.
    driftMaxPx: 12,
    // Particle size range (px).
    sizeMinPx: 2,
    sizeMaxPx: 3.5,
    // Lifetime range (ms) — shorter so embers fade quickly without
    // drifting far from the source.
    lifetimeMinMs: 800,
    lifetimeMaxMs: 1400,
    // Cap simultaneous active particles to prevent buildup.
    maxActive: 20,
    // Spawn origin Y as percentage FROM THE BOTTOM of the button.
    // [0.85, 1.05] = at or just above the top edge — sparks visibly emerge
    // from the top of the "fire" and rise into the air just above.
    spawnOriginYRangePct: [0.85, 1.05] as [number, number],
  },

  /* --------------------------------------------------------------- */
  /*  PASS 3 — Tier 3 odds effect (flames | smoke)                   */
  /*  The heat-haze duplicate-text layer is REMOVED in this pass.    */
  /*  Default is flames; runtime-togglable in ?debug=true overlay.   */
  /* --------------------------------------------------------------- */
  tier3OddsEffect: 'flames' as 'flames' | 'smoke',
  flames: {
    // Four layered text-shadow halos around the glyph edges. Each entry
    // is [blurRadiusPx, baseOpacity]. All stay inside the existing purple
    // accent — same hue, varying intensity. No new accent colors.
    layers: [
      [4, 0.8], // inner
      [10, 0.6], // mid
      [20, 0.35], // outer
      [32, 0.18], // far
    ] as Array<[number, number]>,
    // Synchronized slow pulse on all four layers (±30% around base).
    pulseDurationMs: 2000,
    pulseAmplitude: 0.3,
    // Fifth fast flicker layer — small blur, brightness oscillates 30–70%.
    flickerBlurPx: 6,
    flickerOpacityMin: 0.3,
    flickerOpacityMax: 0.7,
    // Deterministic sum-of-sines (3 components) for the flicker — feels
    // random but is reproducible and pausable for reduced-motion.
    flickerSines: [
      { freqHz: 8.3, weight: 0.45 },
      { freqHz: 13.7, weight: 0.35 },
      { freqHz: 19.1, weight: 0.2 },
    ],
  },
  smoke: {
    // How often a new blob spawns (ms).
    spawnIntervalMs: 350,
    // Blob lifetime range — randomized per spawn.
    lifetimeMinMs: 1800,
    lifetimeMaxMs: 2400,
    // Blob initial size range (px).
    sizeMinPx: 8,
    sizeMaxPx: 14,
    // Opacity at peak (during early life). Stays bright purple — no gray.
    opacityMinPeak: 0.08,
    opacityMaxPeak: 0.15,
    // Vertical translate (negative Y = upward).
    riseMinPx: 30,
    riseMaxPx: 50,
    // Scale grows over life (1 → 1.6 by spec).
    scaleEnd: 1.6,
    // Blur applied to the smoke LAYER (never to text).
    layerBlurPx: 3,
    // Cap simultaneous active blobs.
    maxBlobs: 12,
  },
  // Border light: a single traveling head rendered as TWO stacked stroke
  // layers (sharp core + wider soft halo) sharing one dashoffset. This is
  // not two heads — it's one head with a "core + bloom" structure that
  // makes the light read as glow rather than a drawn line.
  borderLight: {
    // Approved purple — used ONLY for the border-light effect.
    color: '#9730ff',
    // Sharp inner core: thicker than the original 2px (50% increase).
    coreStrokeWidthPx: 3,
    coreBlurStdDev: 2.5,
    // Wider, more diffuse outer halo at 50% of the core opacity.
    haloStrokeWidthPx: 4,
    haloBlurStdDev: 6,
    haloOpacityRatio: 0.5,
  },

  /* --------------------------------------------------------------- */
  /*  AMBIENT BREATHING (all tiers ≥ 1)                              */
  /*  Microinteraction (e): rate scales with tier.                   */
  /* --------------------------------------------------------------- */
  breath: {
    // Soft inhale/exhale — 1.000 → 1.008 → 1.000 (used T1–T3).
    amplitude: 0.008,
    // T4 — more pronounced breath (~2.5× T3's amplitude) so the
    // legendary tier visibly "inhales" rather than micro-pulses. Falls
    // back to `amplitude` for any tier not listed.
    amplitudeByTier: {
      4: 0.02,
    } as Record<number, number>,
    // Period in ms per tier. Picked: T1 calm, T2 quicker, T3 quicker
    // still, T4 quickest.
    periodByTier: {
      1: 4000,
      2: 3000,
      3: 2000,
      4: 2200,
    } as Record<number, number>,
    // Per-tier rhythm override map. Currently empty — every tier uses
    // the default smooth sine wave. The 'heartbeat' rhythm (lub-dub
    // double-pulse + long rest) was tried at T4 and reverted because
    // the steady sine reads as more eye-catching at the faster T4
    // amplitude (0.020 vs T1–T3's 0.008). Code branch for 'heartbeat'
    // remains live in ButtonPreviewMomios — just add `4: 'heartbeat'`
    // here to re-enable. See `pre-heartbeat-revert` git tag.
    rhythmByTier: {} as Record<number, 'sine' | 'heartbeat'>,
  },

  /* --------------------------------------------------------------- */
  /*  TIER 1 — Intermedio                                            */
  /* --------------------------------------------------------------- */
  tier1: {
    // Full loop of border light dash around the perimeter (slow at this tier).
    borderSweepDurationMs: 4500,
    // Visible portion of the loop (rest is quiet pause). 0..1.
    borderSweepActiveRatio: 0.35,
    borderSweepOpacity: 0.3,
    // Length of the lit dash segment (px along the stroke path).
    borderDashLengthPx: 26,
    // Odds typography breathing pulse loop (independent of button breath).
    oddsPulseDurationMs: 3000,
    oddsPulseScaleMax: 1.02,
    oddsPulseOpacityMin: 0.92,
    // Count badge pulse when the selection count value changes.
    countPulseScaleMax: 1.08,
    countPulseDurationMs: 220,
    countPulseGlowColor: 'rgba(151,48,255,0.7)', // existing accent
    // ----- First-selection count-up sweep (T0 → T1 transition) -----
    // Fires exactly once per session, on the very first 0 → 1 selection
    // change. The odds slot roll uses a longer duration so the number
    // visibly RAMPS UP instead of snapping, and the odds container gets
    // a brief celebratory scale pulse. After this one-shot, subsequent
    // odds changes use the default slotDurationMs.
    firstSelectionCountUp: {
      slotDurationMs: 800,    // vs default 380
      pulseScalePeak: 1.08,
      pulseDurationMs: 500,
    },
  },

  /* --------------------------------------------------------------- */
  /*  TIER 2 — Súper                                                 */
  /* --------------------------------------------------------------- */
  tier2: {
    borderSweepDurationMs: 2500,
    borderSweepActiveRatio: 0.65,
    borderSweepOpacity: 0.55,
    borderDashLengthPx: 34,
    // Soft outer glow using existing button palette.
    glowBlurPx: 22,
    glowOpacityMax: 0.26,
    glowOpacityMin: 0.18, // floor raised so it doesn't dim too far
    // Slower, gentler breathing.
    glowPulseDurationMs: 6000,
    // EXPLORATION — stroke shine sweep now appears at T2 too, but dimmer
    // and slower than T3 (a subtle "hint" of the T3 effect).
    strokeSweepDurationMs: 2800, // slower glide than T3's 2000ms
    strokeSweepOpacityFactor: 0.3, // ~30% of T3 brightness
    // +40% glow flash when odds update.
    glowFlashBoost: 0.4,
    glowFlashDurationMs: 300,
    // Inner highlight rim — out of phase with outer glow.
    // POLISH PASS — phase offset doubled (600 → 1200ms) to preserve the
    // out-of-phase relationship after the cycle slowdown.
    innerRimOpacityMax: 0.2,
    innerRimPhaseOffsetMs: 1200,
    innerRimBlurPx: 0,
    // One-step heavier font on the odds.
    oddsFontWeight: 800,
    oddsTextShadow: '0 0 6px rgba(151,48,255,0.45)',
    // Weight-gain anchor: one-shot when tier 2 is reached.
    weightAnchorTranslateYPx: 1,
    weightAnchorShadowMax: '0 2px 0 rgba(151,48,255,0.3)',
    weightAnchorDurationMs: 600,
    // Selection counter glow flash.
    counterUpdateGlowDurationMs: 700,
    // POLISH PASS — odds glow halo configuration.
    // Static text-shadow stack giving the digits a "lit from within" feel.
    oddsHaloStaticOpacity: 0.4,
    // Surge multiplier applied to halo opacity for 300ms when the odds change.
    oddsHaloUpdateBoost: 1.5,
    oddsHaloUpdateDurationMs: 300,
  },

  /* --------------------------------------------------------------- */
  /*  TIER 3 — Máximo                                                */
  /* --------------------------------------------------------------- */
  tier3: {
    // POLISH PASS — single head only (secondary head removed).
    // Cycle slightly faster (1800 → 1600) and opacity bumped (0.7 → 0.8)
    // to compensate for losing the second head.
    borderSweepDurationMs: 1600,
    borderSweepActiveRatio: 1.0,
    borderSweepOpacity: 0.8,
    borderDashLengthPx: 44,
    glowBlurPx: 28,
    glowOpacityMax: 0.5,
    glowOpacityMin: 0.36, // clearly brighter than T2 (0.18–0.26)
    // Slower, gentler breathing.
    glowPulseDurationMs: 4800,
    // Primary fire shimmer cycle on the odds text.
    fireSweepDurationMs: 2000,
    // Layered faster secondary shimmer — creates cross-flicker.
    fireSweepSecondaryDurationMs: 1200,
    // Heat-haze duplicate text layer.
    heatHazeBlurPx: 0.4,
    heatHazeOpacityMax: 0.3,
    heatHazePeriodMs: 1500,
    // Calmer intermittent tremor.
    tremorAmplitudePx: 0.3,
    tremorFrequencyHz: 12,
    // Intermittence envelope: tremor active for `burstMs` every `cycleMs`.
    tremorCycleMs: 1500,
    tremorBurstMs: 220,
    // Sparkle particles at long intervals (sparse).
    sparkleIntervalMs: 4500,
    sparkleDurationMs: 700,
    // On-add radial ring burst (the "you're cooking" moment).
    radialBurstDurationMs: 500,
    radialBurstStartPx: 1,
    radialBurstEndPx: 60,
    radialBurstOpacityStart: 0.5,
    // Magnetic pointer attraction — only at Tier 3.
    magneticRadiusPx: 60,
    magneticMaxTranslatePx: 3,
    magneticSpringStiffness: 280,
    magneticSpringDamping: 28,
    // POLISH PASS — odds glow at Tier 3.
    // The halo opacity breathes between min/max on this cycle.
    oddsHaloOpacityMin: 0.4,
    oddsHaloOpacityMax: 0.7,
    oddsHaloBreatheDurationMs: 2000,
    // Per-character brightness wave: every interval, a "shimmer" runs L→R
    // across each character, lasting `waveCharDurationMs` per char with a
    // `waveCharStaggerMs` lead between adjacent chars.
    oddsCharWaveIntervalMs: 3000,
    oddsCharWaveDurationMs: 120,
    oddsCharWaveStaggerMs: 60,
    oddsCharWaveBrightnessMax: 1.4,
    // Selection-add reward burst on the odds itself (in addition to the
    // settle overshoot): scale 1 → 1.08 over 300ms ease-out.
    oddsAddBurstScale: 1.08,
    oddsAddBurstDurationMs: 300,
    // POLISH PASS — outline ripple (NEW, distinct from center radial burst).
    // Button-shaped ghost border that expands outward from the button outline.
    // EXPLORATION — made "mainly brighter": higher start opacity + thicker
    // stroke, same 1.18 expansion size and 600ms timing.
    outlineRippleScalePeak: 1.18,
    outlineRippleStrokeStartPx: 3, // was 2
    outlineRippleStrokeEndPx: 1, // was 0.5 — stays visible longer as it thins
    outlineRippleOpacityStart: 0.85, // was 0.55
    outlineRippleDurationMs: 600,
    outlineRippleEase: [0.16, 1, 0.3, 1] as [number, number, number, number],
    // Cap simultaneous outline ripples; older ones drop off when exceeded.
    outlineRippleMaxStacked: 3,
    // ---- PROMINENT outline ripple (TIER-CROSSING UP into T3 or T4) ----
    // Fires only when the user crosses INTO T3 (from T2) or INTO T4
    // (from T3). NOT fired on regular selection adds at T3/T4 — those
    // keep the standard ripple parameters above. The values mirror the
    // T3 oddsRipple (1.5x scale, 1100ms duration, max opacity) so the
    // "level-up" outline ripple feels like a sibling to the odds
    // ripple that fires every odds change.
    outlineRippleProminentScalePeak: 1.55,
    outlineRippleProminentStrokeStartPx: 5,
    outlineRippleProminentStrokeEndPx: 2,
    outlineRippleProminentOpacityStart: 1.0,
    outlineRippleProminentDurationMs: 1100,
    // Motion-blur trace: as the prominent ripple expands outward, its
    // blur filter ramps from 0px → maxBlurPx over the duration. The
    // expanding ring smears progressively, leaving a soft trail behind
    // it that reads as motion blur (faster a thing moves, the more it
    // smears). Only the prominent variant gets this — the standard
    // ripple stays sharp.
    outlineRippleProminentMaxBlurPx: 4,
    // Ganancia (potential winnings) gets the same odds-glow treatment
    // scaled down by this factor at Tier 3.
    ganaGlowScaleDown: 0.7,
    // ----- Odds ripple (T3 only) -----
    // A ghost copy of the Momio digits scales outward + fades on every
    // selection ADD. Pairs with a transient drop-shadow flash on the
    // source text (see oddsBurstControls.start() in ButtonPreviewMomios).
    // Same easing curve + timing language as outlineRipple so the two
    // ripples feel like one family.
    oddsRippleScalePeak: 1.5,
    oddsRippleOpacityStart: 0.95,
    oddsRippleDurationMs: 1200,
    oddsRippleEase: [0.16, 1, 0.3, 1] as [number, number, number, number],
    oddsRippleMaxStacked: 3,
    oddsRippleGlowInnerPx: 8,
    oddsRippleGlowOuterPx: 18,
    // Source-text glow flash peak (drop-shadow blur radius). Applied via
    // the existing oddsBurstControls scale animation so timing matches
    // the rest of the T3 add-burst (300ms ease-out).
    oddsAddBurstFlashBlurPx: 14,
  },

  /* --------------------------------------------------------------- */
  /*  TIER 4 — Legendario                                            */
  /*  Inherits everything from T3 (additive) and adds/overrides:     */
  /*    1. Fire-sparks emitter — faster + denser.                    */
  /*    2. Continuous "subtle shake" replacing T3's burst-tremor.    */
  /*    3. Gana CTA shimmer wave turns gold (see .fire-shimmer-gold).*/
  /* --------------------------------------------------------------- */
  tier4: {
    // (Continuous shake removed before this landed on main — T4 has
    // no tremor / shake. The shake-amplitude / shake-frequency tuning
    // is kept on the `tier_4` branch for future exploration.)
    // ----- Outer glow boost (was 0.36–0.50 / 4800ms at T3) -----
    // Brighter envelope + a faster breath cycle so the halo reads as
    // "stoked" relative to T3's calmer pulse.
    glowOpacityMin: 0.55,
    glowOpacityMax: 0.78,
    glowPulseDurationMs: 3600,
    // ----- Subtle white glow on all four numbers -----
    // Applied as a drop-shadow filter on each numeric element's wrapper
    // (Bets, Momio, Monto, Gana). Keeps text readable; reads as a soft
    // luminous outline.
    numberGlow: 'drop-shadow(0 0 4px rgba(255,255,255,0.55))',
    // ----- Fire-sparks magnetic INFLOW (T4 only) -----
    // T3 emits sparks UPWARD from the top of the button (kinetic energy
    // escaping). T4 flips the vector: round particles spawn at the four
    // sides of a container that extends `inflowOffsetPx` outside the
    // button, then converge toward a jittered point near the button
    // center. Same density as the T3 emitter; opposite direction.
    fireSparksInflow: true,
    fireSparksInflowOffsetPx: 50,
    // Spawn rate matches the T3 "racing" feel — frequent enough that
    // there are usually 6–10 particles in flight at any moment.
    fireSparksSpawnIntervalMs: 130,
    fireSparksSpawnCountMin: 2,
    fireSparksSpawnCountMax: 3,
    fireSparksLifetimeMinMs: 700,
    fireSparksLifetimeMaxMs: 1100,
    fireSparksMaxActive: 32,
    // ----- Weightier slot roll at T4 -----
    // The cumulative odds digit changes feel slower + more deliberate
    // at T4. 480ms vs the default 380ms — the number ARRIVES instead
    // of just landing.
    slotDurationMs: 480,
    // ----- Ambient Siri-style perimeter vignette -----
    // A multi-color conic gradient (Apple "Intelligence" palette —
    // magenta → violet → indigo → amber → back to magenta) rotates
    // around the screen perimeter, masked to the outer ~45% of the
    // radius so the markets / offers in the center stay untouched.
    // Models the iOS 26 Siri activation glow.
    //
    // Structure (see App.tsx):
    //   outer div = radial mask + fade-in opacity on tier enter/leave
    //   inner div = rotating conic gradient (200% × 200% with -50%
    //               offset so rotation doesn't reveal empty corners)
    //
    // Color stops are hard-coded in the conic-gradient string in
    // App.tsx (extracting them here would require runtime template
    // assembly, which is fragile).
    vignette: {
      // Steady-state opacity at T4. The rotation animation does the
      // motion; opacity stays constant once the fade-in completes.
      opacityMax: 0.85,
      // Fade in / out duration when tier enters / leaves T4.
      fadeInMs: 700,
      // Full conic rotation period in seconds. 16s feels meditative;
      // 10s reads as "more energy"; 24s feels more contemplative.
      rotationDurationSec: 16,
    },
  },

  /* --------------------------------------------------------------- */
  /*  TIER-CROSSING ONE-SHOTS                                        */
  /* --------------------------------------------------------------- */
  crossing: {
    // Up-cross: TWO light heads spawn from the top and travel in opposite
    // directions around the perimeter, meeting at the bottom.
    twoHeadDurationMs: 600,
    twoHeadDashLengthPx: 30,
    twoHeadOpacityPeak: 0.95,
    // Brief collision flash at the bottom of the button (300ms after spawn).
    collisionFlashDurationMs: 220,
    collisionFlashSizePx: 24,
    collisionFlashDelayMs: 300,
    // Up-cross scale pulse — bumpier spring for overshoot.
    upPulseScalePeak: 1.06,
    upPulseDurationMs: 450,
    upSpringStiffness: 320,
    upSpringDamping: 11,
    // Mandatory radial bloom from center on every up-cross.
    bloomDurationMs: 650,
    bloomScale: 1.6,
    bloomOpacityMax: 0.4,
    // One floating sparkle from the collision point.
    sparkleFloatDurationMs: 800,
    sparkleFloatRisePx: 18,
    // Down-cross — quieter inverse. Single dim reverse sweep, no scale, no sparkle.
    downSweepDurationMs: 700,
    downSweepOpacity: 0.4,
    downDashLengthPx: 22,
  },

  /* --------------------------------------------------------------- */
  /*  PASS 3 — ENTRY / EXIT animation (mount/unmount of the slip)    */
  /*  Fires when selections goes 0 → 1 (entry) or 1 → 0 (exit).       */
  /*  Bouncy entry fires ONLY on the very first mount of the session.*/
  /* --------------------------------------------------------------- */
  entry: {
    // REGRESSION FIX — clearer starting offset (80px below) + less-compressed
    // scale (0.85 not 0.3) per the new spec. Springs with intentionally low
    // damping to GUARANTEE a visible overshoot — the "bob" past endpoint.
    fromY: 80,
    fromScale: 0.85,
    fromOpacity: 0,
    toY: 0,
    toScale: 1,
    toOpacity: 1,
    // y spring — stiffness 380, damping 14, mass 1. Low damping → overshoot.
    ySpring: { stiffness: 380, damping: 14, mass: 1 },
    // scale spring — stiffness 300, damping 12, mass 1. Briefly oversizes
    // to ~1.05 before settling at 1.0.
    scaleSpring: { stiffness: 300, damping: 12, mass: 1 },
    // Fast opacity — button is visible from start of its rise.
    opacityDurationMs: 220,
  },
  exit: {
    toY: 30,
    toScale: 0.4,
    toOpacity: 0,
    // Sharp drop-off easing per the brief.
    ease: [0.7, 0, 0.84, 0] as [number, number, number, number],
    yScaleDurationMs: 280,
    opacityDurationMs: 200,
  },
  // Velocity-derived landing squash. As y velocity goes large negative
  // (button falling fast into place), scaleY compresses and scaleX
  // stretches. As velocity decays, squash returns to neutral.
  landingSquash: {
    velocityCenter: 0,
    velocityRange: 1500, // px/s
    // [largeNeg, 0, largePos] → [scaleY, scaleY, scaleY]
    scaleYRange: [0.94, 1, 1.02] as [number, number, number],
    scaleXRange: [1.04, 1, 0.98] as [number, number, number],
  },

  /* --------------------------------------------------------------- */
  /*  ACCESSIBILITY                                                  */
  /* --------------------------------------------------------------- */
  // When prefers-reduced-motion is set, only one-shot slot rolls survive,
  // and even those are compressed to this shorter duration.
  reducedMotionSlotDurationMs: 180,
} as const;

export type ButtonProgressionConfig = typeof buttonProgressionConfig;

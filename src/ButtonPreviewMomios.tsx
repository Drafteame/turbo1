import {
  animate,
  AnimatePresence,
  motion,
  useAnimation,
  useAnimationFrame,
  useMotionValue,
  useMotionValueEvent,
  useSpring,
  useTransform,
} from 'framer-motion';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
// EXPLORATION — BorderLight import removed. The orbital traveling-head
// glow has been replaced with a layered box-shadow stack on the pill
// shell, driven by the same logic as the odds text-shadow. The file
// BorderLight.tsx is intentionally left on disk in case we revert.
import { buttonProgressionConfig as cfg } from './buttonProgressionConfig';
import { OddsSmokeEffect } from './OddsEffects';
import { OddsRipple } from './OddsRipple';
import { OutlineRipple } from './OutlineRipple';
import { playSound } from './playSound';
import { SlotNumber } from './SlotNumber';
import type { Tier } from './types';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

/* =================================================================== */
/*  TIER DETECTION — pure function                                     */
/* =================================================================== */
export function tierForOdds(odds: number): Tier {
  for (let i = cfg.tiers.length - 1; i >= 0; i--) {
    if (odds >= cfg.tiers[i].minOdds) return cfg.tiers[i].id;
  }
  return 0;
}

/* =================================================================== */
/*  Helpers                                                            */
/* =================================================================== */
const formatOdds = (n: number) => `${n.toFixed(2)}x`;

type Sparkle = { id: number; x: number; y: number; size: number };

/* =================================================================== */
/*  Public live state — exposed for the debug overlay                  */
/* =================================================================== */
export type ButtonLiveState = {
  tier: Tier;
  cumulativeOdds: number;
  tremorActive: boolean;
  borderPhase: number; // 0..1 — primary sweep position
  breathPhase: number; // 0..1 — breathing cycle position
};

type Props = {
  selectionCount: number;
  cumulativeOdds: number;
  /** Multiplier to slow all ambient animations (debug overlay sets 3). */
  speedScale?: number;
  /** Callback fired whenever live ambient phase values change. */
  onLiveState?: (s: ButtonLiveState) => void;
  /** PASS 3 — Tier 3 odds effect variant. Default 'flames'. */
  tier3OddsEffect?: 'flames' | 'smoke';
};

export function ButtonPreviewMomios({
  selectionCount,
  cumulativeOdds,
  speedScale = 1,
  onLiveState,
  tier3OddsEffect = cfg.tier3OddsEffect,
}: Props) {
  // MASTER SWITCH — when `cfg.animationsEnabled` is false, treat the button
  // as reduced-motion. This reuses every existing `!reduced` gate to suppress
  // all ambient effects + progression micro-interactions in one place. Number
  // rolls (SlotNumber) still play — reduced only shortens their duration — and
  // the slip entry/exit (BetSlipShell) is independent of this flag.
  const reduced = usePrefersReducedMotion() || !cfg.animationsEnabled;
  const tier = tierForOdds(cumulativeOdds);

  /* =============================================================== */
  /*  STATE — tier crossing detection (up vs down)                   */
  /* =============================================================== */
  const prevTierRef = useRef<Tier>(tier);
  const [crossing, setCrossing] = useState<{
    dir: 'up' | 'down';
    fromTier: Tier;
    toTier: Tier;
    key: number;
  } | null>(null);
  const crossingKeyRef = useRef(0);

  useEffect(() => {
    const prev = prevTierRef.current;
    if (tier === prev) return;
    crossingKeyRef.current += 1;
    const dir: 'up' | 'down' = tier > prev ? 'up' : 'down';
    setCrossing({ dir, fromTier: prev, toTier: tier, key: crossingKeyRef.current });
    playSound(dir === 'up' ? 'tier-up' : 'tier-down');
    prevTierRef.current = tier;
    const lifetime =
      dir === 'up'
        ? Math.max(
            cfg.crossing.twoHeadDurationMs,
            cfg.crossing.bloomDurationMs,
            cfg.crossing.upPulseDurationMs,
            cfg.crossing.sparkleFloatDurationMs,
          ) + 80
        : cfg.crossing.downSweepDurationMs + 60;
    const t = setTimeout(() => setCrossing(null), lifetime);
    return () => clearTimeout(t);
  }, [tier]);

  /* =============================================================== */
  /*  MEASUREMENT — button shell width for SVG border lights         */
  /* =============================================================== */
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [shellSize, setShellSize] = useState<{ w: number; h: number }>({
    w: 0,
    h: cfg.borderHeightPx,
  });
  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        setShellSize({
          w: Math.round(e.contentRect.width),
          h: Math.round(e.contentRect.height),
        });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* =============================================================== */
  /*  AMBIENT — micro-tremor (Tier 3) with INTERMITTENCE             */
  /*  Calmer than pure sine: tremor is active only for a short burst */
  /*  every cycleMs. Quiet between bursts.                           */
  /* =============================================================== */
  const tremorX = useMotionValue(0);
  const tremorY = useMotionValue(0);
  const [tremorActive, setTremorActive] = useState(false);
  // T3 only — intermittent burst-tremor (with quiet phases between
  // bursts). T4 intentionally has NO shake; the boosted glow / dense
  // sparkles / gold sweep carry the "elevated" feel without motion.
  const tremorOn = tier === 3 && !reduced;
  useAnimationFrame((t) => {
    if (!tremorOn) {
      if (tremorActive) setTremorActive(false);
      tremorX.set(0);
      tremorY.set(0);
      return;
    }
    // T3 — intermittent burst-tremor.
    const {
      tremorAmplitudePx: amp,
      tremorFrequencyHz: hz,
      tremorCycleMs: cycle,
      tremorBurstMs: burst,
    } = cfg.tier3;
    const phase = t % cycle;
    if (phase > burst) {
      if (tremorActive) setTremorActive(false);
      tremorX.set(0);
      tremorY.set(0);
      return;
    }
    if (!tremorActive) setTremorActive(true);
    // Envelope fades in/out within the burst so edges aren't harsh.
    const env = Math.sin((phase / burst) * Math.PI);
    const w = (2 * Math.PI * hz) / 1000;
    tremorX.set(Math.sin(t * w) * amp * env * 0.7);
    tremorY.set(Math.sin(t * w * 1.31 + 0.7) * amp * env);
  });

  /* =============================================================== */
  /*  AMBIENT — breathing (tiers ≥ 1) — rate scales with tier        */
  /*  Microinteraction (e).                                          */
  /* =============================================================== */
  const breathScale = useMotionValue(1);
  const breathPhaseRef = useRef(0);
  useAnimationFrame((t) => {
    if (reduced || tier < 1) {
      breathScale.set(1);
      breathPhaseRef.current = 0;
      return;
    }
    const period = (cfg.breath.periodByTier[tier] ?? 4000) * speedScale;
    const phase = (t % period) / period;
    breathPhaseRef.current = phase;
    // Per-tier amplitude override (currently T4 only); rest fall back to
    // the global default.
    const amp =
      cfg.breath.amplitudeByTier[tier] ?? cfg.breath.amplitude;
    // Per-tier rhythm override (currently T4 = heartbeat). T1–T3 keep
    // the uniform sine wave; T4 switches to a lub-dub heartbeat: two
    // quick pulses inside the first ~22% of the period, then stillness
    // for the rest. Same amp, same period, totally different feeling.
    const rhythm = cfg.breath.rhythmByTier?.[tier] ?? 'sine';
    let scaleDelta: number;
    if (rhythm === 'heartbeat') {
      // First beat (lub) — 0..0.075 of the cycle.
      // Second beat (dub) — 0.12..0.215 of the cycle (slightly stronger).
      // Rest — 0.215..1.0 (~78% of the period at neutral).
      if (phase < 0.075) {
        scaleDelta = Math.sin((phase / 0.075) * Math.PI);
      } else if (phase >= 0.12 && phase < 0.215) {
        // The "dub" is fractionally stronger than the "lub" so the
        // pattern doesn't read as two identical taps.
        scaleDelta = 1.15 * Math.sin(((phase - 0.12) / 0.095) * Math.PI);
      } else {
        scaleDelta = 0;
      }
    } else {
      // Smooth sine: 1 → 1 + amp at 50% → 1 at 100%.
      scaleDelta = Math.sin(phase * Math.PI * 2);
    }
    breathScale.set(1 + amp * scaleDelta);
  });

  /* =============================================================== */
  /*  AMBIENT — outer glow (Tier 2+) + glow flash on odds update     */
  /* =============================================================== */
  const glowFlashUntilRef = useRef<number>(0);
  const glowProgress = useMotionValue(0);
  const glowOpacity = useMotionValue(0);
  // Smoothed glow output — low-pass filter on the raw target so tier
  // transitions don't snap (e.g. tier 2 → 1 used to jump opacity to 0
  // instantly; now it eases to 0 over a few frames).
  const prevGlowRef = useRef(0);
  useAnimationFrame((t) => {
    let target = 0;
    if (reduced || tier < 2) {
      glowProgress.set(0);
    } else {
      // T4 has its own brighter range + faster pulse; T3 keeps the
      // original calmer halo; T2 keeps its dim base. Each tier's
      // glow params live in cfg.tier{N}.
      const cur =
        tier === 4 ? cfg.tier4 : tier >= 3 ? cfg.tier3 : cfg.tier2;
      const dur = cur.glowPulseDurationMs * speedScale;
      const phase = (t % dur) / dur;
      const env = (1 - Math.cos(phase * Math.PI * 2)) / 2;
      const base = cur.glowOpacityMin + (cur.glowOpacityMax - cur.glowOpacityMin) * env;
      glowProgress.set(env);
      // Additive +40% flash boost when odds update. BUGFIX: compare
      // against performance.now() (the same clock used to SET
      // flashUntil) instead of the frame loop's `t`. If those two
      // clocks diverge, the `t < flashUntil` test could stay true
      // forever and the glow would stick bright and "never dim".
      // Using one clock guarantees the boost always expires.
      const now = performance.now();
      const flashUntil = glowFlashUntilRef.current;
      target = base;
      if (now < flashUntil) {
        const k = (flashUntil - now) / cfg.tier2.glowFlashDurationMs;
        target = Math.min(1, base * (1 + cfg.tier2.glowFlashBoost * k));
      }
    }
    // Lerp toward target (factor ~0.08 ≈ 250ms half-life @ 60fps).
    // The breath envelope itself changes slowly enough (4–6s period)
    // that the lerp tracks it without perceptible lag, but tier-change
    // snaps become smooth fades.
    const prev = prevGlowRef.current;
    const next = prev + (target - prev) * 0.08;
    prevGlowRef.current = next;
    glowOpacity.set(next);
  });
  // REGRESSION FIX (Approach B) — the previous box-shadow approach with
  // a non-zero `spread` value produced a visibly pill-shaped halo
  // (the spread literally inflates the shape outline before blurring).
  // Replaced with a duplicate blurred sibling element (rendered below)
  // whose opacity is driven directly by `glowOpacity`. This gives a
  // truly diffuse, shapeless glow.
  // The motion value's role is now: drive the sibling div's opacity.

  /* =============================================================== */
  /*  AMBIENT — inner highlight rim (Tier 3 ONLY now)                */
  /*  Moved from T2 → T3 so T2 keeps only the outer glow.            */
  /* =============================================================== */
  const innerRimOpacity = useMotionValue(0);
  useAnimationFrame((t) => {
    if (reduced || tier < 3) {
      innerRimOpacity.set(0);
      return;
    }
    const cur = cfg.tier3;
    const dur = cur.glowPulseDurationMs * speedScale;
    const offset = cfg.tier2.innerRimPhaseOffsetMs * speedScale;
    const phase = ((t + offset) % dur) / dur;
    const env = (1 - Math.cos(phase * Math.PI * 2)) / 2;
    innerRimOpacity.set(env * cfg.tier2.innerRimOpacityMax);
  });

  // PASS 3 — Heat-haze duplicate-text layer REMOVED. The doubled
  // appearance it produced was a bug. Tier 3 odds now use either layered
  // text-shadow halos (flames) or rising blurred accent blobs (smoke);
  // both keep the text itself perfectly crisp. See OddsEffects.tsx.

  /* =============================================================== */
  /*  AMBIENT — odds typography micro-pulse (Tier 1+)                */
  /* =============================================================== */
  const oddsPulseScale = useMotionValue(1);
  const oddsPulseOpacity = useMotionValue(1);
  useAnimationFrame((t) => {
    if (reduced || tier < 1) {
      oddsPulseScale.set(1);
      oddsPulseOpacity.set(1);
      return;
    }
    const dur = cfg.tier1.oddsPulseDurationMs * speedScale;
    const phase = (t % dur) / dur;
    const env = (1 - Math.cos(phase * Math.PI * 2)) / 2;
    oddsPulseScale.set(1 + (cfg.tier1.oddsPulseScaleMax - 1) * env);
    oddsPulseOpacity.set(1 - (1 - cfg.tier1.oddsPulseOpacityMin) * env);
  });

  /* =============================================================== */
  /*  AMBIENT — SVG border light sweeps (Tier 1+ primary; T3 second) */
  /*  Position is a 0..1 motion value driving strokeDashoffset.      */
  /* =============================================================== */
  // EXPLORATION — orbital border-light sweep removed. The shell's
  // outline glow is now a layered box-shadow stack driven by the same
  // logic as the odds text-shadow (see borderBoxShadow above).
  const sweepPhaseRef = useRef(0); // retained only for debug-overlay shape

  /* =============================================================== */
  /*  AMBIENT — sparkle edge flashes (T1+, density scales with tier) */
  /* =============================================================== */
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);
  const sparkleIdRef = useRef(0);
  useEffect(() => {
    if (tier < 1 || reduced) return;
    const tierConf = cfg.sparkles.byTier[tier];
    if (!tierConf) return;
    const interval = setInterval(() => {
      const count =
        tierConf.countMin +
        Math.floor(Math.random() * (tierConf.countMax - tierConf.countMin + 1));
      const fresh: Sparkle[] = [];
      for (let i = 0; i < count; i++) {
        const side = Math.floor(Math.random() * 4);
        const u = Math.random();
        let x = 0;
        let y = 0;
        if (side === 0) { x = u * 100; y = 0; }
        else if (side === 1) { x = 100; y = u * 100; }
        else if (side === 2) { x = u * 100; y = 100; }
        else { x = 0; y = u * 100; }
        fresh.push({ id: sparkleIdRef.current++, x, y, size: 2 + Math.random() * 2 });
      }
      setSparkles((s) => [...s, ...fresh]);
      setTimeout(
        () => setSparkles((s) => s.slice(fresh.length)),
        cfg.sparkles.durationMs,
      );
    }, tierConf.intervalMs);
    return () => clearInterval(interval);
  }, [tier, reduced]);

  /* =============================================================== */
  /*  AMBIENT — Fire sparks (rising particles at T3 / magnetic        */
  /*  inflow at T4)                                                   */
  /*                                                                  */
  /*  T3: continuous emission from inside the button — streak         */
  /*      particles float upward past the top edge while fading.      */
  /*      Reads as embers rising from a fire (energy escaping).       */
  /*                                                                  */
  /*  T4: container is expanded inflowOffsetPx in all 4 directions.   */
  /*      Round particles spawn at one of the 4 outer edges and       */
  /*      converge toward a jittered point near the button center.    */
  /*      Same density as T3 — opposite vector. Reads as a gravity    */
  /*      well pulling ambient energy IN (a different category, not   */
  /*      just "more fire").                                          */
  /* =============================================================== */
  type FireSpark = {
    id: number;
    spawnAtMs: number;
    // ---- T3 OUTFLOW fields (unused for inflow sparks) ----
    xPct: number;
    yPctFromBottom: number;
    rise: number;
    drift: number;
    sway: number;
    // ---- T4 INFLOW fields (undefined for T3 sparks) ----
    inflow?: {
      // Starting position in pixels, relative to the inflow container's
      // top-left. Container extends `inflowOffsetPx` outside the button
      // on all four sides, so the button occupies the central rectangle.
      startXPx: number;
      startYPx: number;
      // Pixel deltas applied via framer-motion `animate.x` / `animate.y`.
      // Sum (start + delta) lands on a jittered point inside the button.
      deltaXPx: number;
      deltaYPx: number;
    };
    size: number;
    lifetimeMs: number;
  };
  const [fireSparks, setFireSparks] = useState<FireSpark[]>([]);
  const fireSparkIdRef = useRef(0);

  useEffect(() => {
    if (tier < 3 || reduced) return;
    const fs = cfg.fireSparks;
    const isT4 = tier === 4;
    const useInflow = isT4 && cfg.tier4.fireSparksInflow;
    // T4 spawn-rate overrides; T3 falls back to fs base values.
    const spawnIntervalMs = isT4
      ? cfg.tier4.fireSparksSpawnIntervalMs
      : fs.spawnIntervalMs;
    const spawnCountMin = isT4 ? cfg.tier4.fireSparksSpawnCountMin : fs.spawnCountMin;
    const spawnCountMax = isT4 ? cfg.tier4.fireSparksSpawnCountMax : fs.spawnCountMax;
    const lifetimeMinMs = isT4 ? cfg.tier4.fireSparksLifetimeMinMs : fs.lifetimeMinMs;
    const lifetimeMaxMs = isT4 ? cfg.tier4.fireSparksLifetimeMaxMs : fs.lifetimeMaxMs;
    const maxActive = isT4 ? cfg.tier4.fireSparksMaxActive : fs.maxActive;
    // Inflow container geometry (only used when useInflow). Button width
    // is read from shellSize; if not yet measured we fall back to a sane
    // default so the very first spawn isn't visually broken.
    const off = cfg.tier4.fireSparksInflowOffsetPx;
    const btnW = shellSize.w > 0 ? shellSize.w : 358; // typical bet-slip width
    const btnH = cfg.borderHeightPx;
    const containerW = btnW + off * 2;
    const containerH = btnH + off * 2;
    // Pre-compute the button rectangle inside the container.
    const btnLeft = off;
    const btnRight = off + btnW;
    const btnTop = off;
    const btnBottom = off + btnH;
    const tick = setInterval(() => {
      setFireSparks((cur) => {
        if (cur.length >= maxActive) return cur;
        const count =
          spawnCountMin +
          Math.floor(Math.random() * (spawnCountMax - spawnCountMin + 1));
        const fresh: FireSpark[] = [];
        const now = performance.now();
        for (let i = 0; i < count; i++) {
          if (useInflow) {
            // T4 INFLOW — spawn on a random outer edge of the container,
            // animate toward a jittered point inside the button. Each of
            // the 4 sides spawns with equal probability so the magnetic
            // pull reads from all directions.
            const side = Math.floor(Math.random() * 4); // 0=top 1=bottom 2=left 3=right
            let startXPx: number;
            let startYPx: number;
            if (side === 0) {
              startXPx = Math.random() * containerW;
              startYPx = 0;
            } else if (side === 1) {
              startXPx = Math.random() * containerW;
              startYPx = containerH;
            } else if (side === 2) {
              startXPx = 0;
              startYPx = Math.random() * containerH;
            } else {
              startXPx = containerW;
              startYPx = Math.random() * containerH;
            }
            // Target point inside the button rectangle, with a small
            // jitter (±8px) so all particles don't converge on one dot.
            const jitter = 8;
            const targetX =
              btnLeft + Math.random() * (btnRight - btnLeft) +
              (Math.random() * 2 - 1) * jitter;
            const targetY =
              btnTop + Math.random() * (btnBottom - btnTop) +
              (Math.random() * 2 - 1) * jitter;
            fresh.push({
              id: fireSparkIdRef.current++,
              spawnAtMs: now,
              // Outflow fields unused but populated to keep the type happy.
              xPct: 0,
              yPctFromBottom: 0,
              rise: 0,
              drift: 0,
              sway: 0,
              inflow: {
                startXPx,
                startYPx,
                deltaXPx: targetX - startXPx,
                deltaYPx: targetY - startYPx,
              },
              size:
                fs.sizeMinPx + Math.random() * (fs.sizeMaxPx - fs.sizeMinPx),
              lifetimeMs:
                lifetimeMinMs +
                Math.random() * (lifetimeMaxMs - lifetimeMinMs),
            });
          } else {
            // T3 OUTFLOW — legacy behavior (rising streaks).
            fresh.push({
              id: fireSparkIdRef.current++,
              spawnAtMs: now,
              xPct: Math.random() * 100,
              yPctFromBottom:
                fs.spawnOriginYRangePct[0] +
                Math.random() *
                  (fs.spawnOriginYRangePct[1] - fs.spawnOriginYRangePct[0]),
              rise: fs.riseMinPx + Math.random() * (fs.riseMaxPx - fs.riseMinPx),
              drift: (Math.random() * 2 - 1) * fs.driftMaxPx,
              sway: (Math.random() * 2 - 1) * fs.driftMaxPx,
              size:
                fs.sizeMinPx + Math.random() * (fs.sizeMaxPx - fs.sizeMinPx),
              lifetimeMs:
                lifetimeMinMs +
                Math.random() * (lifetimeMaxMs - lifetimeMinMs),
            });
          }
        }
        return [...cur, ...fresh];
      });
    }, spawnIntervalMs);
    return () => clearInterval(tick);
  }, [tier, reduced, shellSize.w]);

  // GC expired fire sparks so the array doesn't grow unboundedly.
  useEffect(() => {
    if (tier < 3 || reduced) {
      setFireSparks([]);
      return;
    }
    const gc = setInterval(() => {
      const now = performance.now();
      setFireSparks((cur) =>
        cur.filter((s) => now - s.spawnAtMs < s.lifetimeMs),
      );
    }, 500);
    return () => clearInterval(gc);
  }, [tier, reduced]);

  /* =============================================================== */
  /*  ONE-SHOTS — selection-change reactions                         */
  /* =============================================================== */
  const lastCountRef = useRef(selectionCount);
  // T1 ONE-SHOT — fires exactly once per session on the very first
  // 0 → 1 selection change. Used to gate the "count-up sweep"
  // (longer slot roll + celebratory scale pulse) so it doesn't
  // repeat on every subsequent count change.
  const hasFirstSelectedRef = useRef(false);
  const countControls = useAnimation();
  const oddsSettleControls = useAnimation();
  const oddsBurstControls = useAnimation(); // POLISH PASS: T3 1.08 scale on add
  const [breath40, setBreath40] = useState(false); // anticipation 40ms compress
  const [addBurst, setAddBurst] = useState<number | null>(null); // center radial burst key (all tiers)
  // POLISH PASS — stacked outline ripples. Cap at 3 simultaneous.
  // Each ripple carries a `prominent` flag — false for normal selection
  // adds, true for tier-up crossings into T3/T4 (see the crossing effect
  // below). The `OutlineRipple` component branches its scale / stroke /
  // opacity / duration on this flag.
  const [outlineRipples, setOutlineRipples] = useState<
    Array<{ id: number; prominent: boolean }>
  >([]);
  // Odds ripples — T3-only ghost copies of the Momio digits that scale
  // outward + fade on every selection ADD. Each carries its odds-text
  // snapshot so the ghost doesn't re-render with the latest value mid-
  // animation.
  const [oddsRipples, setOddsRipples] = useState<
    Array<{ id: number; text: string }>
  >([]);

  /* =============================================================== */
  /*  REGRESSION FIX — Odds glow as a TEXT-SHADOW STACK on the real  */
  /*  text. No duplicate text elements (the previous duplicate-span  */
  /*  approach caused the "doubled odds" bug). The text-shadow is    */
  /*  layered halos OUTSIDE the glyph edges, so the text itself      */
  /*  stays perfectly crisp.                                         */
  /*                                                                 */
  /*  T0 / T1 : 'none'                                                */
  /*  T2      : 4-layer purple halo at static intensity, brief +50%   */
  /*            surge for 300ms on every odds update.                 */
  /*  T3 flames: 4 pulse layers (breathing on 2s cycle) + 5th flicker  */
  /*            layer with deterministic sum-of-sines opacity jitter.  */
  /*  T3 smoke : 4-layer baseline (smoke blobs render behind text).    */
  /* =============================================================== */
  // Glow is a layered drop-shadow FILTER (not text-shadow). text-shadow
  // was getting clipped into rectangles by each character's overflow:hidden
  // slot wrapper ("purple boxes"); a filter on a non-clipped wrapper hugs
  // the glyph shapes and extends freely.
  const oddsGlowFilter = useMotionValue<string>('none');
  const ganaGlowFilter = useMotionValue<string>('none');
  // EXPLORATION v3 — uniform borderColor flicker REMOVED. The user wants
  // a HORIZONTAL sweep across the stroke (like the odds shimmer), not a
  // global brightness change. The stroke base stays static #4b20ff via
  // the CSS class; an SVG overlay sibling renders the sweeping highlight,
  // animated below via useMotionValue + useAnimationFrame (not SMIL —
  // SMIL was rendering but its timing wasn't easy to verify; JS-driven
  // is explicit and lets the cycle duration follow speedScale too).
  const strokeSweepX = useMotionValue(-1);
  // Ref to the SVG linearGradient so we can imperatively rewrite its
  // gradientTransform each frame (cheaper than re-rendering React).
  const sweepGradRef = useRef<SVGLinearGradientElement | null>(null);
  useMotionValueEvent(strokeSweepX, 'change', (v) => {
    sweepGradRef.current?.setAttribute(
      'gradientTransform',
      `translate(${v} 0)`,
    );
  });
  // EXPLORATION — stroke sweep now runs at T2+ (was T3-only). The SVG
  // renders at both tiers; T2 is dimmer (opacity factor) and slower
  // (longer cycle) than T3. Driver lives in its own frame loop so it's
  // independent of the T3-gated odds-halo loop.
  useAnimationFrame((t) => {
    if (reduced || tier < 2) {
      strokeSweepX.set(-1);
      return;
    }
    const dur =
      (tier >= 3 ? 2000 : cfg.tier2.strokeSweepDurationMs) * speedScale;
    const phase = (t % dur) / dur; // 0 → 1
    strokeSweepX.set(-1 + phase * 2); // -1 → 1
  });
  const oddsGlowIntensityRef = useRef(1); // multiplier driven by surges/breath
  const oddsHaloOverrideUntilRef = useRef(0);
  const oddsHaloOverrideMultRef = useRef(1);
  // EXPLORATION — separate override channel for the border so tier-crossing
  // can surge the border glow without affecting the odds glow.
  const borderOverrideUntilRef = useRef(0);
  const borderOverrideMultRef = useRef(1);
  const borderOverrideTotalRef = useRef(0); // total surge duration for blend-out

  useAnimationFrame((t) => {
    // EXPLORATION — odds glow halo (Momio + Gana text-shadow) is T3-ONLY.
    // At T2 the odds carry no halo; T2 keeps only the outer diffuse glow,
    // the dim stroke sweep, and the inherited T1 ambient life.
    // NOTE: the stroke sweep is NOT driven here — it has its own frame
    // loop above that runs at T2+ (dimmer/slower than T3).
    if (reduced || tier < 3) {
      oddsGlowFilter.set('none');
      ganaGlowFilter.set('none');
      oddsGlowIntensityRef.current = 1;
      return;
    }

    // ---- base intensity multiplier per tier ----
    let mult = 1;
    if (tier === 3) {
      // Breathing pulse — slow inhale/exhale on the WHOLE shadow stack.
      const dur = cfg.tier3.oddsHaloBreatheDurationMs * speedScale;
      const phase = (t % dur) / dur;
      const env = (1 - Math.cos(phase * Math.PI * 2)) / 2;
      mult =
        cfg.tier3.oddsHaloOpacityMin / cfg.tier2.oddsHaloStaticOpacity +
        ((cfg.tier3.oddsHaloOpacityMax - cfg.tier3.oddsHaloOpacityMin) /
          cfg.tier2.oddsHaloStaticOpacity) *
          env;
    }

    // ---- odds one-shot surge blends out linearly ----
    let oddsMult = mult;
    if (t < oddsHaloOverrideUntilRef.current) {
      const remaining = oddsHaloOverrideUntilRef.current - t;
      const total = cfg.tier2.oddsHaloUpdateDurationMs;
      const k = Math.min(1, remaining / total);
      oddsMult = Math.max(
        oddsMult,
        oddsMult + (oddsHaloOverrideMultRef.current - oddsMult) * k,
      );
    }
    oddsGlowIntensityRef.current = oddsMult;

    // ---- border surge (independent: used by tier-crossings) ----
    let borderMult = mult;
    if (t < borderOverrideUntilRef.current) {
      const remaining = borderOverrideUntilRef.current - t;
      const total = borderOverrideTotalRef.current || 1;
      const k = Math.min(1, remaining / total);
      borderMult = Math.max(
        borderMult,
        borderMult + (borderOverrideMultRef.current - borderMult) * k,
      );
    }

    // ---- shared helper to build a layered drop-shadow FILTER stack ----
    // (drop-shadow, not text-shadow, so the glow isn't clipped per-char.)
    const buildStack = (m: number) =>
      cfg.flames.layers
        .map(([blur, opa]) => {
          const a = Math.min(1, opa * m).toFixed(3);
          return `drop-shadow(0 0 ${blur}px rgba(151,48,255,${a}))`;
        })
        .join(' ');

    // ---- deterministic flicker (used for shadow + stroke) ----
    // Sum-of-sines from cfg.flames.flickerSines, normalized to [0, 1].
    let flickerNorm = 0;
    if (tier === 3 && tier3OddsEffect === 'flames') {
      let sum = 0;
      let weightSum = 0;
      for (const s of cfg.flames.flickerSines) {
        sum += s.weight * Math.sin((2 * Math.PI * s.freqHz * t) / 1000);
        weightSum += s.weight;
      }
      flickerNorm = (sum / weightSum + 1) / 2;
    }

    // Build the 5th flicker layer as an extra drop-shadow (T3 flames only).
    let flicker = '';
    if (tier === 3 && tier3OddsEffect === 'flames') {
      const opa =
        cfg.flames.flickerOpacityMin +
        flickerNorm *
          (cfg.flames.flickerOpacityMax - cfg.flames.flickerOpacityMin);
      flicker = ` drop-shadow(0 0 ${cfg.flames.flickerBlurPx}px rgba(151,48,255,${opa.toFixed(3)}))`;
    }

    oddsGlowFilter.set(buildStack(oddsMult) + flicker);
    void borderMult;
    void flickerNorm;

    // Gana — same stack with each layer's alpha scaled down (no flicker).
    ganaGlowFilter.set(
      cfg.flames.layers
        .map(([blur, opa]) => {
          const a = Math.min(
            1,
            opa * oddsMult * cfg.tier3.ganaGlowScaleDown,
          ).toFixed(3);
          return `drop-shadow(0 0 ${blur}px rgba(151,48,255,${a}))`;
        })
        .join(' '),
    );
  });

  useEffect(() => {
    if (selectionCount === lastCountRef.current) return;
    const prev = lastCountRef.current;
    lastCountRef.current = selectionCount;
    if (reduced) return;

    // T1 FIRST-SELECTION COUNT-UP SWEEP — fires exactly once per
    // session. Detected here in the effect (mirroring the render-time
    // check that set `oddsSlotDurationMs` to the longer 800ms value).
    // The longer slot duration was already applied on the render that
    // scheduled this effect; here we (a) flip the ref so subsequent
    // renders fall back to the default duration, and (b) fire the
    // celebratory scale pulse on the odds container.
    const isFirstSel =
      prev === 0 && selectionCount === 1 && !hasFirstSelectedRef.current;
    if (isFirstSel) {
      hasFirstSelectedRef.current = true;
      oddsBurstControls.start({
        scale: [1, cfg.tier1.firstSelectionCountUp.pulseScalePeak, 1],
        transition: {
          duration: cfg.tier1.firstSelectionCountUp.pulseDurationMs / 1000,
          ease: 'easeOut',
        },
      });
    }

    // 1. Anticipation compress (40ms) — runs immediately.
    setBreath40(true);
    setTimeout(() => setBreath40(false), cfg.anticipationDurationMs);

    // 1b. Recoil — shove the whole slip DOWN a little, then spring back to
    // rest. Fires on BOTH add and remove (any count change while showing).
    // Use .jump() (not .set()) so the instantaneous downward shove doesn't
    // register as a velocity spike — otherwise the soft spring would read
    // that phantom velocity and overshoot wildly.
    recoilY.jump(cfg.recoil.pushDownPx);
    animate(recoilY, 0, { type: 'spring', ...cfg.recoil.spring });

    // 2. Count badge pulse (T1+).
    if (tier >= 1) {
      countControls.start({
        scale: [1, cfg.tier1.countPulseScaleMax, 1],
        transition: { duration: cfg.tier1.countPulseDurationMs / 1000, ease: 'easeOut' },
      });
    }

    // 3. Glow flash boost (T2+).
    if (tier >= 2) {
      glowFlashUntilRef.current = performance.now() + cfg.tier2.glowFlashDurationMs;
    }

    // 4. Settle overshoot (microinteraction d) — AFTER slot completes.
    // Uses the *effective* slot duration (which already accounts for
    // first-selection sweep at T1 = 800ms and weightier roll at T4 =
    // 480ms) so the overshoot lands the moment the slot animation
    // completes — not 380ms in regardless of tier.
    const effectiveSlotMs = isFirstSel
      ? cfg.tier1.firstSelectionCountUp.slotDurationMs
      : tier === 4
        ? cfg.tier4.slotDurationMs
        : cfg.slotDurationMs;
    setTimeout(() => {
      oddsSettleControls.start({
        scale: [1, cfg.settleOvershootScale, 1],
        transition: {
          duration: cfg.settleOvershootDurationMs / 1000,
          ease: 'easeOut',
        },
      });
      playSound('slot-end');
    }, effectiveSlotMs);

    // 5. Center radial burst — white ring radiating from the button
    //    center on every selection add. Active at T0/T1/T2; suppressed
    //    at T3 because the new OddsRipple + outline ripple together
    //    cover the "feedback on add" reading and the center ring was
    //    competing with them.
    if (selectionCount > prev && tier < 3) {
      const k = Date.now();
      setAddBurst(k);
      playSound('burst');
      setTimeout(
        () => setAddBurst((cur) => (cur === k ? null : cur)),
        cfg.tier3.radialBurstDurationMs + 20,
      );
    }

    // 6. T2+ add reactions: outline ripple. T3-only: odds-value burst.
    if (tier >= 2 && selectionCount > prev) {
      // Outline ripple fires on every selection ADD while at T2 or T3 —
      // a ghost border that expands outward from the button outline.
      // Stacks up to outlineRippleMaxStacked when multiple adds happen
      // rapidly within ~400ms. (Config key still lives under cfg.tier3
      // because it was introduced there originally — same values used
      // at T2 for now.)
      //
      // prominent=false here. The PROMINENT variant (bigger / longer /
      // brighter) fires from the crossing effect below, ONLY on tier-
      // up crossings into T3 or T4.
      const rippleId = performance.now();
      setOutlineRipples((cur) => {
        const next = [...cur, { id: rippleId, prominent: false }];
        if (next.length > cfg.tier3.outlineRippleMaxStacked) {
          return next.slice(next.length - cfg.tier3.outlineRippleMaxStacked);
        }
        return next;
      });
      setTimeout(
        () =>
          setOutlineRipples((cur) => cur.filter((r) => r.id !== rippleId)),
        cfg.tier3.outlineRippleDurationMs + 60,
      );
    }

    // T3+ on add: odds-value burst — scale pop + transient white
    // drop-shadow flash (the "glow flash on the source" that pairs with
    // the OddsRipple ghost overlay below). Both share the same 300ms
    // ease-out timing so they read as a single beat. Inherited at T4.
    if (tier >= 3 && selectionCount > prev) {
      oddsBurstControls.start({
        scale: [1, cfg.tier3.oddsAddBurstScale, 1],
        filter: [
          'drop-shadow(0 0 0px rgba(255,255,255,0))',
          `drop-shadow(0 0 ${cfg.tier3.oddsAddBurstFlashBlurPx}px rgba(255,255,255,0.9))`,
          'drop-shadow(0 0 0px rgba(255,255,255,0))',
        ],
        transition: {
          duration: cfg.tier3.oddsAddBurstDurationMs / 1000,
          ease: 'easeOut',
        },
      });

      // Spawn a ghost copy of the digits that expands outward + fades.
      // Snapshots the current oddsLabel so the ripple doesn't morph mid-
      // animation when the SlotNumber rolls to the new value. Caps at
      // oddsRippleMaxStacked simultaneous ripples on rapid adds.
      const rippleId = performance.now();
      const snapshot = oddsLabel;
      setOddsRipples((cur) => {
        const next = [...cur, { id: rippleId, text: snapshot }];
        if (next.length > cfg.tier3.oddsRippleMaxStacked) {
          return next.slice(next.length - cfg.tier3.oddsRippleMaxStacked);
        }
        return next;
      });
      setTimeout(
        () => setOddsRipples((cur) => cur.filter((r) => r.id !== rippleId)),
        cfg.tier3.oddsRippleDurationMs + 60,
      );
    }

    // Odds text-shadow surge on update — T3 ONLY now (the odds halo
    // itself is T3-only). At T2 the odds carry no halo so nothing to surge.
    if (tier >= 3) {
      oddsHaloOverrideMultRef.current = 2.0; // +100%
      oddsHaloOverrideUntilRef.current =
        performance.now() + cfg.tier2.oddsHaloUpdateDurationMs;
    }
  }, [
    selectionCount,
    tier,
    reduced,
    countControls,
    oddsSettleControls,
    oddsBurstControls,
  ]);

  /* =============================================================== */
  /*  ONE-SHOT — weight-gain anchor when entering Tier 3 (moved      */
  /*  from T2). Fires only on the T2→T3 crossing now.                */
  /* =============================================================== */
  const weightAnchorY = useMotionValue(0);
  const weightAnchorShadow = useMotionValue('0 0 0 rgba(0,0,0,0)');
  const prevTierForAnchorRef = useRef(tier);
  useEffect(() => {
    const prev = prevTierForAnchorRef.current;
    prevTierForAnchorRef.current = tier;
    if (reduced) return;
    if (prev < 3 && tier >= 3) {
      // Drop 1px and gain a 0→2px text-shadow underneath, then settle.
      const start = performance.now();
      const dur = cfg.tier2.weightAnchorDurationMs;
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / dur);
        // Out-and-stay: rises quickly then holds, then settles.
        const easeOut = 1 - Math.pow(1 - t, 3);
        weightAnchorY.set(cfg.tier2.weightAnchorTranslateYPx * easeOut * (1 - t * 0.5));
        weightAnchorShadow.set(
          `0 ${Math.round(2 * easeOut * (1 - t * 0.5))}px 0 rgba(151,48,255,${0.3 * easeOut * (1 - t * 0.5)})`,
        );
        if (t < 1) requestAnimationFrame(tick);
        else {
          weightAnchorY.set(0);
          weightAnchorShadow.set('0 0 0 rgba(0,0,0,0)');
        }
      };
      requestAnimationFrame(tick);
    }
  }, [tier, reduced, weightAnchorY, weightAnchorShadow]);

  /* =============================================================== */
  /*  TIER 3 — Magnetic pointer attraction                           */
  /* =============================================================== */
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const rawMagX = useMotionValue(0);
  const rawMagY = useMotionValue(0);
  const magX = useSpring(rawMagX, {
    stiffness: cfg.tier3.magneticSpringStiffness,
    damping: cfg.tier3.magneticSpringDamping,
  });
  const magY = useSpring(rawMagY, {
    stiffness: cfg.tier3.magneticSpringStiffness,
    damping: cfg.tier3.magneticSpringDamping,
  });
  // EXPLORATION — recoil: a downward shove on every selection add/remove
  // that springs back to rest. Composed with the magnetic Y on the breath
  // wrapper so both offsets stack cleanly.
  const recoilY = useMotionValue(0);
  const breathWrapperY = useTransform(
    [magY, recoilY] as const,
    ([m, r]) => (m as number) + (r as number),
  );
  useEffect(() => {
    if (tier < 3 || reduced) {
      rawMagX.set(0);
      rawMagY.set(0);
      return;
    }
    const handle = (clientX: number, clientY: number) => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > cfg.tier3.magneticRadiusPx) {
        rawMagX.set(0);
        rawMagY.set(0);
        return;
      }
      const k = (1 - dist / cfg.tier3.magneticRadiusPx) * cfg.tier3.magneticMaxTranslatePx;
      rawMagX.set((dx / Math.max(dist, 1)) * k);
      rawMagY.set((dy / Math.max(dist, 1)) * k);
    };
    const onPointerMove = (e: PointerEvent) => handle(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      handle(e.touches[0].clientX, e.touches[0].clientY);
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }, [tier, reduced, rawMagX, rawMagY]);

  /* =============================================================== */
  /*  Crossing one-shot — border-glow stack intensity surge          */
  /* =============================================================== */
  // EXPLORATION — replaces the orbital two-head + reverse-sweep motion
  // values. Up-cross surges the border glow stack ~3x for 700ms; down-
  // cross dims it briefly for 600ms.
  useEffect(() => {
    if (!crossing || reduced) return;
    const now = performance.now();
    if (crossing.dir === 'up') {
      borderOverrideMultRef.current = 3.0;
      borderOverrideTotalRef.current = 700;
      borderOverrideUntilRef.current = now + 700;
    } else {
      borderOverrideMultRef.current = 0.25;
      borderOverrideTotalRef.current = 600;
      borderOverrideUntilRef.current = now + 600;
    }
    // PROMINENT outline ripple — fires ONLY when crossing UP into T3
    // or T4 (the "level-up" moment). Lives alongside the existing
    // standard ripple that fires from the selection-change effect on
    // every add. The prominent variant scales bigger (1.55x vs 1.18x),
    // stays visible longer (1100ms vs 600ms), starts at full opacity
    // (1.0 vs 0.85), AND ramps its blur filter from 0 → maxBlurPx
    // over its flight — the expanding ring smears like motion blur,
    // leaving a soft trail behind the leading edge.
    if (crossing.dir === 'up' && crossing.toTier >= 3) {
      const id = now + 1; // +1 to avoid id collision with the standard ripple
      setOutlineRipples((cur) => {
        const next = [...cur, { id, prominent: true }];
        if (next.length > cfg.tier3.outlineRippleMaxStacked) {
          return next.slice(next.length - cfg.tier3.outlineRippleMaxStacked);
        }
        return next;
      });
      setTimeout(
        () => setOutlineRipples((cur) => cur.filter((r) => r.id !== id)),
        cfg.tier3.outlineRippleProminentDurationMs + 60,
      );
    }
  }, [crossing, reduced]);

  /* =============================================================== */
  /*  Live state push for debug overlay                              */
  /* =============================================================== */
  // EXPLORATION v3 — borderColor motion value removed. The debug
  // overlay still wants a "border" reading, so subscribe to glowOpacity
  // (which breathes anyway) and emit the oddsGlowIntensity ref.
  useMotionValueEvent(glowOpacity, 'change', () => {
    onLiveState?.({
      tier,
      cumulativeOdds,
      tremorActive,
      borderPhase: Math.min(1, oddsGlowIntensityRef.current / 3),
      breathPhase: breathPhaseRef.current,
    });
  });

  /* =============================================================== */
  /*  DERIVED display                                                */
  /* =============================================================== */
  const oddsLabel = useMemo(() => formatOdds(cumulativeOdds), [cumulativeOdds]);
  const stake = 200;
  const potentialWin = Math.round(cumulativeOdds * stake);

  /* =============================================================== */
  /*  Effective slot duration for the odds digit roll               */
  /*  Two tier-dependent overrides + one one-shot override:         */
  /*    T1 first 0 → 1 selection: 800ms (count-up sweep)            */
  /*    T4 any update:            480ms (weightier, "coronation")    */
  /*    everything else:          cfg.slotDurationMs (380ms default) */
  /*  Computed during render so the SlotNumber sees the right value  */
  /*  on the exact render that triggers the slot roll. lastCountRef  */
  /*  and hasFirstSelectedRef are still at their PRE-effect values   */
  /*  here, so this expression is correctly true on the very render   */
  /*  that needs the longer animation.                               */
  /* =============================================================== */
  const isFirstSelectionRender =
    lastCountRef.current === 0 &&
    selectionCount === 1 &&
    !hasFirstSelectedRef.current &&
    !reduced;
  const oddsSlotDurationMs = isFirstSelectionRender
    ? cfg.tier1.firstSelectionCountUp.slotDurationMs
    : tier === 4
      ? cfg.tier4.slotDurationMs
      : cfg.slotDurationMs;

  /* =============================================================== */
  /*  Inner CTA press handler — placeholder                          */
  /* =============================================================== */
  const onPress = useCallback(() => {
    // No-op (presented as visual prototype).
  }, []);

  /* =============================================================== */
  /*  RENDER                                                         */
  /* =============================================================== */
  const isUpCross = crossing?.dir === 'up';
  const isDownCross = crossing?.dir === 'down';

  return (
    <div className="relative w-full px-4 pb-2 pt-2">
      {/* Outer glow (Approach B) — diffuse blurred sibling element.
          Restored after the user clarified it was never meant to be
          removed. Provides the soft ambient halo around the button;
          the stroke sweep below adds the directional highlight. */}
      <motion.div
        aria-hidden
        className="outer-glow-swirl pointer-events-none absolute"
        style={{
          // Symmetric inset top/bottom so the glow vertically centers on
          // the button (the wrapper now uses pt-2 + pb-2 = balanced 8px
          // padding either side of the 56px button, so the wrapper's
          // vertical center IS the button's). Spilling ~20px below the
          // wrapper into the navbar is intentional.
          inset: '-20px 4px -20px 4px',
          // Concentrated glow (shorter fade) — closer to the original.
          WebkitMaskImage:
            'radial-gradient(ellipse 80% 78% at center, black 30%, transparent 78%)',
          maskImage:
            'radial-gradient(ellipse 80% 78% at center, black 30%, transparent 78%)',
          filter: 'blur(20px)',
          opacity: glowOpacity,
          // Follow debug speed (3× slow) when set.
          animationDuration: `${7 * speedScale}s`,
        }}
      />

      {/* Mandatory radial bloom on up-crossings */}
      <AnimatePresence>
        {isUpCross && !reduced && (
          <motion.div
            key={`bloom-${crossing!.key}`}
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-[34px] h-[56px] w-[56px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background:
                'radial-gradient(circle, rgba(151,48,255,0.6) 0%, rgba(75,32,255,0.22) 40%, transparent 70%)',
              filter: 'blur(14px)',
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{
              scale: cfg.crossing.bloomScale * 6,
              opacity: [0, cfg.crossing.bloomOpacityMax, 0],
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: cfg.crossing.bloomDurationMs / 1000, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>

      {/* OUTER WRAPPER — breath scale + magnetic translate */}
      <motion.div
        className="relative"
        style={{
          scale: breathScale,
          x: magX,
          y: breathWrapperY,
        }}
      >
        {/* POLISH PASS — Outline ripples emanating from button outline OUTWARD.
            Rendered as siblings of the inner button so they're outside the
            shell's overflow-hidden clip. */}
        <AnimatePresence>
          {!reduced &&
            outlineRipples.map((r) => (
              <OutlineRipple
                key={r.id}
                id={r.id}
                radius={cfg.borderRadiusPx * 2} // visual pill radius
                accent="#9730ff"
                prominent={r.prominent}
              />
            ))}
        </AnimatePresence>

        {/* INNER BUTTON — tremor + press + crossing pulse */}
        <motion.button
          ref={buttonRef}
          type="button"
          onClick={onPress}
          className="relative block w-full select-none"
          style={{
            // Tremor is layered on top of any other transforms via x/y.
            x: tremorX,
            y: tremorY,
          }}
          whileTap={reduced ? undefined : { scale: cfg.pressScale }}
          animate={
            isUpCross
              ? { scale: [1, cfg.crossing.upPulseScalePeak, 1] }
              : breath40
                ? { scale: [1, cfg.anticipationScale, 1] }
                : { scale: 1 }
          }
          transition={
            isUpCross
              ? {
                  type: 'spring',
                  stiffness: cfg.crossing.upSpringStiffness,
                  damping: cfg.crossing.upSpringDamping,
                  mass: 0.5,
                  duration: cfg.crossing.upPulseDurationMs / 1000,
                }
              : breath40
                ? { duration: cfg.anticipationDurationMs / 1000 }
                : { duration: 0.22, ease: 'easeOut' }
          }
        >
          {/* PILL SHELL — base gradient + static 1px Figma border.
              At T0/T1 the background uses the BUSCADOR palette
              (flat #191919) per the design reference. At T2/T3 it
              reverts to the original deep-purple gradient so the rising
              animations have their full vibrancy. All other colors
              (border, text, Gana gradient) are identical across both
              palettes so only the shell bg changes. */}
          <motion.div
            ref={shellRef}
            className="relative flex h-[56px] w-full items-center overflow-hidden rounded-[56px] border border-[#4b20ff]"
            style={{
              // Base background — always the flat #191919. The T2/T3 purple
              // gradient is layered above via a crossfading motion.div so
              // tier transitions don't snap.
              background: '#191919',
            }}
          >
            {/* Purple background gradient overlay. Originally only shown at
                T2/T3 (leaving T0/T1 flat #191919 gray); now always on so the
                collapsed pill is purple regardless of selection count — it
                should match the multi-selection look at every tier. */}
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'linear-gradient(to right, #14083d 0%, #230c3e 58%, #5224f1 100%)',
              }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />

            {/* EXPLORATION — orbital BorderLight removed. The shell's
                purple stroke now glows via a layered box-shadow stack
                applied to the shell itself (see motion.div below) —
                same animation language as the odds text-shadow. */}

            {/* EXPLORATION — up-cross two-head BorderLight removed.
                The border glow stack surges automatically on tier-up via
                borderOverride* refs (see selection-change effect below).
                Collision flash + floating sparkle + bloom + scale pulse
                are preserved — those are NOT orbital effects. */}
            {isUpCross && !reduced && (
              <>
                {/* Collision flash at bottom-center, 300ms after spawn */}
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rounded-full"
                  style={{
                    width: cfg.crossing.collisionFlashSizePx,
                    height: cfg.crossing.collisionFlashSizePx,
                    background:
                      'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.5) 40%, transparent 70%)',
                    filter: 'blur(2px)',
                  }}
                  initial={{ opacity: 0, scale: 0.3 }}
                  animate={{ opacity: [0, 1, 0], scale: [0.3, 1.1, 0.9] }}
                  transition={{
                    delay: cfg.crossing.collisionFlashDelayMs / 1000,
                    duration: cfg.crossing.collisionFlashDurationMs / 1000,
                    ease: 'easeOut',
                  }}
                />
                {/* One floating sparkle from the collision point */}
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute bottom-0 left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-white"
                  style={{ boxShadow: '0 0 6px rgba(255,255,255,0.9)' }}
                  initial={{ opacity: 0, y: 0, scale: 0 }}
                  animate={{
                    opacity: [0, 1, 0],
                    y: [0, -cfg.crossing.sparkleFloatRisePx],
                    scale: [0, 1, 0.6],
                  }}
                  transition={{
                    delay: cfg.crossing.collisionFlashDelayMs / 1000,
                    duration: cfg.crossing.sparkleFloatDurationMs / 1000,
                    ease: 'easeOut',
                  }}
                />
              </>
            )}

            {/* EXPLORATION — down-cross reverse-sweep BorderLight removed.
                Down-crossings now dim the border-glow stack momentarily
                via borderOverride* refs (see effect below) — a brief
                "deflation" rather than an orbital trace. */}

            {/* ----- Inner highlight rim (T2+), out of phase with outer glow */}
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-px rounded-[55px]"
              style={{
                opacity: innerRimOpacity,
                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.7)',
              }}
            />

            {/* EXPLORATION — the Tier 3 vertical cross-flicker overlay
                (fire-shimmer-overlay) was removed; it added a distracting
                up/down sweep across the surface without adding value. */}

            {/* ----- Edge-flash sparkles (T1+, density scales with tier) ----- */}
            {tier >= 1 && !reduced && (
              <div className="pointer-events-none absolute inset-0">
                {sparkles.map((s) => (
                  <motion.span
                    key={s.id}
                    className="absolute rounded-full bg-white"
                    style={{
                      left: `${s.x}%`,
                      top: `${s.y}%`,
                      width: s.size,
                      height: s.size,
                      boxShadow: '0 0 6px rgba(255,255,255,0.9)',
                    }}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: [0, 1, 0], scale: [0, 1, 0.5] }}
                    transition={{
                      duration: cfg.sparkles.durationMs / 1000,
                      ease: 'easeOut',
                    }}
                  />
                ))}
              </div>
            )}

            {/* ----- Center radial burst on selection add (ALL tiers) ----- */}
            <AnimatePresence>
              {addBurst !== null && !reduced && (
                <motion.div
                  key={`burst-${addBurst}`}
                  aria-hidden
                  className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{
                    boxShadow: '0 0 0 1.5px rgba(255,255,255,0.8)',
                  }}
                  initial={{
                    width: cfg.tier3.radialBurstStartPx,
                    height: cfg.tier3.radialBurstStartPx,
                    opacity: cfg.tier3.radialBurstOpacityStart,
                  }}
                  animate={{
                    width: cfg.tier3.radialBurstEndPx * 2,
                    height: cfg.tier3.radialBurstEndPx * 2,
                    opacity: 0,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{
                    duration: cfg.tier3.radialBurstDurationMs / 1000,
                    ease: 'easeOut',
                  }}
                />
              )}
            </AnimatePresence>

            {/* ============================================ */}
            {/*  CONTENT ROW — Bets / Momio / Monto / Gana   */}
            {/* ============================================ */}
            <div className="relative flex h-full flex-1 items-center gap-3 pl-5 pr-2">
              {/* BETS count with count-pulse on update */}
              <motion.div
                className="flex flex-col items-start justify-center"
                animate={countControls}
                initial={{ scale: 1 }}
              >
                <motion.div
                  className="flex h-[21px] items-center"
                  animate={
                    tier >= 1
                      ? {
                          textShadow: [
                            '0 0 0px rgba(151,48,255,0)',
                            `0 0 10px ${cfg.tier1.countPulseGlowColor}`,
                            '0 0 0px rgba(151,48,255,0)',
                          ],
                        }
                      : { textShadow: '0 0 0px rgba(151,48,255,0)' }
                  }
                  transition={{ duration: cfg.tier1.countPulseDurationMs / 1000 }}
                  key={`count-${selectionCount}`} // force re-trigger on every change
                  style={{
                    fontFamily: 'Red Hat Display, sans-serif',
                    fontWeight: 900,
                    // T3 — Figma "Black Italic" number style.
                    fontStyle: tier >= 3 ? 'italic' : 'normal',
                    fontSize: 14,
                    lineHeight: '21px',
                    color: '#fbfbfb',
                    // T4 — subtle white drop-shadow glow on each numeric.
                    filter: tier === 4 ? cfg.tier4.numberGlow : 'none',
                  }}
                >
                  <SlotNumber value={String(selectionCount)} reducedMotion={reduced} />
                </motion.div>
                <p
                  style={{
                    fontFamily: 'Red Hat Display, sans-serif',
                    fontWeight: 500,
                    fontSize: 12,
                    lineHeight: '16px',
                    color: 'rgba(251,251,251,0.5)',
                  }}
                >
                  {selectionCount === 1 ? 'Bet' : 'Bets'}
                </p>
              </motion.div>

              {/* MOMIO — layered: heat-haze + glow halo + real text with all
                  transforms (slot, pulse, settle, fire, char wave, burst) */}
              <div className="flex flex-col items-start justify-center">
                <div className="relative flex h-[21px] items-center">
                  {/* REGRESSION FIX — All duplicate text elements REMOVED.
                      The glow is text-shadow only, applied to the real text
                      below via a drop-shadow filter (`oddsGlowFilter`).
                      Smoke variant still renders blob shapes BEHIND the text
                      (not duplicate text), which is allowed. */}
                  {tier >= 3 && !reduced && tier3OddsEffect === 'smoke' && (
                    <OddsSmokeEffect />
                  )}
                  {/* Real momio value — wrapped in two motion layers:
                      outer = T3 add burst (scale 1.08)
                      inner = post-slot settle overshoot (scale 1.04)
                      The text-shadow stack is applied here via motion value. */}
                  <motion.div
                    className="relative flex items-center gap-1"
                    animate={oddsBurstControls}
                    initial={{ scale: 1 }}
                    style={{
                      scale: oddsPulseScale,
                      opacity: oddsPulseOpacity,
                      y: weightAnchorY,
                      // Glow is T3-ONLY. T0/T1/T2 = plain text.
                      // T3 — Figma "Black Italic" number style (900 + italic).
                      fontFamily: 'Red Hat Display, sans-serif',
                      fontWeight: 900,
                      fontStyle: tier >= 3 ? 'italic' : 'normal',
                      fontSize: 14,
                      lineHeight: '21px',
                      color: '#fbfbfb',
                    }}
                  >
                    <motion.span
                      animate={oddsSettleControls}
                      initial={{ scale: 1 }}
                      // Purple drop-shadow halo stays REMOVED at T3.
                      // T4 adds a subtle WHITE drop-shadow glow on the
                      // Momio digits — same `numberGlow` filter used on
                      // Bets / Monto / Gana so all four numbers read as
                      // a quietly luminous set at T4.
                      style={{
                        display: 'inline-block',
                        filter: tier === 4 ? cfg.tier4.numberGlow : 'none',
                      }}
                    >
                      <SlotNumber
                        value={oddsLabel}
                        durationMs={oddsSlotDurationMs}
                        reducedMotion={reduced}
                        innerCharClassName={
                          tier >= 3 && !reduced
                            ? `fire-shimmer odds-char-wave${
                                speedScale > 1 ? ' fire-shimmer-slow' : ''
                              }`
                            : ''
                        }
                      />
                    </motion.span>
                    {/* Odds ripples (T3 only) — ghost copies of the digit
                        string overlaying the SlotNumber, scaling outward
                        and fading on every selection add. Inherits font
                        from the parent so the ghost glyphs line up. */}
                    <AnimatePresence>
                      {!reduced &&
                        oddsRipples.map((r) => (
                          <OddsRipple key={r.id} id={r.id} text={r.text} />
                        ))}
                    </AnimatePresence>
                  </motion.div>
                </div>
                <p
                  style={{
                    fontFamily: 'Red Hat Display, sans-serif',
                    fontWeight: 500,
                    fontSize: 12,
                    lineHeight: '16px',
                    color: 'rgba(251,251,251,0.5)',
                  }}
                >
                  Momio
                </p>
              </div>

              {/* MONTO */}
              <div className="flex flex-col items-start justify-center">
                <p
                  style={{
                    fontFamily: 'Red Hat Display, sans-serif',
                    fontWeight: 900,
                    // T3 — Figma "Black Italic" number style.
                    fontStyle: tier >= 3 ? 'italic' : 'normal',
                    fontSize: 14,
                    lineHeight: '21px',
                    color: '#fbfbfb',
                    // T4 — subtle white drop-shadow glow.
                    filter: tier === 4 ? cfg.tier4.numberGlow : 'none',
                  }}
                >
                  ${stake}
                </p>
                <p
                  style={{
                    fontFamily: 'Red Hat Display, sans-serif',
                    fontWeight: 500,
                    fontSize: 12,
                    lineHeight: '16px',
                    color: 'rgba(251,251,251,0.5)',
                  }}
                >
                  Monto
                </p>
              </div>
            </div>

            {/* RIGHT — Gana CTA (potential winnings) */}
            <div className="relative flex h-[56px] w-[112px] shrink-0 items-center justify-center p-[6px]">
              <div
                className="relative flex h-full w-full flex-col items-center justify-center rounded-[100px] px-[6px]"
                style={{
                  // T2/T3 — Figma "Buscador" CTA look: brighter gradient
                  // end (#a954ff) gives the glow feel; subtle depth shadow
                  // adds dimension. T0/T1 keep the original gradient.
                  backgroundImage:
                    tier >= 2
                      ? 'linear-gradient(59.98deg, #4b20ff 0%, #a954ff 100%)'
                      : 'linear-gradient(58.9deg, #4b20ff 0%, #9730ff 100%)',
                  boxShadow:
                    tier >= 2
                      ? 'inset 0 0 12px rgba(0,0,0,0.24), 0 2px 6px rgba(29,11,68,0.3)'
                      : 'inset 0 0 12px rgba(0,0,0,0.24)',
                }}
              >
                <motion.div
                  className="relative flex items-center"
                  style={{
                    fontFamily: 'Red Hat Display, sans-serif',
                    fontWeight: 900,
                    // T3 — Figma "Black Italic" number style.
                    fontStyle: tier >= 3 ? 'italic' : 'normal',
                    fontSize: 14,
                    lineHeight: '21px',
                    color: '#fbfbfb',
                    // Glow as a drop-shadow FILTER (not text-shadow) so it
                    // hugs the glyphs instead of clipping into boxes. At
                    // T4 the purple breath-halo is replaced by the same
                    // subtle white glow used on the other three numbers
                    // — so the whole numeric set reads as one luminous
                    // group with the gold sweep on top.
                    filter:
                      tier === 4
                        ? cfg.tier4.numberGlow
                        : tier >= 3
                          ? ganaGlowFilter
                          : 'none',
                  }}
                >
                  <SlotNumber
                    value={`$${potentialWin}`}
                    reducedMotion={reduced}
                    innerCharClassName={
                      tier >= 3 && !reduced
                        ? // Same lavender-white sweeping wave at T3 AND T4
                          // (the gold variant was tried at T4 and reverted).
                          // The .fire-shimmer-gold CSS class stays in
                          // index.css unused, in case we revisit.
                          `fire-shimmer odds-char-wave${
                            speedScale > 1 ? ' fire-shimmer-slow' : ''
                          }`
                        : ''
                    }
                  />
                </motion.div>
                <div className="flex items-center justify-center gap-1 pl-1.5">
                  <p
                    style={{
                      fontFamily: 'Red Hat Display, sans-serif',
                      fontWeight: 500,
                      fontSize: 12,
                      lineHeight: '16px',
                      color: '#fbfbfb',
                    }}
                  >
                    Gana
                  </p>
                  <svg viewBox="0 0 14 14" width="10" height="10" fill="none" aria-hidden>
                    <path
                      d="M5 3l4 4-4 4"
                      stroke="#fbfbfb"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </motion.div>
          {/* T3 fire sparks — rising embers emitted from the TOP of the
              button. Rendered OUTSIDE the shell so overflow:hidden
              doesn't clip them. Container extends 60px above the
              button so the sparks have room to travel into. */}
          {tier === 3 && !reduced && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0"
              style={{
                bottom: 0,
                height: 'calc(100% + 60px)',
                zIndex: 50,
              }}
            >
              {fireSparks.filter((s) => !s.inflow).map((s) => (
                <motion.span
                  key={s.id}
                  className="absolute rounded-full"
                  style={{
                    left: `${s.xPct}%`,
                    bottom: s.yPctFromBottom * cfg.borderHeightPx,
                    width: s.size,
                    height: s.size * 5,
                    background:
                      'linear-gradient(to top, rgba(151,48,255,0) 0%, rgba(151,48,255,0.85) 70%, #9730ff 100%)',
                    boxShadow:
                      '0 0 6px rgba(151,48,255,0.95), 0 0 12px rgba(151,48,255,0.7)',
                  }}
                  initial={{ y: 0, opacity: 0, scale: 1 }}
                  animate={{
                    y: -s.rise,
                    opacity: [0, 1, 1, 0],
                    scale: [1, 1, 0.7, 0.3],
                  }}
                  transition={{
                    duration: s.lifetimeMs / 1000,
                    ease: 'easeOut',
                    opacity: { times: [0, 0.08, 0.65, 1] },
                    scale: { times: [0, 0.1, 0.7, 1] },
                  }}
                />
              ))}
            </div>
          )}
          {/* T4 magnetic spark inflow — container extends
              `inflowOffsetPx` outward in all 4 directions. Round
              particles spawn on a random outer edge and animate
              toward a jittered point inside the button. Round dots
              (not streaks) so motion direction reads cleanly from
              any spawn side. */}
          {tier === 4 && !reduced && (
            <div
              aria-hidden
              className="pointer-events-none absolute"
              style={{
                inset: `-${cfg.tier4.fireSparksInflowOffsetPx}px`,
                zIndex: 50,
              }}
            >
              {fireSparks.filter((s) => s.inflow).map((s) => {
                const inf = s.inflow!;
                return (
                  <motion.span
                    key={s.id}
                    className="absolute rounded-full"
                    style={{
                      left: inf.startXPx,
                      top: inf.startYPx,
                      // Round dot — same color palette as T3 streaks
                      // but symmetric so direction reads from motion.
                      width: s.size * 2.5,
                      height: s.size * 2.5,
                      background:
                        'radial-gradient(circle, #ffffff 0%, #9730ff 50%, rgba(151,48,255,0) 100%)',
                      boxShadow:
                        '0 0 8px rgba(151,48,255,0.95), 0 0 14px rgba(151,48,255,0.6)',
                      // Center the dot ON the spawn coordinate so the
                      // edges of the container are visually touched.
                      translateX: '-50%',
                      translateY: '-50%',
                    }}
                    initial={{ x: 0, y: 0, opacity: 0, scale: 1 }}
                    animate={{
                      // Converge toward the button center.
                      x: inf.deltaXPx,
                      y: inf.deltaYPx,
                      // Fade in fast, ride at full opacity, then dim out
                      // as the particle "absorbs" into the button.
                      opacity: [0, 1, 1, 0],
                      // Shrink slightly as it accelerates toward target
                      // — reads as compression into the gravity well.
                      scale: [1, 1, 0.9, 0.4],
                    }}
                    transition={{
                      duration: s.lifetimeMs / 1000,
                      ease: [0.45, 0, 0.7, 1], // ease-in: slow start, fast finish
                      opacity: { times: [0, 0.1, 0.75, 1] },
                      scale: { times: [0, 0.1, 0.75, 1] },
                    }}
                  />
                );
              })}
            </div>
          )}
          {/* EXPLORATION v3 — Horizontal stroke-sweep overlay.
              Rendered OUTSIDE the shell so the SVG isn't clipped by
              overflow:hidden. The shell's static 1px #4b20ff border
              stays as the base; this SVG paints a bright moving
              highlight on top of that line. The bright spot enters
              from the left and exits to the right, in the same
              visual language as the odds shimmer.
              Active at T2+ — but T2 is dimmer (opacity factor) and slower
              (longer cycle) than T3. */}
          {tier >= 2 && !reduced && shellSize.w > 0 && (
            <svg
              aria-hidden
              className="pointer-events-none absolute"
              style={{
                inset: '-1px',
                // T2 sweep is toned down to ~30% of T3's brightness.
                opacity: tier >= 3 ? 1 : cfg.tier2.strokeSweepOpacityFactor,
              }}
              width={shellSize.w + 2}
              height={shellSize.h + 2}
              viewBox={`0 0 ${shellSize.w + 2} ${shellSize.h + 2}`}
            >
              <defs>
                <linearGradient
                  ref={sweepGradRef}
                  id="bpmStrokeSweep"
                  x1="0"
                  y1="0"
                  x2="1"
                  y2="0"
                  gradientTransform="translate(-1 0)"
                >
                  <stop offset="0" stopColor="#a954ff" stopOpacity="0" />
                  <stop offset="0.3" stopColor="#c98fff" stopOpacity="0.4" />
                  <stop offset="0.5" stopColor="#dcb0ff" stopOpacity="1" />
                  <stop offset="0.7" stopColor="#c98fff" stopOpacity="0.4" />
                  <stop offset="1" stopColor="#a954ff" stopOpacity="0" />
                </linearGradient>
              </defs>
              <rect
                x="1"
                y="1"
                width={shellSize.w}
                height={shellSize.h}
                rx={cfg.borderRadiusPx}
                ry={cfg.borderRadiusPx}
                fill="none"
                stroke="url(#bpmStrokeSweep)"
                // T3 stroke is physically thinner so its full-opacity
                // (alpha 1.0) brightness doesn't read as fatter than T2's
                // dimmed (alpha 0.3) sweep — same perceived weight, just
                // brighter. T2 keeps the original 2.5px.
                strokeWidth={tier >= 3 ? 1.5 : 2.5}
              />
            </svg>
          )}
        </motion.button>
      </motion.div>
    </div>
  );
}

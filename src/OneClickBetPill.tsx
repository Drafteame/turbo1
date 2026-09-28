import { animate, motion, useMotionValue } from 'framer-motion';
import { useEffect, useRef, type CSSProperties } from 'react';
import { buttonProgressionConfig } from './buttonProgressionConfig';
import lightningImg from './assets/lightning-3d.png';

/**
 * OneClickBetPill — standalone presentational floating progress pill
 * (Figma "one click bet" 35219:93834 default / 35219:93884 filled).
 *
 * Purely visual: no hold timer, no tap handling, no bet-slip wiring, no
 * gesture/business logic. `state`/`progress` are driven entirely by
 * `useOneClickBetSession` (oneClickBetSession.ts), the sole source of truth
 * for progress, phase, and cancellation.
 *
 * Two background layers sit under the content, both clipped to the pill
 * radius: a static "default" gradient, and a "filled" gradient revealed
 * left-to-right by `progress` (0–1). Content (labels + illustration) is a
 * separate, unclipped layer on top so it stays legible through the
 * transition and the illustration can overflow the pill's top/bottom edge
 * as in the Figma design.
 *
 * `reversing` mirrors the retired inline-button behavior exactly: forward
 * progress is written every rAF frame with NO css transition (linear,
 * matches the session's per-frame elapsed/duration write), but while
 * `state === 'reversing'` the fill width gets a `reverseMs`-long
 * `reverseEasing` transition so the last-held width animates smoothly back
 * to 0 — the session drops `progress` to 0 a tick after entering
 * 'reversing' (see abortPress in oneClickBetSession.ts), so this component
 * only needs to react to the phase, never run its own timer.
 *
 * MOUNT/CANCEL MOTION — squash & stretch, reusing BetSlipSheet's spring
 * language (its `pulseScale` helper: perturb scaleX/scaleY motion values,
 * spring back to rest — see ENTRY_PULSE_SPRING/PULSE_SPRING there) adapted
 * to a scale-in-from-compressed mount, since the pill has no prior on-screen
 * shape to morph from:
 *   - ENTER (on every mount): scales up from a compressed state with a
 *     brief overshoot, then settles — `cfg.motion.enter` — while `App.tsx`
 *     keeps the pill in the exact same floating position it always
 *     occupies (this component never moves itself, only scales in place).
 *   - EXIT (cancellation only): once `state` becomes `'exiting'` (the
 *     session's transient post-reverse phase — see oneClickBetSession.ts),
 *     compresses vertically + stretches slightly horizontally and fades,
 *     `cfg.motion.exit`. Never plays on successful completion (`'filled'`
 *     is reached without ever passing through `'exiting'`). Purely
 *     decorative — `pointer-events-none` throughout, never captures the
 *     pointer or blocks scroll/carousel gestures.
 */

export type OneClickBetPillState =
  | 'hidden'
  | 'default'
  | 'pressing'
  | 'reversing'
  | 'exiting'
  | 'filled';

export interface OneClickBetPillProps {
  /** Cumulative odds, e.g. 1.75 → "1.75x". */
  odds: number;
  /** Stake amount, e.g. 200 → "$200". */
  amount: number;
  /** Potential winnings, e.g. 350 → "$350". */
  potentialWin: number;
  /** Fill progress 0–1. Only meaningful while `state` is `pressing` or `reversing`. */
  progress?: number;
  state: OneClickBetPillState;
  className?: string;
  /** Simplifies the enter/exit squash-and-stretch (no overshoot, shorter,
   *  scale+opacity only) per `prefers-reduced-motion` / the app's master
   *  switch — same flag `App.tsx` threads through everywhere else. */
  reducedMotion?: boolean;
}

// Figma "One click bet - filled" gradient — exported so EntryCreatedOverlay's
// morph-in echo (the FLIP transition from this pill into the success ticket,
// see the "One Click Bet V2" landmark in CLAUDE.md) can reuse the exact same
// fill instead of duplicating the literal.
export const PILL_FILLED_BG = 'linear-gradient(31.56deg, #14083d 0%, #230c3e 100%)';

const cfg = {
  heightPx: 56,
  radiusPx: 56,
  illustration: { wPx: 96, hPx: 76, iconSizePx: 76 },
  // Figma "one click bet - default": bg-gradient-to-b #191919 → #0f0f0f.
  defaultBg: 'linear-gradient(to bottom, #191919 0%, #0f0f0f 100%)',
  filledBg: PILL_FILLED_BG,
  // "ligh" overlay tinting the chrome bolt illustration purple.
  glow: 'linear-gradient(75.11deg, #4b20ff 0%, #9730ff 100%)',
};

const motionCfg = buttonProgressionConfig.ocbPillMotion;
const vfxCfg = buttonProgressionConfig.ocbVfx;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
// Smooth 0→1 ramp between edges (Hermite smoothstep) — used to fade the
// edge band in/out instead of a hard cut at the boundaries.
const smoothstep = (edge0: number, edge1: number, v: number) => {
  if (edge0 === edge1) return v < edge0 ? 0 : 1;
  const t = clamp01((v - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

export function OneClickBetPill({
  odds,
  amount,
  potentialWin,
  progress = 0,
  state,
  className = '',
  reducedMotion = false,
}: OneClickBetPillProps) {
  // Squash & stretch enter/exit — transform-only motion values, applied on
  // top of whatever position `App.tsx`'s wrapper gives this element (it
  // never translates itself, so the pill stays exactly where the bet-slip
  // pill floats).
  const scaleX = useMotionValue(1);
  const scaleY = useMotionValue(1);
  const opacity = useMotionValue(1);

  // ENTER — every mount (real hold engaging, or the debug preview toggling
  // to a non-hidden state) scales up from a compressed state, briefly
  // overshoots, then settles. Empty deps: fires once per mount, not on
  // every `state`/`progress` change.
  useEffect(() => {
    const { enter } = motionCfg;
    if (reducedMotion) {
      scaleX.set(enter.fromScaleX);
      scaleY.set(enter.fromScaleY);
      opacity.set(0);
      const ax = animate(scaleX, 1, { duration: enter.reducedDurationMs / 1000 });
      const ay = animate(scaleY, 1, { duration: enter.reducedDurationMs / 1000 });
      const ao = animate(opacity, 1, { duration: enter.reducedDurationMs / 1000 });
      return () => {
        ax.stop();
        ay.stop();
        ao.stop();
      };
    }
    scaleX.set(enter.fromScaleX);
    scaleY.set(enter.fromScaleY);
    opacity.set(0);
    const ax = animate(scaleX, [enter.overshootScaleX, 1], { type: 'spring', ...enter.spring });
    const ay = animate(scaleY, [enter.overshootScaleY, 1], { type: 'spring', ...enter.spring });
    const ao = animate(opacity, 1, { duration: 0.16 });
    return () => {
      ax.stop();
      ay.stop();
      ao.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // EXIT — fires only on the transient 'exiting' phase (fill has already
  // finished reversing to 0; see oneClickBetSession.ts's abortPress). Never
  // reached on successful completion, so this never fights the success
  // hand-off. The pill stays mounted for `exit.durationMs` /
  // `exit.reducedDurationMs` after this fires — the session's own timer
  // (exitMs) is kept in lockstep with that duration — so cleanup only
  // happens once the motion is visually done.
  const prevStateRef = useRef(state);
  useEffect(() => {
    const wasExiting = prevStateRef.current === 'exiting';
    prevStateRef.current = state;
    if (state !== 'exiting' || wasExiting) return;
    const { exit } = motionCfg;
    if (reducedMotion) {
      const ax = animate(scaleX, exit.toScaleX, { duration: exit.reducedDurationMs / 1000 });
      const ay = animate(scaleY, exit.toScaleY, { duration: exit.reducedDurationMs / 1000 });
      const ao = animate(opacity, 0, { duration: exit.reducedDurationMs / 1000 });
      return () => {
        ax.stop();
        ay.stop();
        ao.stop();
      };
    }
    const ax = animate(scaleX, exit.toScaleX, {
      duration: exit.durationMs / 1000,
      ease: exit.easing,
    });
    const ay = animate(scaleY, exit.toScaleY, {
      duration: exit.durationMs / 1000,
      ease: exit.easing,
    });
    const ao = animate(opacity, 0, { duration: exit.durationMs / 1000, ease: exit.easing });
    return () => {
      ax.stop();
      ay.stop();
      ao.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (state === 'hidden') return null;

  const resolvedProgress =
    state === 'filled'
      ? 1
      : state === 'pressing' || state === 'reversing' || state === 'exiting'
        ? Math.min(1, Math.max(0, progress))
        : 0;

  // Same "reverse only" transition rule the fill already uses — every VFX
  // layer below reuses this so nothing drifts out of sync with the fill or
  // runs its own timer. Forward progress and the rAF loop already repaint
  // every frame; only the reverse-to-zero needs an eased transition.
  const reverseTransition =
    state === 'reversing'
      ? `${buttonProgressionConfig.longPress.reverseMs}ms ${buttonProgressionConfig.longPress.reverseEasing}`
      : null;

  // Moving edge — both pieces below are masked to the fill div's own box
  // (an `inset` shadow can't escape its element; the cap is a child of that
  // same div), so neither can ever bleed past the true progress boundary
  // into unfilled territory — see the config comment in
  // buttonProgressionConfig.ts for why this replaced a free-floating band.
  // Kept in reduced-motion mode too (it only repositions with progress each
  // render — no continuous animation of its own to suppress, unlike the
  // particle travel below).
  const edgeGlowAlpha = vfxCfg.edge.insetGlow.maxAlpha * resolvedProgress;
  const edgeCapOpacity =
    resolvedProgress > 0
      ? smoothstep(0, vfxCfg.edge.cap.fadeInEnd, resolvedProgress) * vfxCfg.edge.cap.maxOpacity
      : 0;

  // Outer glow — progress^exponent matches the retired inline hold's
  // progress-squared curve (near-invisible early, builds by mid-hold).
  const glowIntensity = Math.pow(resolvedProgress, vfxCfg.glow.glowExponent);
  const glowColorRgb = '143, 46, 255'; // #8F2EFF
  const glowShadow = `0 0 ${vfxCfg.glow.innerBlurPx}px ${vfxCfg.glow.innerSpreadPx}px rgba(${glowColorRgb}, ${(
    glowIntensity * vfxCfg.glow.innerMaxAlpha
  ).toFixed(3)}), 0 0 ${vfxCfg.glow.outerBlurPx}px ${vfxCfg.glow.outerSpreadPx}px rgba(${glowColorRgb}, ${(
    glowIntensity * vfxCfg.glow.outerMaxAlpha
  ).toFixed(3)})`;

  const particlesOpacity = reducedMotion
    ? 0
    : vfxCfg.particleMinOpacity +
      (vfxCfg.particleMaxOpacity - vfxCfg.particleMinOpacity) * resolvedProgress;

  return (
    <motion.div
      className={`pointer-events-none relative inline-flex h-[56px] items-center rounded-[56px] border border-solid border-[#4b20ff] ${className}`}
      data-state={state}
      style={{
        scaleX,
        scaleY,
        opacity,
        transformOrigin: 'center center',
        boxShadow: glowShadow,
        transition: reverseTransition ? `box-shadow ${reverseTransition}` : 'none',
      }}
    >
      {/* background layers — clipped to the pill radius */}
      <div className="absolute inset-0 overflow-hidden rounded-[56px]">
        <div className="absolute inset-0" style={{ backgroundImage: cfg.defaultBg }} />
        <div
          className="absolute inset-y-0 left-0 overflow-hidden"
          style={{
            width: `${resolvedProgress * 100}%`,
            backgroundImage: cfg.filledBg,
            filter: `brightness(${(1 + glowIntensity * 0.12).toFixed(3)})`,
            // Inset glow biased toward the trailing (right) edge — the true
            // fill/unfilled boundary. `inset` shadows are clipped to this
            // div's own box, so the glow can only ever read inward from the
            // edge, never past it into the unfilled track.
            boxShadow: `inset ${vfxCfg.edge.insetGlow.offsetPx}px 0 ${vfxCfg.edge.insetGlow.blurPx}px ${vfxCfg.edge.insetGlow.spreadPx}px rgba(143, 46, 255, ${edgeGlowAlpha.toFixed(3)})`,
            // Forward fill has no transition — it's already written every
            // rAF frame, so a transition would just lag behind the real
            // value. Only while reversing does the width ease back to 0.
            transition: reverseTransition
              ? `width ${reverseTransition}, filter ${reverseTransition}, box-shadow ${reverseTransition}`
              : 'none',
          }}
        >
          {/* soft glow flush with the fill's true right edge — a wide,
              multi-stop, blurred gradient rather than a hard-edged strip, so
              it actually reads as a glow instead of a rigid line once
              clipped by this div's own edge. Still fully contained (the
              blur can only bleed inward, since the fill's own
              `overflow-hidden` clips anything past its right edge). */}
          <div
            className="absolute inset-y-0 right-0"
            style={{
              width: `${vfxCfg.edge.cap.widthPx}px`,
              opacity: edgeCapOpacity,
              backgroundImage: `linear-gradient(to right, transparent 0%, ${vfxCfg.energyColor}4d 45%, ${vfxCfg.energyColor}e6 78%, #ffffff 100%)`,
              filter: `blur(${vfxCfg.edge.cap.blurPx}px)`,
              transition: reverseTransition ? `opacity ${reverseTransition}` : 'none',
            }}
          />

          {/* internal energy particles — fixed pool, CSS-driven travel only.
              Nested INSIDE the fill (masked by its own `overflow-hidden`,
              same as the edge glow above) so they only ever appear within
              the already-filled track, never the unfilled remainder. */}
          {!reducedMotion && resolvedProgress > 0 && (
            <div
              className="absolute inset-0"
              style={{
                opacity: particlesOpacity,
                transition: reverseTransition ? `opacity ${reverseTransition}` : 'none',
              }}
            >
              {vfxCfg.particles.map((p, i) => (
                <div
                  key={i}
                  className="ocb-pill-particle absolute left-0"
                  style={
                    {
                      top: `${p.topPct}%`,
                      // Matches the CSS glow's `background-size` (2.4x the
                      // particle's own size) so the soft outer ring isn't
                      // clipped by a too-short box.
                      height: `${p.sizePx * 2.4}px`,
                      animationDuration: `${p.durationMs}ms`,
                      animationDelay: `${p.delayMs}ms`,
                      '--ocb-particle-size': `${p.sizePx}px`,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* content — unclipped so the illustration can overflow top/bottom */}
      <div className="relative flex h-[56px] items-center gap-[12px] py-0 pl-[20px] pr-[12px]">
        <div className="flex shrink-0 items-center gap-[12px]">
          <div className="flex shrink-0 flex-col items-start justify-center">
            <p className="whitespace-nowrap text-[14px] font-black leading-[21px] text-[#fbfbfb]">
              {odds}x
            </p>
            <p className="whitespace-nowrap text-[12px] font-medium leading-[16px] text-[rgba(251,251,251,0.5)]">
              Momio
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-start justify-center">
            <p className="whitespace-nowrap text-[14px] font-black leading-[21px] text-[#fbfbfb]">
              ${amount}
            </p>
            <p className="whitespace-nowrap text-[12px] font-medium leading-[16px] text-[rgba(251,251,251,0.5)]">
              Monto
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-start justify-center">
            <p className="whitespace-nowrap text-[14px] font-black leading-[21px] text-[#fbfbfb]">
              ${potentialWin}
            </p>
            <p className="whitespace-nowrap text-[12px] font-medium leading-[16px] text-[rgba(251,251,251,0.5)]">
              Ganancia potencial
            </p>
          </div>
        </div>

        {/* illustration — h-76 vs the pill's h-56 overflows top/bottom by design */}
        <div
          className="relative h-[76px] w-[96px] shrink-0 -translate-y-[9px]"
          data-name="illustration"
        >
          <div className="absolute left-0 top-0 size-[76px]">
            <div className="absolute inset-[-4.17%]">
              <img
                alt=""
                className="pointer-events-none absolute inset-0 size-full max-w-none object-cover"
                src={lightningImg}
              />
            </div>
            <div
              className="absolute inset-[16.15%_15.1%_15.1%_16.15%] rounded-[100px] opacity-70 mix-blend-color-burn blur-[5.5px]"
              style={{ backgroundImage: cfg.glow }}
            />
          </div>
          <p className="absolute left-[96px] top-[47px] w-[57px] -translate-x-full -translate-y-1/2 text-right text-[12px] font-bold italic leading-[12px] text-[#fbfbfb]">
            DERECHA RÁPIDA
          </p>
        </div>
      </div>
    </motion.div>
  );
}

import {
  animate,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useVelocity,
  type MotionValue,
} from 'framer-motion';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import checkIcon from './assets/success-check-3d.png';
import { PILL_FILLED_BG } from './OneClickBetPill';

/**
 * EntryCreatedOverlay — the success confirmation animation.
 *
 * ONE shape for every success flow (swipe-to-confirm on the expanded slip,
 * swipe-to-play on the "Resumen de tu entrada" full sheet, AND the lightning
 * long-press): a compact green ticket/stub (Figma 35252:75429 — ~155×61,
 * rounded corners + a semicircular notch on the mid-left/right edges,
 * radial-green fill, soft white rim, green glow, 3D check icon + two-line
 * rotated confirmation text). Replaces the earlier larger ticket (Figma
 * 33822:171080, 233×108) 1:1 in every flow — geometry/asset swap only, no
 * behavior change. The old full-width green card is gone.
 *
 *   1. The ticket emerges where the slip was — a circular clip-path reveal
 *      from its center (keyframes `greenCircleIn` / `greenContentIn` in
 *      index.css), check + text scaling in with it — and holds.
 *   2. On reveal-complete it fires a green spark burst + a squash/stretch pop
 *      + a glow flash, then performs a genie flight straight into the "Mis
 *      entradas" tab — velocity/position-derived squash & stretch, a base
 *      shrink envelope, rotation from x-velocity, driven by two springs
 *      launched together (no anticipation). No keyframes.
 *   3. The ticket fades out over its last few px of travel so it is fully
 *      gone `vanish.gapPx` above the tab — never overlapping it. onCatch()
 *      fires at that vanish moment (tab icon bumps to "catch" it); onDone()
 *      follows `doneDelayMs` later (app then pops the badge + "¿Reusar?").
 *
 * Flight timing lives in `cfg`; entrance timing in the index.css keyframes.
 */

const cfg = {
  // How long the ticket holds in place (readable) before the genie flight —
  // long enough to comfortably read "¡ENTRADA CREADA!".
  confirmedHoldMs: 1700,
  // Ticket geometry (Figma 35252:75429, compact ticket). The shape itself
  // (rounded corners + mid-edge notches) is the exact Figma vector
  // `TICKET_FILL_PATH`, authored in a 16..170.975 / 16..77 space, so the SVG
  // uses viewBox `TICKET_VIEWBOX`.
  ticket: {
    widthPx: 154.975,
    heightPx: 61,
    bottomPx: 86, // sits 12px above the 74px-tall navbar (unchanged by size)
  },
  // One-shot celebration burst when the circular reveal completes — the
  // T4 fire-spark dots from ButtonPreviewMomios, recolored to the success
  // green, exploding radially outward from the ticket's perimeter.
  burst: {
    count: 26,
    distanceMinPx: 28, // outward travel
    distanceMaxPx: 72,
    sizeMinPx: 3,
    sizeMaxPx: 7,
    durationMinMs: 420,
    durationMaxMs: 700,
    angleJitterRad: 0.3, // deviation from the pure radial direction
  },
  // Explosion "pop" on the ticket when the reveal completes (fires with the
  // burst): a subtle squash & stretch that springs back with overshoot, plus
  // a green glow flash that decays. Reads as something detonating inside.
  // Glow decay tuned to settle with the spring (stiffness 300 + damping 17
  // settles ~450ms) for unified visual completion.
  pop: {
    scaleX: 1.035, // initial stretch (springs back to 1 with a gentle overshoot)
    scaleY: 0.965,
    spring: { stiffness: 300, damping: 17 },
    glowDecayMs: 480, // matches spring settle time for coherent finish
  },
  genie: {
    // Fast, snappy flight — movement + shrink reach the tab in ~215ms.
    y: { stiffness: 550, damping: 34, mass: 0.55 },
    x: { stiffness: 580, damping: 36, mass: 0.5 },
    deformSmoothing: { stiffness: 220, damping: 30, mass: 1 },
    velocitySmoothing: { stiffness: 200, damping: 30, mass: 1 },
    // GRADUAL shrink — the ticket stays a recognizable (if small) card most of
    // the way and only ends around 0.4, so the fly-to-tab is visible instead
    // of collapsing to a dot in the first third.
    // All anchors below are fractions of the overall flight progress (0→1).
    baseScale: { anchors: [0, 0.55, 0.85, 1], scaleAnchors: [1, 0.74, 0.55, 0.42] },
    deform: {
      anchors: [0, 0.65, 1],
      scaleY: [1, 0.8, 1],
      scaleX: [1, 1.2, 1],
    },
    rotation: {
      vRange: [-150, 0, 150] as [number, number, number],
      degRange: [3, 0, -3] as [number, number, number],
    },
    // Leftward lean that grows as the ticket flies toward the tab (exit
    // personality). 0 at launch — matches the upright resting ticket, so the
    // hand-off is seamless — reaching `flightTiltDeg` by the time it arrives.
    flightTiltDeg: -8, // negative = leans left

    // Vanish tied to OVERALL progress toward the tab (both axes), not just y —
    // the flight is a short diagonal toward the "Mis entradas" tab, so a y-only
    // fade blinked it out before it arrived. Stay fully opaque until the last
    // `fadeFraction` of the path, then fade as it settles onto the tab.
    vanish: { gapPx: 2, fadeFraction: 0.15 },
    doneDelayMs: 150, // onDone this long after the catch moment
  },
  // One Click Bet — FLIP-style morph-in used ONLY when `originRect` (the
  // floating pill's own rect) is supplied. Replaces the centered
  // `greenCircleIn` reveal with a transform/opacity tween FROM the pill's
  // exact position+size TO the ticket's resting rect, so completing a hold
  // reads as one object changing shape rather than the pill vanishing and
  // an unrelated ticket appearing. Easing matches the reverseEasing curve
  // so every "settling" motion in the Quick Bet flow feels like the same
  // smooth material.
  morphIn: {
    durationMs: 280,
    ease: [0.4, 0, 0.2, 1] as [number, number, number, number], // matches reverseEasing
    // Fraction of durationMs (at the END of the tween) spent crossfading the
    // pill-colored echo out and the ticket face in. Start crossfade earlier
    // (from 55%) so the echo visibly fades while morphing, not just at the end.
    crossfadeFraction: 0.48,
  },
};

// Ticket outline — the exact Figma vector (node 35252:75430 "Subtract"):
// rounded corners with Figma corner-smoothing + a semicircular notch cut into
// the mid-left and mid-right edges. Authored in a 16..170.975 (w 154.975) /
// 16..77 (h 61) box, so the SVG renders it through TICKET_VIEWBOX. A centered
// stroke is clipped by the svg viewport at the outer edges → reads as an
// inside stroke, matching Figma. Figma exports this rim as a separate masked
// fill-ring (solid #FBFBFB @ 32%); reproduced here as a plain `stroke` on the
// same fill path — same simplification the previous (233×108) ticket used for
// its own rim, so the two remain visually/technically consistent.
const TICKET_FILL_PATH =
  'M145.388 16C154.348 16 158.828 16.0003 162.251 17.7441C165.262 19.2781 167.709 21.7257 169.243 24.7363C170.659 27.5157 170.925 30.9926 170.975 37C165.458 37.0069 160.987 41.4814 160.987 47C160.987 52.5147 165.451 56.9859 170.963 56.999C170.89 62.4 170.579 65.6421 169.243 68.2637C167.709 71.2743 165.262 73.7219 162.251 75.2559C158.828 76.9997 154.348 77 145.388 77H41.5869C32.6264 77 28.1462 76.9997 24.7236 75.2559C21.713 73.7219 19.2654 71.2743 17.7314 68.2637C16.3957 65.6421 16.0839 62.4 16.0107 56.999C21.5228 56.9864 25.9873 52.515 25.9873 47C25.9873 41.4814 21.517 37.0069 16 37C16.05 30.9926 16.3153 27.5157 17.7314 24.7363C19.2654 21.7257 21.713 19.2781 24.7236 17.7441C28.1462 16.0003 32.6264 16 41.5869 16H145.388Z';
const TICKET_VIEWBOX = '16 16 154.975 61';

/** Green glow only (single drop-shadow → no ghosting). The rim stroke is drawn
 *  by the SVG path. Put on the wrapper so it follows the ticket's alpha.
 *  `glowV` (0→1) intensifies the flash. Base matches the Figma drop-shadow
 *  (#36E5A9 @ 36%, blur 8). */
function ticketGlow(glowV: number): string {
  return `drop-shadow(0 0 ${16 + glowV * 30}px rgba(54,229,169,${0.36 + glowV * 0.5}))`;
}

/** The ticket face — one SVG path (radial-green fill + soft white rim stroke,
 *  notches included) with the check icon + rotated two-line message laid out
 *  in a row. `entering` plays the content pop. Shared by the resting ticket
 *  and the flying clone, and exported for OnboardingSheet.tsx's instructional
 *  demo loop (Task 7) — the demo drives its own reveal/pop/glow via CSS
 *  instead of `entering`, since it needs to repeat every cycle, not just once
 *  on mount. */
export function TicketFace({ entering = false }: { entering?: boolean }) {
  return (
    <>
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={TICKET_VIEWBOX}
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <radialGradient
            id="ticketFill"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(93.4878 38.0909) rotate(90) scale(72.7548 67.0318)"
          >
            <stop stopColor="#29C28A" />
            <stop offset="0.5" stopColor="#1DAC7C" />
            <stop offset="1" stopColor="#059669" />
          </radialGradient>
        </defs>
        <path
          d={TICKET_FILL_PATH}
          fill="url(#ticketFill)"
          fillOpacity="0.95"
          stroke="#FBFBFB"
          strokeOpacity="0.32"
          strokeWidth="2"
        />
      </svg>
      <div
        className={`absolute inset-0 flex items-center justify-center gap-[6px]${
          entering ? ' animate-[greenContentIn_0.2s_cubic-bezier(0.16,1,0.3,1)]' : ''
        }`}
      >
        <div
          className="relative size-[36px] shrink-0"
          style={{ filter: 'drop-shadow(0px 1px 4.1px rgba(0,78,53,0.71))' }}
        >
          <div className="absolute inset-[-3.13%]">
            <img
              src={checkIcon}
              alt=""
              className="absolute inset-0 size-full max-w-none object-cover"
              aria-hidden
            />
          </div>
          {/* Green color-burn tint over the icon — matches the Figma "ligh"
              layer, keeping the metallic check in the ticket's green family. */}
          <div className="absolute inset-[16.15%_15.1%_15.1%_16.15%] rounded-[100px] bg-[#34d399] opacity-50 mix-blend-color-burn blur-[11px]" />
        </div>
        <div className="flex h-[40.631px] w-[75.169px] items-center justify-center">
          <p className="rotate-[-3.7deg] whitespace-nowrap text-[14px] font-black italic leading-[18px] text-[#fbfbfb]">
            ¡ENTRADA
            <br aria-hidden />
            CREADA!
          </p>
        </div>
      </div>
    </>
  );
}

export type Rect = { left: number; top: number; width: number; height: number };

type BurstSpark = {
  id: number;
  leftPct: number; // spawn point on the ticket perimeter, % of ticket size
  topPct: number;
  dx: number; // outward travel in px
  dy: number;
  size: number;
  durationMs: number;
};

/** Sparks on the ticket perimeter, aimed radially outward (+ jitter). */
function makeBurst(): BurstSpark[] {
  const b = cfg.burst;
  // Ticket aspect (233×108) — corrects the radial angle for the percentage
  // coordinate space so corners still fire diagonally.
  const aspect = cfg.ticket.widthPx / cfg.ticket.heightPx;
  return Array.from({ length: b.count }, (_, id) => {
    // Horizontal sides are ~2× longer, so they get 2/3 of the spawns.
    const horizontal = Math.random() < 2 / 3;
    const along = Math.random() * 100;
    const far = Math.random() < 0.5 ? 0 : 100;
    const leftPct = horizontal ? along : far;
    const topPct = horizontal ? far : along;
    const angle =
      Math.atan2(topPct - 50, (leftPct - 50) / aspect) +
      (Math.random() * 2 - 1) * b.angleJitterRad;
    const distance =
      b.distanceMinPx + Math.random() * (b.distanceMaxPx - b.distanceMinPx);
    return {
      id,
      leftPct,
      topPct,
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
      size: b.sizeMinPx + Math.random() * (b.sizeMaxPx - b.sizeMinPx),
      durationMs:
        b.durationMinMs + Math.random() * (b.durationMaxMs - b.durationMinMs),
    };
  });
}

/** The flying genie clone — position-fixed at `from`, genies into `to`. */
function GenieClone({
  from,
  to,
  onCatch,
  onDone,
}: {
  from: Rect;
  to: Rect;
  onCatch: () => void;
  onDone: () => void;
}) {
  const g = cfg.genie;
  // Ticket bottom-center → gapPx above the tab's top edge. The y spring LANDS
  // at the vanish point (not the tab center) so the whole flight is visible:
  // the ticket decelerates into the spot just above the tab and dissolves
  // there. Targeting deeper would spend most of the spring's fast early
  // travel past the fade window, blinking the ticket out mid-flight.
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top - g.vanish.gapPx - (from.top + from.height);

  const yMV = useMotionValue(0);
  const xMV = useMotionValue(0);

  const smoothXVel = useSpring(useVelocity(xMV), g.velocitySmoothing);

  // Overall flight progress toward the tab (0 → 1), from BOTH axes. The path is
  // a short, mostly-horizontal diagonal to the "Mis entradas" tab, so driving
  // the shrink / deform / fade off y alone finished them almost instantly (y is
  // only ~10px, x ~80px). Every effect below is a function of this progress.
  const totalDist = Math.hypot(dx, dy) || 1;
  const flightProgress = useTransform(
    [xMV, yMV] as MotionValue<number>[],
    (v: number[]) => Math.min(1, Math.hypot(v[0], v[1]) / totalDist),
  );

  const baseScale = useTransform(
    flightProgress,
    g.baseScale.anchors,
    g.baseScale.scaleAnchors,
    { clamp: true },
  );
  const smoothDeformY = useSpring(
    useTransform(flightProgress, g.deform.anchors, g.deform.scaleY, { clamp: true }),
    g.deformSmoothing,
  );
  const smoothDeformX = useSpring(
    useTransform(flightProgress, g.deform.anchors, g.deform.scaleX, { clamp: true }),
    g.deformSmoothing,
  );
  const scaleY = useTransform(
    [baseScale, smoothDeformY] as MotionValue<number>[],
    (l: number[]) => l[0] * l[1],
  );
  const scaleX = useTransform(
    [baseScale, smoothDeformX] as MotionValue<number>[],
    (l: number[]) => l[0] * l[1],
  );
  // Flight rotation: a leftward lean that grows with flight progress (0 at
  // launch, so it matches the upright resting ticket) plus a subtle
  // velocity-driven wobble for life.
  const flightTilt = useTransform(flightProgress, [0, 1], [0, g.flightTiltDeg], {
    clamp: true,
  });
  const velRotate = useTransform(smoothXVel, g.rotation.vRange, g.rotation.degRange);
  const rotate = useTransform(
    [flightTilt, velRotate] as MotionValue<number>[],
    (l: number[]) => l[0] + l[1],
  );
  // Fade only over the last `fadeFraction` of the path — stays fully visible
  // through the trajectory, then dissolves as it settles onto the tab.
  const opacityMV = useTransform(
    flightProgress,
    [1 - g.vanish.fadeFraction, 1],
    [1, 0],
    { clamp: true },
  );

  useEffect(() => {
    let caught = false;
    let done = false;
    const fireDone = () => {
      if (done) return;
      done = true;
      onDone();
    };
    const timers: number[] = [];

    // The "catch": the moment the ticket has essentially arrived at the tab
    // (now faded) the icon bumps; onDone follows shortly.
    const unsub = flightProgress.on('change', (p) => {
      if (caught || p < 0.985) return;
      caught = true;
      onCatch();
      timers.push(window.setTimeout(fireDone, g.doneDelayMs));
    });

    const ya = animate(yMV, dy, { type: 'spring', ...g.y });
    const xa = animate(xMV, dx, { type: 'spring', ...g.x });
    // Safety net — if the vanish point is somehow never crossed, still finish.
    ya.then(() => timers.push(window.setTimeout(fireDone, g.doneDelayMs)));

    return () => {
      unsub();
      ya.stop();
      xa.stop();
      timers.forEach((t) => clearTimeout(t));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Outer wrapper carries position + fade + the glow drop-shadow (follows the
  // ticket, isn't clipped by the SVG viewport); inner carries the scale/rotate
  // so the notches shrink with the ticket.
  return (
    <motion.div
      style={{
        position: 'fixed',
        left: from.left,
        top: from.top,
        width: from.width,
        height: from.height,
        transformOrigin: '50% 100%',
        zIndex: 60,
        pointerEvents: 'none',
        x: xMV,
        y: yMV,
        opacity: opacityMV,
        filter: ticketGlow(0.2),
      }}
    >
      <motion.div
        className="relative h-full w-full"
        style={{ scaleX, scaleY, rotate, transformOrigin: '50% 100%' }}
      >
        <TicketFace />
      </motion.div>
    </motion.div>
  );
}

export function EntryCreatedOverlay({
  onDone,
  onCatch,
  onCovered,
  originRect,
}: {
  onDone: () => void;
  onCatch: () => void;
  /** Circular reveal (or morph-in) finished — the ticket now fully covers the slip/pill. */
  onCovered?: () => void;
  /**
   * One Click Bet only: the floating pill's own rect at the moment it
   * finished submitting. When present, the ticket morphs in FROM this rect
   * (FLIP transform) instead of playing the centered circular reveal — see
   * `cfg.morphIn`. Omit for the regular swipe-to-confirm flow (no pill to
   * originate from).
   */
  originRect?: Rect | null;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [flight, setFlight] = useState<{ from: Rect; to: Rect } | null>(null);
  // Celebration sparks — generated once, when the reveal/morph completes.
  const [burst, setBurst] = useState<BurstSpark[] | null>(null);

  // Explosion "pop" — squash & stretch (springs back with overshoot) and a
  // green glow flash (glow 0→1→0) fired when the reveal completes.
  const cardScaleX = useMotionValue(1);
  const cardScaleY = useMotionValue(1);
  const glow = useMotionValue(0);
  // Stroke + glow live on the wrapper as a drop-shadow filter (so they follow
  // the notched shape and aren't clipped by the SVG viewport).
  const ticketFilterMV = useTransform(glow, (g) => ticketGlow(g));

  const fireCelebration = () => {
    onCovered?.();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setBurst((b) => b ?? makeBurst());
    // Squash & stretch, then spring-settle with overshoot.
    cardScaleX.set(cfg.pop.scaleX);
    cardScaleY.set(cfg.pop.scaleY);
    animate(cardScaleX, 1, { type: 'spring', ...cfg.pop.spring });
    animate(cardScaleY, 1, { type: 'spring', ...cfg.pop.spring });
    // Green glow flash → decay to base.
    glow.set(1);
    animate(glow, 0, { duration: cfg.pop.glowDecayMs / 1000, ease: 'easeOut' });
  };

  // ---- One Click Bet morph-in (FLIP) ----------------------------------
  // Only meaningful when `originRect` is supplied. `morphX/Y/ScaleX/ScaleY`
  // carry the ticket's own offset from its resting rect (measured via
  // `cardRef` in the layout effect below, BEFORE paint, so there's never a
  // frame at the wrong position/size); `echoOpacity`/`ticketOpacity`
  // crossfade a pill-colored echo into the real ticket face over the tail
  // of the tween.
  const morphX = useMotionValue(0);
  const morphY = useMotionValue(0);
  const morphScaleX = useMotionValue(1);
  const morphScaleY = useMotionValue(1);
  const echoOpacity = useMotionValue(originRect ? 1 : 0);
  const ticketOpacity = useMotionValue(originRect ? 0 : 1);

  useLayoutEffect(() => {
    if (!originRect || !cardRef.current) return;
    const final = cardRef.current.getBoundingClientRect();
    const dx =
      originRect.left + originRect.width / 2 - (final.left + final.width / 2);
    const dy =
      originRect.top + originRect.height / 2 - (final.top + final.height / 2);
    const sx = originRect.width / final.width;
    const sy = originRect.height / final.height;
    morphX.set(dx);
    morphY.set(dy);
    morphScaleX.set(sx);
    morphScaleY.set(sy);

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      morphX.set(0);
      morphY.set(0);
      morphScaleX.set(1);
      morphScaleY.set(1);
      echoOpacity.set(0);
      ticketOpacity.set(1);
      fireCelebration();
      return;
    }

    const m = cfg.morphIn;
    const durationS = m.durationMs / 1000;
    const crossfadeS = durationS * m.crossfadeFraction;
    const crossfadeDelayS = durationS - crossfadeS;
    const controls = [
      animate(morphX, 0, { duration: durationS, ease: m.ease }),
      animate(morphY, 0, { duration: durationS, ease: m.ease }),
      animate(morphScaleX, 1, { duration: durationS, ease: m.ease }),
      animate(morphScaleY, 1, { duration: durationS, ease: m.ease }),
      animate(echoOpacity, 0, {
        duration: crossfadeS,
        delay: crossfadeDelayS,
        ease: 'easeIn',
      }),
      animate(ticketOpacity, 1, {
        duration: crossfadeS,
        delay: crossfadeDelayS,
        ease: 'easeOut',
      }),
    ];
    controls[0].then(() => {
      fireCelebration();
    });
    return () => controls.forEach((c) => c.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hold the green ticket in place, then measure slip + tab and start the
  // flight. The flight must never launch with the slip still mounted behind it,
  // so onCovered fires here too as a fallback (idempotent) in case the ticket's
  // animationend event was missed.
  useEffect(() => {
    const t = window.setTimeout(() => {
      onCovered?.();
      const from = cardRef.current?.getBoundingClientRect();
      const tab = document.querySelector('[data-tab="entradas"]')?.getBoundingClientRect();
      if (from && tab) {
        setFlight({ from, to: tab });
      } else {
        onDone();
      }
    }, cfg.confirmedHoldMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const T = cfg.ticket;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[60]"
      style={{ fontFamily: "'Red Hat Display', sans-serif" }}
    >
      {/* Green success ticket in its resting spot (until it flies) — enters as a
          circle expanding from its center, over the still-mounted slip (App
          unmounts the slip on onCovered). Wrapper carries scale + the glow
          drop-shadow; the child carries the reveal, the shape, and the content. */}
      {!flight && (
        <motion.div
          ref={cardRef}
          className="absolute"
          style={{
            // Center with left:50% + a static negative marginLeft (layout,
            // not a transform) so the edge paint-snaps crisp.
            bottom: T.bottomPx,
            left: '50%',
            marginLeft: -T.widthPx / 2,
            width: T.widthPx,
            height: T.heightPx,
            scaleX: cardScaleX,
            scaleY: cardScaleY,
            filter: ticketFilterMV,
          }}
        >
          {originRect ? (
            <>
              {/* Echo — the pill's own fill, FLIPped from its rect into
                  this one; fades out as the real ticket fades in. */}
              <motion.div
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-[28px]"
                style={{
                  backgroundImage: PILL_FILLED_BG,
                  x: morphX,
                  y: morphY,
                  scaleX: morphScaleX,
                  scaleY: morphScaleY,
                  opacity: echoOpacity,
                }}
              />
              <motion.div
                className="pointer-events-none absolute inset-0"
                style={{ opacity: ticketOpacity }}
              >
                <TicketFace />
              </motion.div>
            </>
          ) : (
            <div
              className="absolute inset-0 animate-[greenCircleIn_0.2s_cubic-bezier(0.16,1,0.3,1)]"
              onAnimationEnd={(e) => {
                if (e.animationName === 'greenCircleIn') fireCelebration();
              }}
            >
              <TicketFace entering />
            </div>
          )}
        </motion.div>
      )}
      {/* Celebration burst — green success sparks exploding outward from the
          ticket's perimeter. A sibling of the ticket; after it in the DOM so
          they paint on top. */}
      {!flight && burst && (
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            bottom: T.bottomPx,
            left: '50%',
            marginLeft: -T.widthPx / 2,
            width: T.widthPx,
            height: T.heightPx,
          }}
        >
          {burst.map((s) => (
            <motion.span
              key={s.id}
              className="absolute rounded-full"
              style={{
                left: `${s.leftPct}%`,
                top: `${s.topPct}%`,
                width: s.size,
                height: s.size,
                translateX: '-50%',
                translateY: '-50%',
                background:
                  'radial-gradient(circle, #ffffff 0%, #36e5a9 45%, rgba(41,194,138,0) 100%)',
                boxShadow:
                  '0 0 8px rgba(54,229,169,0.95), 0 0 14px rgba(41,194,138,0.6)',
              }}
              initial={{ x: 0, y: 0, opacity: 0, scale: 1 }}
              animate={{
                x: s.dx,
                y: s.dy,
                opacity: [0, 1, 1, 0],
                // Shrink as it decelerates — same read as the T4 spark dots.
                scale: [1, 1, 0.9, 0.35],
              }}
              transition={{
                duration: s.durationMs / 1000,
                ease: [0.2, 0.7, 0.3, 1], // explosion: fast launch, decelerate
                opacity: { times: [0, 0.08, 0.6, 1] },
                scale: { times: [0, 0.1, 0.6, 1] },
              }}
            />
          ))}
        </div>
      )}
      {flight && (
        <GenieClone
          from={flight.from}
          to={flight.to}
          onCatch={onCatch}
          onDone={onDone}
        />
      )}
    </div>
  );
}

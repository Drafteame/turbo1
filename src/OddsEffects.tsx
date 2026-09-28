import { motion, useAnimationFrame } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { buttonProgressionConfig as cfg } from './buttonProgressionConfig';

/* ===================================================================== */
/*  OddsFlamesEffect — layered text-shadow halos + deterministic flicker  */
/*                                                                       */
/*  Replaces the removed heat-haze duplicate-text approach. The odds      */
/*  text itself stays perfectly crisp (no blur filter on text, no        */
/*  duplicate glyph rendering causing doubling). All flame quality       */
/*  comes from text-shadow halos rendered on a sibling halo span         */
/*  OUTSIDE the glyph edges plus an opacity-only flicker layer.          */
/*                                                                       */
/*  We mutate `textShadow` imperatively via a per-frame loop using       */
/*  refs to the two halo spans so React doesn't re-render every frame.   */
/* ===================================================================== */

type OddsFlamesEffectProps = {
  /** The odds string to mirror for halo geometry. */
  value: string;
  /** Font weight to match the real text. */
  fontWeight: number;
  /** Font size to match. */
  fontSizePx: number;
  lineHeightPx: number;
};

function buildPulseShadow(mult: number): string {
  return cfg.flames.layers
    .map(
      ([blur, opa]) =>
        `0 0 ${blur}px rgba(151,48,255,${Math.min(1, opa * mult).toFixed(3)})`,
    )
    .join(', ');
}

function buildFlickerShadow(opa: number): string {
  return `0 0 ${cfg.flames.flickerBlurPx}px rgba(151,48,255,${opa.toFixed(3)})`;
}

export function OddsFlamesEffect({
  value,
  fontWeight,
  fontSizePx,
  lineHeightPx,
}: OddsFlamesEffectProps) {
  const pulseRef = useRef<HTMLSpanElement | null>(null);
  const flickerRef = useRef<HTMLSpanElement | null>(null);

  useAnimationFrame((t) => {
    // Slow synchronized pulse (±amplitude around 1.0) on all halo layers.
    const phase = (t % cfg.flames.pulseDurationMs) / cfg.flames.pulseDurationMs;
    const mult = 1 + Math.sin(phase * Math.PI * 2) * cfg.flames.pulseAmplitude;
    if (pulseRef.current) {
      pulseRef.current.style.textShadow = buildPulseShadow(mult);
    }

    // Deterministic sum-of-sines flicker → normalized → opacity range.
    let sum = 0;
    let weightSum = 0;
    for (const s of cfg.flames.flickerSines) {
      sum += s.weight * Math.sin((2 * Math.PI * s.freqHz * t) / 1000);
      weightSum += s.weight;
    }
    const norm = (sum / weightSum + 1) / 2;
    const opa =
      cfg.flames.flickerOpacityMin +
      norm * (cfg.flames.flickerOpacityMax - cfg.flames.flickerOpacityMin);
    if (flickerRef.current) {
      flickerRef.current.style.textShadow = buildFlickerShadow(opa);
    }
  });

  const haloStyle = {
    color: 'transparent',
    fontFamily: 'Red Hat Display, sans-serif',
    fontWeight,
    fontSize: fontSizePx,
    lineHeight: `${lineHeightPx}px`,
  } as const;

  return (
    <>
      {/* PULSE halo — four synchronized layers */}
      <span
        ref={pulseRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center whitespace-nowrap"
        style={{
          ...haloStyle,
          textShadow: buildPulseShadow(1),
        }}
      >
        {value}
      </span>
      {/* FLICKER halo — single small-blur layer, opacity oscillates 30–70% */}
      <span
        ref={flickerRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center whitespace-nowrap"
        style={{
          ...haloStyle,
          textShadow: buildFlickerShadow(cfg.flames.flickerOpacityMin),
        }}
      >
        {value}
      </span>
    </>
  );
}

/* ===================================================================== */
/*  OddsSmokeEffect — small accent blobs rising and fading behind text   */
/*                                                                       */
/*  Sits BEHIND the odds (z-index lower), absolutely positioned over     */
/*  the odds bounding box. Filter blur(3px) applied to the SMOKE LAYER  */
/*  only — never to the text. Text remains crisp.                       */
/* ===================================================================== */

type Blob = {
  id: number;
  spawnAtMs: number;
  lifetimeMs: number;
  xPct: number; // 0..100 (along the odds bbox width)
  size: number;
  rise: number;
  opacityPeak: number;
};

export function OddsSmokeEffect() {
  const [blobs, setBlobs] = useState<Blob[]>([]);
  const idRef = useRef(0);

  // Spawn blobs at a fixed interval. Each blob lives lifetimeMs.
  useEffect(() => {
    const tick = setInterval(() => {
      setBlobs((cur) => {
        const now = performance.now();
        const fresh = cur.filter((b) => now - b.spawnAtMs < b.lifetimeMs);
        if (fresh.length >= cfg.smoke.maxBlobs) return fresh;
        const b: Blob = {
          id: idRef.current++,
          spawnAtMs: now,
          lifetimeMs:
            cfg.smoke.lifetimeMinMs +
            Math.random() * (cfg.smoke.lifetimeMaxMs - cfg.smoke.lifetimeMinMs),
          xPct: 8 + Math.random() * 84,
          size:
            cfg.smoke.sizeMinPx +
            Math.random() * (cfg.smoke.sizeMaxPx - cfg.smoke.sizeMinPx),
          rise:
            cfg.smoke.riseMinPx +
            Math.random() * (cfg.smoke.riseMaxPx - cfg.smoke.riseMinPx),
          opacityPeak:
            cfg.smoke.opacityMinPeak +
            Math.random() *
              (cfg.smoke.opacityMaxPeak - cfg.smoke.opacityMinPeak),
        };
        return [...fresh, b];
      });
    }, cfg.smoke.spawnIntervalMs);
    return () => clearInterval(tick);
  }, []);

  // Garbage-collect expired blobs so the array doesn't grow forever.
  useEffect(() => {
    const gc = setInterval(() => {
      const now = performance.now();
      setBlobs((cur) => cur.filter((b) => now - b.spawnAtMs < b.lifetimeMs));
    }, 500);
    return () => clearInterval(gc);
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-visible"
      style={{ filter: `blur(${cfg.smoke.layerBlurPx}px)` }}
    >
      {blobs.map((b) => (
        <motion.span
          key={b.id}
          className="absolute rounded-full"
          style={{
            left: `${b.xPct}%`,
            bottom: 0,
            width: b.size,
            height: b.size,
            background:
              'radial-gradient(circle, rgba(151,48,255,0.9) 0%, rgba(151,48,255,0.4) 60%, transparent 100%)',
            transform: 'translateX(-50%)',
          }}
          initial={{ y: 0, scale: 1, opacity: 0 }}
          animate={{
            y: -b.rise,
            scale: cfg.smoke.scaleEnd,
            opacity: [0, b.opacityPeak, 0],
          }}
          transition={{
            duration: b.lifetimeMs / 1000,
            ease: 'easeOut',
            opacity: { times: [0, 0.25, 1], duration: b.lifetimeMs / 1000 },
          }}
        />
      ))}
    </div>
  );
}

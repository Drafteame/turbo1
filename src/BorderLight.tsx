import { useEffect, useId, useRef } from 'react';
import { useMotionValueEvent, type MotionValue } from 'framer-motion';
import { buttonProgressionConfig as cfg } from './buttonProgressionConfig';

/**
 * BorderLight — a single light segment that travels along the rounded-pill
 * border of the button.
 *
 * Polish-pass v2 structure: the "single head" is rendered as TWO stacked
 * stroke layers sharing the same `stroke-dashoffset` motion value:
 *   1. A wide soft HALO layer behind (stroke 4px, Gaussian blur σ=6, 50%
 *      opacity of the core).
 *   2. A sharper CORE layer on top (stroke 3px, Gaussian blur σ=2.5).
 * Both layers move together as one visual unit — a glowing head, not a
 * drawn line, with the natural "bright center + soft bloom" look real
 * light has.
 *
 * Color: a single purple `#9730ff` (approved for the border-light effect
 * only). Same hue throughout — opacity is the only variable along the
 * trail.
 *
 * Implementation note: we use plain `<rect>` + imperative
 * `useMotionValueEvent` subscriptions rather than `motion.rect`. Conditional
 * mount/unmount of `motion.rect` triggers an "Expected static flag was
 * missing" React 18 internal warning under framer-motion v11.
 */
type Props = {
  width: number;
  height: number;
  radius: number;
  /** Length of the visible dash in px along the stroke path. */
  dashLength: number;
  /** Position of the dash head around the perimeter, 0 → 1. */
  offset: MotionValue<number>;
  /** Peak opacity of the core layer (motion value or number). */
  opacity: MotionValue<number> | number;
  /** If true, animates counter-clockwise (negate the offset). */
  reverse?: boolean;
  /** Where to anchor offset=0 on the perimeter, expressed as a fraction (0..1). */
  anchor?: number;
};

export function BorderLight({
  width,
  height,
  radius,
  dashLength,
  offset,
  opacity,
  reverse = false,
  anchor = 0,
}: Props) {
  const coreRef = useRef<SVGRectElement | null>(null);
  const haloRef = useRef<SVGRectElement | null>(null);
  // Stable filter IDs per instance.
  const reactId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const coreFilterId = `bl-core-${reactId}`;
  const haloFilterId = `bl-halo-${reactId}`;

  const safeWidth = Math.max(width, 0);
  const straight = 2 * (safeWidth - 2 * radius) + 2 * (height - 2 * radius);
  const corners = 2 * Math.PI * radius;
  const perimeter = Math.max(1, straight + corners);

  // Inset so each stroke sits inside the visible button border. We use the
  // halo's wider stroke for inset so both layers center on the same path.
  const inset = cfg.borderLight.haloStrokeWidthPx / 2;
  const rectW = Math.max(0, safeWidth - cfg.borderLight.haloStrokeWidthPx);
  const rectH = Math.max(0, height - cfg.borderLight.haloStrokeWidthPx);
  const rectR = Math.max(0, radius - inset);

  // Drive both layers' dashoffset from the single offset motion value.
  useMotionValueEvent(offset, 'change', (v) => {
    const c = coreRef.current;
    const h = haloRef.current;
    if (!c && !h) return;
    const phase = ((v + anchor) % 1 + 1) % 1;
    const dashOffset = (reverse ? 1 : -1) * phase * perimeter;
    const s = String(dashOffset);
    c?.setAttribute('stroke-dashoffset', s);
    h?.setAttribute('stroke-dashoffset', s);
  });

  // Drive opacity imperatively if a motion value was passed.
  const opacityIsMV = typeof opacity !== 'number';
  useMotionValueEvent(
    opacityIsMV ? (opacity as MotionValue<number>) : (offset as MotionValue<number>),
    'change',
    (v) => {
      if (!opacityIsMV) return;
      const o = v as number;
      coreRef.current?.setAttribute('opacity', String(o));
      haloRef.current?.setAttribute(
        'opacity',
        String(o * cfg.borderLight.haloOpacityRatio),
      );
    },
  );

  // Initial paint — pick the current motion-value reads so we don't flash.
  useEffect(() => {
    const initialOffset = offset.get();
    const phase = ((initialOffset + anchor) % 1 + 1) % 1;
    const dashOffset = (reverse ? 1 : -1) * phase * perimeter;
    coreRef.current?.setAttribute('stroke-dashoffset', String(dashOffset));
    haloRef.current?.setAttribute('stroke-dashoffset', String(dashOffset));
    const o = typeof opacity === 'number' ? opacity : opacity.get();
    coreRef.current?.setAttribute('opacity', String(o));
    haloRef.current?.setAttribute(
      'opacity',
      String(o * cfg.borderLight.haloOpacityRatio),
    );
  }, [offset, opacity, anchor, perimeter, reverse]);

  if (width <= 0) return null;

  // Padding inside the SVG viewBox to give blur filters room to spread
  // without being clipped at the edges of the SVG canvas.
  const pad = cfg.borderLight.haloBlurStdDev * 4;
  const svgW = width + pad * 2;
  const svgH = height + pad * 2;

  return (
    <svg
      width={svgW}
      height={svgH}
      viewBox={`${-pad} ${-pad} ${svgW} ${svgH}`}
      className="pointer-events-none absolute"
      style={{ inset: -pad }}
      aria-hidden
    >
      <defs>
        {/* Core blur — sharp inner light segment with a soft edge. */}
        <filter
          id={coreFilterId}
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
        >
          <feGaussianBlur stdDeviation={cfg.borderLight.coreBlurStdDev} />
        </filter>
        {/* Halo blur — wider, more diffuse outer bloom. */}
        <filter
          id={haloFilterId}
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
        >
          <feGaussianBlur stdDeviation={cfg.borderLight.haloBlurStdDev} />
        </filter>
      </defs>

      {/* HALO layer — behind, wider stroke, heavier blur, lower opacity. */}
      <rect
        ref={haloRef}
        x={inset}
        y={inset}
        width={rectW}
        height={rectH}
        rx={rectR}
        ry={rectR}
        fill="none"
        stroke={cfg.borderLight.color}
        strokeWidth={cfg.borderLight.haloStrokeWidthPx}
        strokeLinecap="round"
        strokeDasharray={`${dashLength} ${perimeter}`}
        filter={`url(#${haloFilterId})`}
        opacity={
          typeof opacity === 'number'
            ? opacity * cfg.borderLight.haloOpacityRatio
            : 0
        }
      />

      {/* CORE layer — sharper, slimmer, on top. */}
      <rect
        ref={coreRef}
        x={inset}
        y={inset}
        width={rectW}
        height={rectH}
        rx={rectR}
        ry={rectR}
        fill="none"
        stroke={cfg.borderLight.color}
        strokeWidth={cfg.borderLight.coreStrokeWidthPx}
        strokeLinecap="round"
        strokeDasharray={`${dashLength} ${perimeter}`}
        filter={`url(#${coreFilterId})`}
        opacity={typeof opacity === 'number' ? opacity : 0}
      />
    </svg>
  );
}

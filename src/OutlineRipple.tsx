import { motion } from 'framer-motion';
import { buttonProgressionConfig as cfg } from './buttonProgressionConfig';

/**
 * OutlineRipple — a one-shot ghost border that emanates from the button's
 * outline OUTWARD into the surrounding UI.
 *
 * Distinct from the existing center radial-burst:
 *  - Center radial burst fires once when CROSSING into Tier 3 (a circle
 *    from the button center).
 *  - OutlineRipple fires on every selection ADD while AT Tier 3 (a rect
 *    matching the button's outline, expanding outward).
 *
 * Both can coexist on the same event (a selection that triggers a T3
 * up-cross). The two visual languages — circle from center, rect from
 * edges — layered together create a stronger payoff than either alone.
 *
 * The ripple MUST NOT be clipped by the button's overflow:hidden shell —
 * caller places this in a wrapper that's outside that shell.
 *
 * Rapid adds stack up to `outlineRippleMaxStacked` simultaneously; older
 * ripples are dropped by the parent when the cap is exceeded.
 */
type Props = {
  /** Unique id for AnimatePresence key. */
  id: number;
  /** Border radius matching the button (pill = full height / 2). */
  radius: number;
  /** Accent stroke color. Uses the existing button-gradient endpoint —
   *  NOT the new `#9730FF` border-light purple. */
  accent: string;
  /** When true, use the bigger/longer/brighter variant. Fired only on
   *  tier-up crossings into T3 or T4 (the "level-up" moment). Regular
   *  selection adds at any tier keep prominent=false. */
  prominent?: boolean;
};

export function OutlineRipple({ id, radius, accent, prominent = false }: Props) {
  // Both variants share the same easing curve so they read as members
  // of the same family — only scale / opacity / stroke / duration differ.
  const scalePeak = prominent
    ? cfg.tier3.outlineRippleProminentScalePeak
    : cfg.tier3.outlineRippleScalePeak;
  const strokeStartPx = prominent
    ? cfg.tier3.outlineRippleProminentStrokeStartPx
    : cfg.tier3.outlineRippleStrokeStartPx;
  const strokeEndPx = prominent
    ? cfg.tier3.outlineRippleProminentStrokeEndPx
    : cfg.tier3.outlineRippleStrokeEndPx;
  const opacityStart = prominent
    ? cfg.tier3.outlineRippleProminentOpacityStart
    : cfg.tier3.outlineRippleOpacityStart;
  const durationMs = prominent
    ? cfg.tier3.outlineRippleProminentDurationMs
    : cfg.tier3.outlineRippleDurationMs;
  // Motion-blur ramp: only the PROMINENT variant gets a filter that
  // grows from 0 → maxBlurPx over the flight. As the ring expands
  // outward it visibly smears, leaving a soft trail behind the
  // leading edge — same idea as a camera's motion blur on a fast
  // moving subject. The standard ripple stays sharp throughout.
  const blurMaxPx = prominent
    ? cfg.tier3.outlineRippleProminentMaxBlurPx
    : 0;
  return (
    <motion.div
      key={id}
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        borderRadius: radius,
        borderColor: accent,
        borderStyle: 'solid',
        boxSizing: 'border-box',
        willChange: 'transform, opacity, border-width, filter',
      }}
      initial={{
        scale: 1,
        opacity: opacityStart,
        borderWidth: strokeStartPx,
        filter: 'blur(0px)',
      }}
      animate={{
        scale: scalePeak,
        opacity: 0,
        borderWidth: strokeEndPx,
        filter: `blur(${blurMaxPx}px)`,
      }}
      transition={{
        duration: durationMs / 1000,
        ease: cfg.tier3.outlineRippleEase,
      }}
    />
  );
}

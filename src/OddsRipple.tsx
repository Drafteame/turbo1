import { motion } from 'framer-motion';
import { buttonProgressionConfig as cfg } from './buttonProgressionConfig';

/**
 * OddsRipple — a one-shot ghost copy of the odds value (e.g. "5.20x")
 * that expands outward and fades. Parallels the existing OutlineRipple,
 * but in the SHAPE of the number glyphs instead of the button outline.
 *
 * Fires only at Tier 3 on every selection ADD. The source text gets a
 * companion glow flash via the existing oddsBurstControls — see the
 * extended .start() call in ButtonPreviewMomios.
 *
 * Mounted as an absolute overlay inside the Momio container (which is
 * `position: relative`), so the ghost text starts at the same x/y as
 * the real SlotNumber.
 *
 * Inherits font-family / size / weight / italic from the parent — no
 * need to duplicate font config here. The ghost uses pure-white text
 * with a soft white glow (text-shadow) so the "ripple" reads as light
 * radiating outward rather than a colored echo.
 *
 * Stacks up to `oddsRippleMaxStacked` simultaneously; older ripples
 * are dropped by the parent when the cap is exceeded.
 */
type Props = {
  /** Unique id (AnimatePresence key + dedup). */
  id: number;
  /** Odds text at the moment the ripple was spawned (e.g. "5.20x"). */
  text: string;
};

export function OddsRipple({ id, text }: Props) {
  return (
    <motion.span
      key={id}
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 inline-flex items-center tabular-nums"
      style={{
        // Inherits color / font from the parent Momio wrapper, but we
        // force white + glow here so the ghost reads as a light flash
        // regardless of the source's animated filter.
        color: '#ffffff',
        textShadow: [
          `0 0 ${cfg.tier3.oddsRippleGlowInnerPx}px rgba(255,255,255,0.95)`,
          `0 0 ${cfg.tier3.oddsRippleGlowOuterPx}px rgba(255,255,255,0.7)`,
        ].join(', '),
        whiteSpace: 'nowrap',
        // Scale grows from the CENTER of the text run so the ghost
        // expands equally left + right instead of pushing rightward
        // (previous `left center` anchored the left edge, which made
        // the ripple read as off-center vs the source digits).
        transformOrigin: 'center',
        height: '1em',
        lineHeight: '1em',
      }}
      initial={{
        scale: 1,
        opacity: cfg.tier3.oddsRippleOpacityStart,
      }}
      animate={{
        scale: cfg.tier3.oddsRippleScalePeak,
        opacity: 0,
      }}
      transition={{
        duration: cfg.tier3.oddsRippleDurationMs / 1000,
        ease: cfg.tier3.oddsRippleEase,
      }}
    >
      {text}
    </motion.span>
  );
}

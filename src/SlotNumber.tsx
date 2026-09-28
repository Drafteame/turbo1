import { AnimatePresence, motion } from 'framer-motion';
import { useMemo } from 'react';
import { buttonProgressionConfig } from './buttonProgressionConfig';

/**
 * SlotNumber
 * Splits a string (e.g., "6.18x" or "3 selecciones") into characters and
 * animates only the characters that actually changed since the previous render.
 *
 * Implementation note from the brief: each character gets a stable key of
 * `position-value` so React unmounts/remounts ONLY the changed glyphs. Digits
 * that didn't change stay still — this is what gives the slot animation its
 * mechanical feel (vs. a single block crossfade).
 */
type Props = {
  value: string;
  durationMs?: number;
  reducedMotion?: boolean;
  className?: string;
  /** Applied to the outer fixed-height char wrapper (overflow:hidden). */
  charWrapperClassName?: string;
  /** Applied to the inner motion.span — use this for per-character text fills
   *  (e.g. the Tier 3 fire-shimmer gradient). */
  innerCharClassName?: string;
};

export function SlotNumber({
  value,
  durationMs,
  reducedMotion = false,
  className = '',
  charWrapperClassName = '',
  innerCharClassName = '',
}: Props) {
  const chars = useMemo(() => value.split(''), [value]);

  const dur =
    (reducedMotion
      ? buttonProgressionConfig.reducedMotionSlotDurationMs
      : durationMs ?? buttonProgressionConfig.slotDurationMs) / 1000;

  return (
    <span className={`inline-flex items-center ${className}`}>
      {chars.map((ch, i) => {
        // Non-digit characters (".", "x", " ") are stable and don't animate.
        const isAnimated = /[0-9]/.test(ch);
        const key = isAnimated ? `${i}-${ch}` : `${i}-static-${ch}`;

        return (
          <span
            key={`slot-${i}`}
            className={`relative inline-block overflow-hidden align-baseline ${charWrapperClassName}`}
            // --ci exposes the character index so CSS animations can
            // stagger themselves via `animation-delay: calc(var(--ci) * Xms)`.
            style={{ height: '1em', lineHeight: '1em', ['--ci' as string]: i }}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={key}
                initial={
                  isAnimated
                    ? { y: '-90%', opacity: 0 }
                    : { opacity: 1 }
                }
                animate={{ y: 0, opacity: 1 }}
                exit={
                  isAnimated
                    ? { y: '90%', opacity: 0 }
                    : { opacity: 0 }
                }
                transition={{
                  duration: dur,
                  ease: [0.4, 0, 0.2, 1],
                }}
                className={`inline-block tabular-nums ${innerCharClassName}`}
              >
                {ch === ' ' ? ' ' : ch}
              </motion.span>
            </AnimatePresence>
          </span>
        );
      })}
    </span>
  );
}

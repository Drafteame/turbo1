import {
  animate,
  motion,
  useMotionValue,
  usePresence,
  useTransform,
  useVelocity,
} from 'framer-motion';
import { useEffect, type ReactNode } from 'react';
import { buttonProgressionConfig as cfg } from './buttonProgressionConfig';

/**
 * BetSlipShell — entry/exit wrapper for the bet slip's preview button.
 *
 * REGRESSION FIX: previously the parent set `hasBouncedOnceRef.current = true`
 * in a queueMicrotask inside its setSelections updater. That microtask
 * fired BEFORE React re-rendered the App, so by the time BetSlipShell
 * mounted, the ref was already true → `bouncy={false}` → no bounce.
 * The fix is to have the parent set the ref via the `onMounted` callback
 * here, which fires inside our mount effect — AFTER `bouncy` has been
 * read by this render.
 *
 * Lives OUTSIDE the breath / magnetic / tremor stack so its transforms
 * compose multiplicatively with the existing ambient ones. The bouncy
 * entry fires only on the very first mount of the session; subsequent
 * 0 → 1 remounts get `bouncy={false}` and snap to final state.
 *
 * Landing squash: derived continuously from y velocity via `useVelocity` +
 * `useTransform`. When the spring lands (y velocity peaks negative as the
 * button falls into place), scaleX stretches and scaleY compresses. As
 * velocity decays, squash returns to neutral. This is NOT a separate
 * canned animation — it's an emergent property of the bounce physics.
 */
type Props = {
  /** Whether to play the bouncy entry (first mount of session). */
  bouncy: boolean;
  /** Fires once when this component mounts. Parent uses this to flip its
   *  "has bounced once" flag so subsequent mounts get bouncy={false}. */
  onMounted?: () => void;
  children: ReactNode;
};

export function BetSlipShell({ bouncy, onMounted, children }: Props) {
  const [isPresent, safeToRemove] = usePresence();

  // Own motion values so we can read y for velocity-derived squash.
  const y = useMotionValue(bouncy ? cfg.entry.fromY : cfg.entry.toY);
  const scale = useMotionValue(bouncy ? cfg.entry.fromScale : cfg.entry.toScale);
  const opacity = useMotionValue(
    bouncy ? cfg.entry.fromOpacity : cfg.entry.toOpacity,
  );

  // Velocity-derived squash. scaleX & scaleY compose multiplicatively
  // with the entry `scale` motion value via motion's transform stack.
  const yVelocity = useVelocity(y);
  const squashScaleX = useTransform(
    yVelocity,
    [
      -cfg.landingSquash.velocityRange,
      cfg.landingSquash.velocityCenter,
      cfg.landingSquash.velocityRange,
    ],
    cfg.landingSquash.scaleXRange,
  );
  const squashScaleY = useTransform(
    yVelocity,
    [
      -cfg.landingSquash.velocityRange,
      cfg.landingSquash.velocityCenter,
      cfg.landingSquash.velocityRange,
    ],
    cfg.landingSquash.scaleYRange,
  );

  /* --------------------------------------------------------------- */
  /*  ENTRY — fire on mount if `bouncy`; otherwise snap final.        */
  /* --------------------------------------------------------------- */
  useEffect(() => {
    if (!isPresent) return;
    // Signal the parent that this component has mounted. Parent flips its
    // "bouncedOnce" ref here, so the NEXT mount sees bouncy=false. This
    // happens AFTER React has consumed `bouncy` for the current render.
    onMounted?.();

    if (!bouncy) {
      y.set(cfg.entry.toY);
      scale.set(cfg.entry.toScale);
      opacity.set(cfg.entry.toOpacity);
      return;
    }
    // Springs with deliberately low damping → visible overshoot.
    const a1 = animate(y, cfg.entry.toY, {
      type: 'spring',
      ...cfg.entry.ySpring,
    });
    const a2 = animate(scale, cfg.entry.toScale, {
      type: 'spring',
      ...cfg.entry.scaleSpring,
    });
    const a3 = animate(opacity, cfg.entry.toOpacity, {
      duration: cfg.entry.opacityDurationMs / 1000,
    });
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
    // Intentionally only re-run when `bouncy` changes (i.e., once per mount).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bouncy]);

  /* --------------------------------------------------------------- */
  /*  EXIT — usePresence signals AnimatePresence has marked us out.   */
  /*  Run sharp compress-and-fall, then safeToRemove().               */
  /* --------------------------------------------------------------- */
  useEffect(() => {
    if (isPresent) return;
    const a1 = animate(y, cfg.exit.toY, {
      duration: cfg.exit.yScaleDurationMs / 1000,
      ease: cfg.exit.ease,
    });
    const a2 = animate(scale, cfg.exit.toScale, {
      duration: cfg.exit.yScaleDurationMs / 1000,
      ease: cfg.exit.ease,
    });
    const a3 = animate(opacity, cfg.exit.toOpacity, {
      duration: cfg.exit.opacityDurationMs / 1000,
    });
    let done = false;
    Promise.all([a1.then(), a2.then(), a3.then()]).then(() => {
      if (done) return;
      done = true;
      safeToRemove?.();
    });
    return () => {
      done = true;
      a1.stop();
      a2.stop();
      a3.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPresent]);

  return (
    <motion.div
      // REGRESSION FIX — no `overflow: hidden` (the borderRadius "blob"
      // animation that needed it is removed). Without overflow:hidden,
      // the outline ripple effects inside the button can expand beyond
      // the shell's bounds correctly.
      style={{
        y,
        scale,
        scaleX: squashScaleX,
        scaleY: squashScaleY,
        opacity,
        willChange: 'transform, opacity',
      }}
    >
      {children}
    </motion.div>
  );
}

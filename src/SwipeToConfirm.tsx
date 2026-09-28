import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import chevronRightIcon from './assets/chevron_right.svg';

/**
 * SwipeToConfirm — the shared "Desliza para jugar" thumb+track used by both the
 * summarized bet slip (BetSlipSheet) and the "Resumen" floating card
 * (BetSlipFullSheet). The confirm only fires when the thumb is pinned at the
 * track's far end (measured from the track/thumb widths, so it's independent of
 * the rendered track width); on completion the thumb pins and shows a spinner
 * for CONFIRM_LOADER_MS (simulated ticket creation) before onConfirm runs.
 *
 * `heightPx` sets the track height; the thumb/fill are inset 2px each side.
 */

// The thumb only confirms when pinned at the track's far end (within this
// tolerance) — any partial swipe snaps back instead.
const CONFIRM_END_TOLERANCE_PX = 2;
// Thumb inset from the track edge (matches the thumb's left-[2px]).
const THUMB_INSET_PX = 2;
// Simulated ticket-creation time — the thumb shows a spinner for this long
// after a completed swipe, then onConfirm fires the success flow.
const CONFIRM_LOADER_MS = 900;

const PURPLE_CTA = 'linear-gradient(70.5deg, #4b20ff 0%, #9730ff 100%)';

type Props = {
  stake: number;
  /** Fired after a completed swipe + the loader delay. */
  onConfirm: () => void;
  /** Optional — called when the thumb drag starts (e.g. to reset auto-collapse). */
  onSwipeStart?: () => void;
  /** Track height in px (default 40). */
  heightPx?: number;
};

export function SwipeToConfirm({
  stake,
  onConfirm,
  onSwipeStart,
  heightPx = 40,
}: Props) {
  // Thumb x → purple fill that grows across the track. The drag is constrained
  // by the track element itself, so the confirm gate is "thumb reached the far
  // end" whatever the rendered track width is.
  const swipeX = useMotionValue(0);
  const swipeFill = useTransform(swipeX, (v) => `${50 + v}px`);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLButtonElement>(null);
  const [confirming, setConfirming] = useState(false);

  // Thumb/fill are inset 2px top+bottom inside the track.
  const inner = heightPx - 4;

  // Max thumb travel: track inner width minus the thumb and its inset.
  const maxThumbX = () => {
    const track = trackRef.current;
    const thumb = thumbRef.current;
    if (!track || !thumb) return Infinity; // unmeasured — never confirm
    return track.clientWidth - thumb.offsetWidth - THUMB_INSET_PX;
  };

  const handleThumbDragEnd = () => {
    const maxX = maxThumbX();
    if (swipeX.get() >= maxX - CONFIRM_END_TOLERANCE_PX) {
      setConfirming(true);
      animate(swipeX, maxX, { type: 'spring', stiffness: 500, damping: 44 });
    } else {
      // Partial swipe — snap back (manual, since dragSnapToOrigin would also
      // yank a completed swipe back to the start).
      animate(swipeX, 0, { type: 'spring', stiffness: 500, damping: 40 });
    }
  };

  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(onConfirm, CONFIRM_LOADER_MS);
    return () => clearTimeout(t);
  }, [confirming, onConfirm]);

  return (
    <div
      ref={trackRef}
      className="relative flex w-full items-center overflow-hidden rounded-full bg-[rgba(240,242,244,0.12)] py-[2px] pl-[2px] pr-6"
      style={{ height: heightPx }}
    >
      {/* Purple fill — grows with the thumb as the user swipes. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-[2px] top-[2px] rounded-full"
        style={{ width: swipeFill, height: inner, backgroundImage: PURPLE_CTA }}
      />
      <motion.button
        ref={thumbRef}
        type="button"
        aria-label={
          confirming ? 'Creando entrada' : `Desliza para jugar por $${stake}`
        }
        className="absolute left-[2px] top-[2px] z-10 flex w-12 items-center justify-center rounded-full"
        style={{ x: swipeX, height: inner, backgroundImage: PURPLE_CTA }}
        drag={confirming ? false : 'x'}
        dragConstraints={trackRef}
        dragElastic={0.12}
        dragMomentum={false}
        onDragStart={onSwipeStart}
        onDragEnd={handleThumbDragEnd}
        whileTap={confirming ? undefined : { scale: 0.97 }}
      >
        {confirming ? (
          <span
            aria-hidden
            className="size-5 animate-spin rounded-full border-2 border-white/30 border-t-white"
          />
        ) : (
          <img
            src={chevronRightIcon}
            alt=""
            className="pointer-events-none size-5"
          />
        )}
      </motion.button>
      <p className="w-full text-center text-[13px] font-medium leading-4 text-[rgba(251,251,251,0.7)]">
        Desliza para jugar por: ${stake}
      </p>
    </div>
  );
}

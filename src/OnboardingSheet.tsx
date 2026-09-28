import {
  animate,
  motion,
  useDragControls,
  useMotionValue,
  usePresence,
  useTransform,
  type PanInfo,
} from 'framer-motion';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import checkboxCheckIcon from './assets/checkbox-check.svg';
import closeIcon from './assets/close.svg';
import editIcon from './assets/edit.svg';
import successCheckIcon from './assets/success-check.png';
import { TicketFace } from './EntryCreatedOverlay';
import { isValidMoneyAmount, sanitizeMoneyInput } from './money';

/**
 * OnboardingSheet — first-visit info sheet introducing the Quick Bet
 * (long-press) gesture. Figma `buttonSheet` (node 34715:77896, file
 * OBq6XxCPiveHmdSKScTtq2).
 *
 * FOCUS/DISMISSAL PASS (Task 6.3):
 *   - The sheet no longer spans the full viewport — it stops a responsive
 *     gap below the top edge (TOP_GAP_PERCENT) so a visible strip of
 *     overlay is always tappable-to-dismiss, while the backdrop itself
 *     still covers the entire viewport including the header.
 *   - The close × button now has an explicit z-index (see the fix note by
 *     its JSX) — it was previously losing hit-testing to the decorative
 *     demo-loop layer despite being visually on top.
 *   - The stake input shows a solid white border on focus (error state
 *     still wins if both are true).
 *   - Swipe-to-close now works from within the scrollable content too,
 *     gated on "already scrolled to top + gesture is clearly downward",
 *     via Framer's onPan/onPanStart/onPanEnd (no new dependency) — see the
 *     handleContentPan* functions. The footer/gap-area drag path (Framer's
 *     `drag="y"` + manual dragControls, from Task 6.2) is unchanged.
 *   - Escape key closes the sheet on desktop.
 *   - Every dismissal path (×, backdrop tap, swipe from either gesture
 *     path, Omitir, valid Jugar-ahora, Escape) calls the SAME `onClose`
 *     prop — there is only ever one close function.
 *
 * VALIDATION PASS (Task 6.4):
 *   - `quickBetAmount` now defaults to the literal "0" (quickBetSettings.ts)
 *     — a real displayed digit, always invalid until the user changes it.
 *   - "Jugar ahora" validates in strict order: amount first (if invalid,
 *     focus + white stroke + scroll-into-view, stop — never proceeds); only
 *     once the amount is valid does it check the new odds-change checkbox
 *     (if unchecked, red highlight + scroll-into-view, stop). Never both
 *     warnings at once (see the `isValid` effect that drops a stale
 *     checkbox warning if the amount becomes invalid again).
 *   - The checkbox (Figma node 34715:77914) is now a real
 *     `<input type="checkbox">` for full mouse/touch/keyboard support,
 *     styled to match its Figma checked state (filled with the primary CTA
 *     gradient + a checkmark) via a decorative sibling box, since real
 *     checkboxes can't be restyled to an arbitrary gradient shape via
 *     `appearance` alone cross-browser.
 */

const OPEN_SPRING = { type: 'spring', stiffness: 340, damping: 36 } as const;
// Distance/velocity thresholds shared by BOTH swipe-to-close gesture paths
// (footer/gap-area via dragControls, and content-area via onPan below) so
// a swipe closes the same way regardless of where on the sheet it started.
const CLOSE_OFFSET_PX = 120;
const CLOSE_VELOCITY = 550;
// Closed-state resting Y — must clear the sheet's own height so it's fully
// off-screen when dismissed, regardless of device height.
const OFFSCREEN_Y =
  typeof window !== 'undefined' ? window.innerHeight + 120 : 1200;
// RESPONSIVE TOP GAP — percentage of the frame's own height, not a fixed
// px value, so it scales sensibly across phone sizes instead of eating
// too much of a short screen or leaving too little of a tall one. Leaves
// this fraction of the viewport visible above the sheet so outside-tap
// dismissal has an obvious target, while the backdrop (separately) still
// covers the full viewport including the header.
const TOP_GAP_PERCENT = 8;
// Figma `buttonSheet` background gradient — identical to BetSlipFullSheet's
// SHEET_BG (both are the app's one dark-card fill token).
const SHEET_BG = 'linear-gradient(to bottom, #191919 0%, #0f0f0f 100%)';
// Primary CTA gradient — matches the app's existing purple CTA token (see
// SwipeToConfirm's PURPLE_CTA), which is also what Figma's primary button
// (Component Colors/backgroundPrimaryGradient) resolves to elsewhere in the
// design system.
const PRIMARY_CTA_BG = 'linear-gradient(70.5deg, #4b20ff 0%, #9730ff 100%)';
// Figma token: Action Colors/actionSecondaryDefault (#fbfbfb1f).
const SECONDARY_BTN_BG = 'rgba(251,251,251,0.12)';
// Figma tokens: Background/backgroundOpacityTertiary (demo slot),
// Background/backgroundOpacitySecondary + Fill Colors/fillOpacityQuinary
// (stake-input fill/border), Border radius/radiusBase (12),
// Border radius/radiusLarge (16, footer buttons).
const DEMO_BG = 'rgba(251,251,251,0.08)';
const INPUT_BG = 'rgba(251,251,251,0.1)';
const INPUT_BORDER = 'rgba(251,251,251,0.08)';
const BTN_RADIUS = 16;
// No error-state color exists anywhere else in this app (grepped — nothing
// to reuse), so this is a new, minimal addition: a plain accessible red,
// used only for the stake field's invalid-state border + helper text.
const ERROR_COLOR = '#ff6b6b';
// Focus-state border — plain white, same width/radius as the default
// border (no Figma focus variant exists to match more precisely). Lower
// priority than ERROR_COLOR — see the borderColor calc below.
const FOCUS_COLOR = '#ffffff';
// Gesture-conflict thresholds for the content-area swipe-to-close path
// (see handleContentPan*): ignore jitter below this before committing to a
// direction, and only claim the gesture as a close-drag if the vertical
// component clearly dominates the horizontal one.
const PAN_DIRECTION_THRESHOLD_PX = 6;

type Props = {
  onClose: () => void;
  quickBetAmount: string;
  onQuickBetAmountChange: (value: string) => void;
  /** Fired ONLY when "Jugar ahora" succeeds (valid amount + odds-change
   *  checkbox accepted) — additive, informational: lets a caller persist
   *  the odds-change preference / mark setup complete (see
   *  oneClickBetOnboarding.ts) without this component owning that
   *  persistence itself. `onClose` still fires right after, exactly as
   *  before — this doesn't change what closes the sheet or when. */
  onSetupComplete?: (acceptOddsChange: boolean) => void;
};

/** Tracks the on-screen keyboard's footprint via `window.visualViewport` —
 *  `100dvh`/`vh` don't reflect the OSK on most mobile browsers (only
 *  browser-chrome changes), so they can't be used for this on their own.
 *  Returns both:
 *    - `height`: the space actually visible above the keyboard.
 *    - `offsetTop`: how far that visible area has panned down from the
 *      layout viewport's own top. Non-zero on iOS Safari, which auto-
 *      scrolls the page to keep the focused input above the keyboard.
 *  BOTH are required together — using height alone silently assumes
 *  offsetTop is always 0, which under-covers the sheet by exactly the pan
 *  distance the moment that assumption breaks (this was the root cause of
 *  the sheet appearing "cut off" with Home content exposed below it: the
 *  prior height-only calc stayed internally consistent but never accounted
 *  for the page having panned, so the sheet's computed bottom edge landed
 *  above the keyboard's real top edge by the pan amount).
 *  Falls back to `null` (caller uses its container's own bounds) when the
 *  API is unsupported. */
function useVisualViewport(): { height: number; offsetTop: number } | null {
  const [viewport, setViewport] = useState<
    { height: number; offsetTop: number } | null
  >(() =>
    window.visualViewport
      ? {
          height: window.visualViewport.height,
          offsetTop: window.visualViewport.offsetTop,
        }
      : null,
  );
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () =>
      setViewport({ height: vv.height, offsetTop: vv.offsetTop });
    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize); // iOS sometimes fires this instead
    onResize();
    return () => {
      vv.removeEventListener('resize', onResize);
      vv.removeEventListener('scroll', onResize);
    };
  }, []);
  return viewport;
}

export function OnboardingSheet({
  onClose,
  quickBetAmount,
  onQuickBetAmountChange,
  onSetupComplete,
}: Props) {
  const [isPresent, safeToRemove] = usePresence();
  const y = useMotionValue(OFFSCREEN_Y);
  const opacity = useMotionValue(0);
  const viewport = useVisualViewport();

  // FRAME HEIGHT — the sheet's own containing block (the `absolute inset-0`
  // wrapper below, which exactly matches the phone-frame's current size in
  // both mobile edge-to-edge and desktop mockup modes). Tracked live (not
  // read once) because it itself can change — e.g. iOS Safari's URL bar
  // collapsing/expanding reflows `100dvh`. Needed to convert the keyboard's
  // viewport-relative footprint (`viewport.height`/`offsetTop`, both in real
  // window coordinates) into a bottom-gap relative to THIS container, since
  // on desktop the container is a centered 390×844 mockup, not the window.
  const outerRef = useRef<HTMLDivElement>(null);
  const [frameHeight, setFrameHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setFrameHeight(el.clientHeight));
    ro.observe(el);
    setFrameHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  // BOTTOM GAP — distance from the frame's own bottom edge to the true
  // visible bottom edge (the keyboard's top, or the window bottom when no
  // keyboard is open). Anchoring the sheet with `bottom: bottomGapPx`
  // (instead of a computed `height`) means its bottom edge always tracks
  // the real visible viewport regardless of `offsetTop` drift, while `top`
  // stays a simple frame-relative percentage — no more mixing a live px
  // measurement with a static-container percentage in one `calc()`.
  const bottomGapPx =
    viewport != null && frameHeight != null
      ? Math.max(0, frameHeight - (viewport.offsetTop + viewport.height))
      : 0;

  // Backdrop dims slightly further as the sheet is dragged down (optional
  // per spec, kept subtle) — composed from the enter/exit fade (`opacity`)
  // and the live drag position (`y`), so both effects combine without
  // fighting each other.
  const dragDim = useTransform(y, [0, CLOSE_OFFSET_PX * 2], [1, 0.82]);
  const backdropOpacity = useTransform([opacity, dragDim], (v) => {
    const [o, d] = v as number[];
    return o * d;
  });

  useEffect(() => {
    if (isPresent) {
      const a1 = animate(y, 0, OPEN_SPRING);
      const a2 = animate(opacity, 1, { duration: 0.2 });
      return () => {
        a1.stop();
        a2.stop();
      };
    }
    const a1 = animate(y, OFFSCREEN_Y, OPEN_SPRING);
    const a2 = animate(opacity, 0, { duration: 0.2 });
    let done = false;
    Promise.all([a1, a2]).then(() => {
      if (done) return;
      done = true;
      safeToRemove?.();
    });
    return () => {
      done = true;
      a1.stop();
      a2.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPresent]);

  // Escape key — same shared `onClose` as every other dismissal path.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // FOOTER/GAP-AREA drag path (unchanged from Task 6.2) — manual
  // dragControls.start, only for pointerdowns OUTSIDE the scrollable
  // content (buttons/inputs are also excluded so taps there never start a
  // drag). The content area has its OWN gesture path below, since it needs
  // to stay scrollable.
  const dragControls = useDragControls();
  const onDragEnd = (_e: unknown, info: PanInfo) => {
    if (info.offset.y > CLOSE_OFFSET_PX || info.velocity.y > CLOSE_VELOCITY) {
      onClose();
    } else {
      animate(y, 0, OPEN_SPRING);
    }
  };

  // CONTENT-AREA swipe-to-close — gated on "scroll already at top AND the
  // gesture is clearly downward, not horizontal", so it never fights
  // normal scrolling or a leftover horizontal gesture. Implemented with
  // Framer's onPan/onPanStart/onPanEnd (no new dependency): these fire for
  // any pan gesture regardless of a `drag` prop, so the decision to claim
  // the gesture (or leave it to native scroll) can be deferred until we've
  // seen a few px of real movement and can read its direction — pointerdown
  // alone can't tell "will become a downward drag" from "will become an
  // upward/horizontal scroll".
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentGestureRef = useRef<{
    startScrollTop: number;
    claimed: boolean;
    fromInput: boolean;
  } | null>(null);

  const handleContentPanStart = (
    event: PointerEvent | MouseEvent | TouchEvent,
  ) => {
    const target = event.target as HTMLElement;
    contentGestureRef.current = {
      startScrollTop: scrollRef.current?.scrollTop ?? 0,
      claimed: false,
      // Never hijack a gesture that starts on the input — typing, caret
      // placement, and text selection must be completely unaffected.
      fromInput: !!target.closest('input'),
    };
  };
  const handleContentPan = (
    _event: PointerEvent | MouseEvent | TouchEvent,
    info: PanInfo,
  ) => {
    const g = contentGestureRef.current;
    if (!g || g.fromInput) return;
    const { x: dx, y: dy } = info.offset;
    if (!g.claimed) {
      // Not yet committed — wait past the jitter threshold, then decide
      // once based on direction + scroll position. Below the threshold,
      // do nothing and let native scroll behave normally in the meantime.
      if (Math.abs(dx) < PAN_DIRECTION_THRESHOLD_PX && Math.abs(dy) < PAN_DIRECTION_THRESHOLD_PX) {
        return;
      }
      const isDownward = dy > 0;
      const isMostlyVertical = Math.abs(dy) > Math.abs(dx);
      if (isDownward && isMostlyVertical && g.startScrollTop <= 0) {
        g.claimed = true;
      } else {
        // Horizontal, upward, or not at the top — this is a normal scroll
        // (or an unrelated gesture), not a close-swipe. Stop watching it.
        contentGestureRef.current = null;
        return;
      }
    }
    // Cancel mid-gesture if it turns primarily horizontal (e.g. the user
    // was swiping down-and-to-the-side) — spring back rather than keep
    // following a gesture that's no longer a clean downward swipe.
    if (Math.abs(dx) > Math.abs(dy)) {
      contentGestureRef.current = null;
      animate(y, 0, OPEN_SPRING);
      return;
    }
    y.set(Math.max(0, dy));
  };
  const handleContentPanEnd = (
    _event: PointerEvent | MouseEvent | TouchEvent,
    info: PanInfo,
  ) => {
    const g = contentGestureRef.current;
    contentGestureRef.current = null;
    if (!g?.claimed) return;
    if (info.offset.y > CLOSE_OFFSET_PX || info.velocity.y > CLOSE_VELOCITY) {
      onClose();
    } else {
      animate(y, 0, OPEN_SPRING);
    }
  };

  const inputRef = useRef<HTMLInputElement>(null);
  const [touched, setTouched] = useState(false);
  const [focused, setFocused] = useState(false);
  const isValid = isValidMoneyAmount(quickBetAmount);
  const showError = touched && !isValid;
  // While the field has actual DOM focus, the white stroke always wins —
  // this is what makes "press Jugar ahora while invalid → focus + white
  // stroke" (Task 6.4) work uniformly even if the field was already
  // showing a red error from an earlier blur, and it's what keeps the
  // white stroke visible for the whole time the user is actively typing
  // (Task 6.3), rather than flipping to red mid-edit on every invalid
  // intermediate keystroke. The error-over-focus priority Task 6.3 asked
  // for still applies to the RESTING state: once the field blurs while
  // still invalid, red is what's shown until the user focuses it again.
  const inputBorderColor = focused
    ? FOCUS_COLOR
    : showError
      ? ERROR_COLOR
      : INPUT_BORDER;

  // Odds-change acceptance (Task 6.4) — a second, independent validation
  // gate that only matters once the amount is already valid (see the
  // ordered checks in handlePrimaryCta). `checkboxError` is the validation
  // highlight — deliberately a SEPARATE flag from `oddsAccepted` (the
  // checked-value channel) per the task's "keep the highlight separate
  // from the checked visual state" requirement, so a future re-check of
  // the SAME box doesn't have to fight the color priority the checked
  // state already owns.
  const checkboxRef = useRef<HTMLInputElement>(null);
  const [oddsAccepted, setOddsAccepted] = useState(false);
  const [checkboxError, setCheckboxError] = useState(false);
  const checkboxErrorId = 'quick-bet-odds-checkbox-error';
  // Never show the checkbox warning and the amount error at the same time
  // (task requirement): if the amount becomes invalid again for any reason
  // (not just via a Play-Now press — e.g. the user clears the field after
  // having seen the checkbox warning), drop the stale checkbox warning
  // immediately rather than leaving two errors visible together.
  useEffect(() => {
    if (!isValid) setCheckboxError(false);
  }, [isValid]);
  const handleOddsCheckboxChange = (checked: boolean) => {
    setOddsAccepted(checked);
    if (checked) setCheckboxError(false); // clears immediately once checked
  };

  const handleAmountChange = (raw: string) => {
    onQuickBetAmountChange(sanitizeMoneyInput(raw));
  };
  const handleAmountFocus = () => {
    setFocused(true);
    // Defensive belt-and-suspenders on top of the browser's own native
    // scroll-into-view-on-focus behavior: wait for the keyboard-open
    // animation to settle, then make sure the field is still in view.
    window.setTimeout(() => {
      inputRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 300);
  };
  const handleAmountBlur = () => {
    setFocused(false);
    setTouched(true);
  };

  // "Omitir" always dismisses (an explicit skip). "Jugar ahora" validates
  // in order (Task 6.4): amount first, then (only once the amount is
  // valid) the odds-change checkbox — never both warnings at once. Neither
  // branch below is a native `disabled` button; both need to react to a
  // tap (focus the input / highlight the checkbox) rather than silently
  // swallow it.
  const handlePrimaryCta = () => {
    if (!isValid) {
      setCheckboxError(false); // only one validation surfaced at a time
      setTouched(true);
      // Synchronous, real-user-triggered focus (this handler runs inside
      // the button's own click handler) — mobile browsers only open the
      // native keyboard for a .focus() call that's part of an actual user
      // gesture's call stack, not one deferred via setTimeout/microtask.
      // The resulting native `focus` event fires handleAmountFocus above,
      // which sets `focused` (→ the white stroke) and schedules the
      // scroll-into-view — so both requirements are covered by this one
      // call, no duplicate logic needed here.
      inputRef.current?.focus();
      return;
    }
    if (!oddsAccepted) {
      setCheckboxError(true);
      checkboxRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    onSetupComplete?.(oddsAccepted);
    onClose();
  };

  return (
    <div
      ref={outerRef}
      className="absolute inset-0 z-50"
      style={{ fontFamily: "'Red Hat Display', sans-serif" }}
    >
      {/* Backdrop — still covers the FULL viewport (including the header),
          independent of the sheet's own reduced height below. Plain fade
          (no header-undim band, unchanged from Task 6.2) plus the subtle
          drag-reactive dim composed above. OUTSIDE-TAP DISMISSAL: this is
          the only element under the sheet, so any tap that isn't on the
          sheet itself lands here and calls the shared onClose — taps
          inside the sheet can never reach this handler since the sheet is
          a DOM sibling, not a descendant (there is no bubbling path from
          sheet content to this backdrop to guard against). */}
      <motion.div
        className="absolute inset-0"
        style={{ opacity: backdropOpacity, background: 'rgba(0,0,0,0.7)' }}
        onClick={onClose}
        aria-hidden
      />

      {/* Sheet — stops TOP_GAP_PERCENT below the top edge (a responsive
          fraction of the frame's height, not a fixed px gap) instead of
          spanning the full viewport, leaving a visible, obviously-tappable
          strip of backdrop above it. Anchored with `top` + `bottom` (not an
          explicit `height`) so the browser derives the height itself: `top`
          stays a plain frame-relative percentage, and `bottom` is
          `bottomGapPx` — a live px gap (see the comment above its
          calculation) that keeps the sheet's bottom edge glued to the real
          visible viewport's bottom (the keyboard's top edge, or the window
          bottom when no keyboard is open), correctly accounting for
          `visualViewport.offsetTop` drift instead of assuming it's always 0.
          `transition` animates `bottom` so the keyboard closing restores the
          sheet's height smoothly rather than snapping. Still no drag
          handle. `touch-action:none` remains required for the footer/
          gap-area drag path below (dragListener=false, so nothing else
          applies it). */}
      <motion.div
        className="absolute inset-x-0 flex flex-col overflow-hidden rounded-t-[24px] border-t border-[rgba(251,251,251,0.08)]"
        style={{
          top: `${TOP_GAP_PERCENT}%`,
          bottom: bottomGapPx,
          y,
          backgroundImage: SHEET_BG,
          touchAction: 'none',
          paddingTop: 'env(safe-area-inset-top)',
          transition: 'bottom 200ms ease',
        }}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0}
        onDragEnd={onDragEnd}
        onPointerDown={(e) => {
          const el = e.target as HTMLElement;
          if (el.closest('button') || el.closest('input') || el.closest('[data-scroll]')) return;
          dragControls.start(e);
        }}
      >
        {/* Close — circular button, same 40px/20px-icon spec as the other
            sheets' × control (Figma: circularButton, 40×40, top-8/right-8).
            BUG FIX (Task 6.3): this button was visually on top but losing
            hit-testing to the decorative demo-loop layer below — both it
            and the demo box are `position:absolute` at the same implicit
            stacking level (z-index:auto), and per CSS's stacking rules,
            SAME-LEVEL positioned elements paint in DOM-TREE order, not
            visual position. The demo box (nested deeper, but still later
            in tree order — its own ancestor is `position:relative`, which
            also counts as "positioned") ended up on top in their small
            overlap at the sheet's top-right corner, silently swallowing
            the tap. Fixed with an explicit `z-10` here (always wins
            regardless of DOM order) plus `pointer-events-none` on the
            decorative loop itself (it's non-interactive by design, so it
            should never be capable of capturing a pointer event). Hit
            target is the full 40×40px button; the icon inside stays 20px. */}
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
          onPointerDownCapture={(e) => e.stopPropagation()}
          className="absolute right-2 z-10 flex size-10 items-center justify-center rounded-full active:scale-95"
          style={{ top: 'calc(env(safe-area-inset-top) + 8px)' }}
        >
          <img src={closeIcon} alt="" className="size-5" />
        </button>

        {/* Scrollable content — data-scroll excludes it from the
            footer/gap-area drag path (so a normal upward scroll never
            starts that drag); its OWN swipe-to-close is handled by
            onPan/onPanStart/onPanEnd above instead (gated on
            scrollTop<=0 + a clearly-downward gesture). `overscrollBehavior:
            'none'` (stronger than the shared `.no-scrollbar` class's
            'contain') suppresses this element's own native rubber-band
            bounce specifically here, so an at-top downward drag reads as
            ONLY the sheet translating, not a double bounce-and-translate. */}
        <motion.div
          ref={scrollRef}
          data-scroll
          className="no-scrollbar min-h-px flex-1 overflow-y-auto"
          style={{ overscrollBehavior: 'none' }}
          onPanStart={handleContentPanStart}
          onPan={handleContentPan}
          onPanEnd={handleContentPanEnd}
        >
          {/* Demo slot — Figma `image` node: 204px tall, full width,
              Background/backgroundOpacityTertiary. Reserved space for an
              animated demonstration of the Quick Bet (long-press) gesture;
              placeholder loop below until real motion content is ready. */}
          <div
            className="relative h-[204px] w-full overflow-hidden"
            style={{ background: DEMO_BG }}
          >
            <QuickBetDemoLoop />
          </div>

          {/* optionsContent — Figma: flex-col gap-[20px] (spacing10X),
              items-center, px-16 pt-16 pb-8. */}
          <div className="flex flex-col items-center gap-5 px-4 pb-2 pt-4">
            {/* Title + subtitle. */}
            <div className="flex flex-col items-center gap-1 text-center">
              <p className="text-[18px] font-bold leading-[27px] text-[#fbfbfb]">
                Derecha rápida
              </p>
              <p className="max-w-[285px] text-[14px] font-medium leading-[21px] text-[rgba(251,251,251,0.7)]">
                Apuesta al instante manteniendo una selección presionada
              </p>
            </div>

            {/* Step 1 — "Define tu monto default" + description + the
                stake input. type="text" (NOT type="number" — that fights
                the "$" prefix, shows spinner controls, and has inconsistent
                mobile-keyboard behavior) + inputMode "decimal" (supports 2
                decimal places, matching the Figma placeholder's own
                "00.00" precision) + a decimal pattern hint. FOCUS STROKE
                (Task 6.3): the wrapper's border turns solid white on focus
                (`focused` state, set via onFocus/onBlur) — error color
                still wins over focus if both are true (see
                inputBorderColor above). `outline-none` on the input itself
                replaces the browser's default blue ring with this custom
                treatment; transition-colors makes the change feel smooth
                rather than an abrupt snap. */}
            <div className="flex w-full flex-col gap-1">
              <ol className="list-decimal text-[14px] font-bold leading-[21px] text-[#fbfbfb]" start={1}>
                <li className="ms-[21px]">Define tu monto default</li>
              </ol>
              <div className="flex flex-col items-center gap-2.5">
                <p className="text-[14px] font-medium leading-[21px] text-[rgba(251,251,251,0.7)]">
                  El monto se guardará para estas apuestas. Puedes cambiarlo
                  cuando quieras en Mi perfil {'>'} Configuración de apuesta.
                </p>
                <div
                  className="flex h-12 w-full items-center gap-3 rounded-[12px] border px-4 py-3 transition-colors duration-150"
                  style={{
                    background: INPUT_BG,
                    borderColor: inputBorderColor,
                  }}
                >
                  <img src={editIcon} alt="" className="size-[18px] shrink-0" />
                  <span
                    className="text-[16px] font-medium leading-6"
                    style={{
                      color: quickBetAmount
                        ? '#fbfbfb'
                        : 'rgba(251,251,251,0.5)',
                    }}
                  >
                    $
                  </span>
                  <input
                    ref={inputRef}
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*\.?[0-9]{0,2}"
                    aria-label="Monto default de Quick Bet"
                    aria-invalid={showError}
                    placeholder="00.00"
                    value={quickBetAmount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    onFocus={handleAmountFocus}
                    onBlur={handleAmountBlur}
                    onPointerDownCapture={(e) => e.stopPropagation()}
                    className="min-w-0 flex-1 bg-transparent text-[16px] font-medium leading-6 text-[#fbfbfb] outline-none placeholder:text-[rgba(251,251,251,0.5)]"
                  />
                </div>
                {showError && (
                  <p
                    className="w-full text-left text-[12px] font-medium leading-4"
                    style={{ color: ERROR_COLOR }}
                  >
                    Ingresa un monto válido mayor a $0.
                  </p>
                )}
              </div>
            </div>

            {/* Step 2 — "Acepta el cambio de momios" + description + the
                odds-acceptance checkbox (Figma `checkbox`, node
                34715:77914). REAL <input type="checkbox"> for full mouse/
                touch/keyboard accessibility (Space/Enter toggle when
                focused, native semantics for screen readers) — visually
                hidden (opacity-0, absolutely positioned, but still in the
                tab order and hit-testable) over a decorative sibling box
                that renders the actual look, since real checkboxes can't
                be restyled to an arbitrary shape/gradient cross-browser via
                `appearance` alone. Tapping the <label> (row) OR the input
                itself toggles it — the label wraps both. Checked state
                (Figma): filled with the same primary gradient token as the
                "Jugar ahora" CTA (Action/actionPrimaryDefault resolves to
                the app's one purple CTA gradient) + a white checkmark, same
                20px size / 6px radius as the unchecked box. Checkmark is
                `checkbox-check.svg`, the exact asset uploaded for this
                control (assets/checkbox-check.svg) — not the reused
                success-check.png placeholder from the first pass. No focus
                treatment on this control (removed per explicit feedback —
                the checkbox only ever shows its default/checked/error
                border, never a white focus stroke). The validation
                highlight (`checkboxError`, red) is a separate color channel
                from the checked fill, so re-checking the box doesn't have
                to fight the error styling for priority. */}
            <div className="flex w-full flex-col gap-1">
              <ol className="list-decimal text-[14px] font-bold leading-[21px] text-[#fbfbfb]" start={2}>
                <li className="ms-[21px]">Acepta el cambio de momios</li>
              </ol>
              <div className="flex flex-col gap-2.5">
                <p className="text-[14px] font-medium leading-[21px] text-[rgba(251,251,251,0.7)]">
                  Este cambio solo aplica para este tipo de apuestas.
                </p>
                <label
                  htmlFor="quick-bet-odds-checkbox"
                  onPointerDownCapture={(e) => e.stopPropagation()}
                  className="flex cursor-pointer items-center gap-3 py-1"
                >
                  <span className="relative flex size-5 shrink-0 items-center justify-center">
                    <input
                      id="quick-bet-odds-checkbox"
                      ref={checkboxRef}
                      type="checkbox"
                      checked={oddsAccepted}
                      onChange={(e) => handleOddsCheckboxChange(e.target.checked)}
                      aria-invalid={checkboxError}
                      aria-describedby={checkboxError ? checkboxErrorId : undefined}
                      className="absolute inset-0 z-10 size-5 cursor-pointer appearance-none outline-none"
                    />
                    <span
                      aria-hidden
                      className="pointer-events-none flex size-5 items-center justify-center rounded-[6px] border-2 transition-colors duration-150"
                      style={{
                        borderColor: checkboxError
                          ? ERROR_COLOR
                          : oddsAccepted
                            ? 'transparent'
                            : 'rgba(251,251,251,0.3)',
                        backgroundImage: oddsAccepted ? PRIMARY_CTA_BG : undefined,
                      }}
                    >
                      {oddsAccepted && (
                        <img src={checkboxCheckIcon} alt="" className="h-2 w-[11px]" />
                      )}
                    </span>
                  </span>
                  <span className="text-left text-[14px] font-normal leading-[21px] text-[rgba(251,251,251,0.7)]">
                    Acepto el cambio de momios.
                  </span>
                </label>
                {checkboxError && (
                  <p
                    id={checkboxErrorId}
                    role="alert"
                    className="w-full text-left text-[12px] font-medium leading-4"
                    style={{ color: ERROR_COLOR }}
                  >
                    Debes aceptar el cambio de momios para continuar.
                  </p>
                )}
              </div>
            </div>

            {/* Step 3 — "Deja presionada la selección" + description. No
                interactive control here (Figma has none either). */}
            <div className="flex w-full flex-col gap-1">
              <ol className="list-decimal text-[14px] font-bold leading-[21px] text-[#fbfbfb]" start={3}>
                <li className="ms-[21px]">Deja presionada la selección</li>
              </ol>
              <p className="text-[14px] font-medium leading-[21px] text-[rgba(251,251,251,0.7)]">
                Cada apuesta se hará con ese monto al dejar presionado,
                siempre que tengas saldo.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Footer — two buttons on a blurred dark bar (Figma: backdrop-
            blur-2 + bg #101010, gap-[8px]/spacing4X). Pinned via `shrink-0`
            at the bottom of the flex column, so as the sheet's own height
            shrinks to the keyboard-visible viewport, this row naturally
            ends up sitting just above the keyboard rather than being
            covered by it. "Omitir" always dismisses (shared onClose);
            "Jugar ahora" only proceeds (same onClose) when the amount is
            valid — this is an onboarding blurb, not the real bet-placement
            flow, so it has no real bet to place yet, just gates on a valid
            stake before dismissing. */}
        <div
          className="flex shrink-0 items-center justify-center gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-2"
          style={{ backdropFilter: 'blur(2px)', background: '#101010' }}
        >
          <button
            type="button"
            onClick={onClose}
            onPointerDownCapture={(e) => e.stopPropagation()}
            className="flex h-12 flex-1 items-center justify-center active:scale-[0.98]"
            style={{ background: SECONDARY_BTN_BG, borderRadius: BTN_RADIUS }}
          >
            <span className="text-[16px] font-bold leading-6 text-white">
              Omitir
            </span>
          </button>
          <button
            type="button"
            onClick={handlePrimaryCta}
            onPointerDownCapture={(e) => e.stopPropagation()}
            className="flex h-12 flex-1 items-center justify-center active:scale-[0.98]"
            style={{
              backgroundImage: PRIMARY_CTA_BG,
              borderRadius: BTN_RADIUS,
            }}
          >
            <span className="text-[16px] font-bold leading-6 text-white">
              Jugar ahora
            </span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/**
 * Task 7 — the Quick Bet instructional animation. A visual REPLICA of the
 * real odds pill (PromoCarousel's `.qb-hold` buttons in HomeScreen.tsx),
 * not the real component: mounting the actual pick button here would drag
 * in `useLongPress`, `selectedIds`, and the rest of the live bet-slip
 * state this demo must stay isolated from. It shows exactly ONE selection
 * end-to-end — press-and-hold → progressive fill → completion → selected
 * state → ticket confirmation — reusing the real tokens/primitives at
 * every step instead of approximating them:
 *   - `.qb-hold` (index.css) for the fill/stroke, driven by the same
 *     registered custom properties (`--qb-progress` / `--qb-stroke-progress`)
 *     the real hold writes per-frame. Here a CSS keyframe loop writes them
 *     instead — no rAF loop, no event handlers, nothing that could fire a
 *     real bet.
 *   - The exact selected-state classes (border `#d2ff72`, lime→cyan
 *     gradient, bold odds value) for the "completed" face.
 *   - `TicketFace` (exported from EntryCreatedOverlay.tsx) for the
 *     confirmation — the actual ticket shape/checkmark/colors, not a
 *     reinvented one. Its reveal/pop/glow are re-timed into this same CSS
 *     loop (see the qbDemoTicket* keyframes in index.css for why: those
 *     effects are mount-triggered one-shots over there, and need to repeat
 *     every cycle here).
 *   - The hold segment intentionally uses a SHORTER demo-only duration
 *     (1500ms) than `buttonProgressionConfig.longPress.durationMs` (the
 *     real 3000ms hold) — watching the full-width pill fill for a real 3s
 *     on every loop of a repeating preview read as too slow, so this is a
 *     deliberate pacing choice, not an attempt to mirror the real timing
 *     exactly (see the comment block above `qbDemoProgress` in index.css).
 *
 * The touch pointer (`.qb-demo-pointer`) is a plain circular div — opacity
 * + scale only, so it never actually moves off the selection's center —
 * styled after the circular touch-emulation indicator browser devtools
 * show in mobile-preview mode (translucent, no cursor arrow), per the
 * task's spec.
 *
 * The loop itself needs no JS ticking at all — pure `animation: infinite`
 * — so it costs nothing extra while idle and stops doing any work the
 * instant this component unmounts (the sheet closing). `pointer-events-none`
 * keeps it (like the placeholder it replaces) incapable of capturing a tap
 * meant for the close button or backdrop.
 */
function QuickBetDemoLoop() {
  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      aria-hidden
    >
      {/* Fixed-size stage sized to the ticket's own box (~155×61,
          Figma 35252:75429) — both the pill/pointer group and the ticket
          center inside it via the SAME box, so neither layer shifts the
          layout as the loop swaps between them (no bottom-sheet height
          change during playback). */}
      <div className="relative h-[61px] w-[154.975px]">
        {/* Pill + pointer group — the single selection, and the circular
            touch indicator pressing it. Fades out as a unit once the
            pointer has released, handing off to the ticket below. */}
        <div className="qb-demo-pillgroup absolute inset-0 flex items-center justify-center">
          <div className="qb-hold qb-demo-pill relative flex h-11 w-[220px] items-center justify-center overflow-hidden rounded-xl border border-[rgba(251,251,251,0.08)] bg-[rgba(251,251,251,0.1)]">
            {/* Default (unpressed) face — same tokens as the real odds
                pill's idle state. Sits below the fill (.qb-hold::before,
                z-index 4) in paint order, same as the real button, so the
                progressive fill visibly tints over it during the hold. */}
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-medium leading-[15px] text-[rgba(251,251,251,0.5)]">
                Real Madrid
              </span>
              <span className="text-[13px] font-medium leading-4 text-[#fbfbfb]">
                2.75x
              </span>
            </div>

            {/* Selected face — the real completed-state look, opacity-
                swapped in by `qbDemoSelectedFace` at the exact moment the
                hold reaches 100% (matching how the real button's React
                state update lands in the same frame the fill finishes).
                Above the fill/stroke pseudo-elements (z-index 4/5). */}
            <div className="qb-demo-selected absolute inset-0 z-[6] flex flex-col items-center justify-center rounded-xl border border-[#d2ff72] bg-gradient-to-b from-[rgba(210,255,114,0.16)] to-[rgba(86,222,234,0.16)] opacity-0">
              <span className="text-[10px] font-medium leading-[15px] text-[rgba(251,251,251,0.5)]">
                Real Madrid
              </span>
              <span className="text-[13px] font-bold leading-4 text-[#fbfbfb]">
                2.75x
              </span>
            </div>
          </div>

          {/* Touch pointer — a circular, partially-transparent indicator
              (like devtools' mobile touch emulation dot), centered over
              the pill via its OWN absolute-inset + flex-centering wrapper
              (a sibling overlay, not a flex child of the pill) so it never
              drifts off it; only opacity/scale animate on the dot itself. */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="qb-demo-pointer size-16 rounded-full opacity-0"
              style={{
                background: 'rgba(251,251,251,0.28)',
                border: '1px solid rgba(251,251,251,0.45)',
                boxShadow: '0 0 12px rgba(251,251,251,0.25)',
              }}
            />
          </div>
        </div>

        {/* Ticket confirmation — the REAL ticket (TicketFace), reusing its
            exact shape/checkmark/colors. Reveal (circular clip-path),
            squash-stretch pop, and glow flash all mirror
            EntryCreatedOverlay's real motion language, re-timed into this
            loop (see index.css). The spark burst + genie flight into "Mis
            entradas" are intentionally not reproduced here — there's no
            tab to fly to in this isolated preview. */}
        <div className="qb-demo-ticket-wrap absolute inset-0 opacity-0">
          <div className="qb-demo-ticket-pop absolute inset-0">
            <div className="qb-demo-ticket-reveal absolute inset-0">
              <TicketFace />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

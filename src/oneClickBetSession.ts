import { useCallback, useEffect, useReducer, useRef } from 'react';
import type {
  DragEvent as ReactDragEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import type { Selection } from './types';

/**
 * ONE CLICK BET SESSION — the single authoritative gesture/entry-creation
 * state machine for Quick Bet long-press. Replaces the three independent
 * `useLongPress` instances that used to live in HomeScreen.tsx (PromoCarousel,
 * MarketAccordion × 2) — this hook is mounted ONCE (in App.tsx) and its
 * `bind`/`cancelActive` API is prop-drilled down to every pick surface, so
 * there is exactly one in-flight hold/timer/entry-creation sequence at a
 * time, no matter how many pick buttons exist.
 *
 * Selections only report input (bind) and consume whether they're the
 * active pressed one — they don't own progress or phase. The floating pill
 * (OneClickBetPill) consumes `session.progress`/`phase`/`odds`/`amount`/
 * `potentialWin` — it owns no timers either.
 */

export type OcbPhase =
  | 'idle'
  | 'candidate' // pointerdown just happened — release here is a normal tap
  | 'pressing' // engaged hold (> engageMs) — release cancels instead of tapping
  | 'reversing' // transient: released/interrupted mid-hold — pill stays visible, fill animates back to 0
  | 'exiting' // transient: fill has finished reversing to 0 — pill plays its squash/stretch exit before unmounting
  | 'completed' // hold reached 1.0 this tick, gesture done, entry not yet started
  | 'submitting' // async entry creation in flight
  | 'success'; // entry created, success overlay playing

export interface OneClickBetSessionState {
  phase: OcbPhase;
  selectionId: string | null;
  matchId: string | null;
  pointerId: number | null;
  startX: number | null;
  startY: number | null;
  odds: number | null;
  amount: number;
  potentialWin: number | null;
  progress: number;
  holdStartedAt: number | null;
  movementCancelled: boolean;
  tapSuppressed: boolean;
  pillVisible: boolean;
}

const idleState = (amount: number): OneClickBetSessionState => ({
  phase: 'idle',
  selectionId: null,
  matchId: null,
  pointerId: null,
  startX: null,
  startY: null,
  odds: null,
  amount,
  potentialWin: null,
  progress: 0,
  holdStartedAt: null,
  movementCancelled: false,
  tapSuppressed: false,
  pillVisible: false,
});

type Action =
  | {
      type: 'PRESS_START';
      pick: Selection;
      pointerId: number;
      x: number;
      y: number;
      amount: number;
      potentialWin: number;
      now: number;
    }
  | { type: 'TICK'; progress: number; phase: 'candidate' | 'pressing' }
  | { type: 'CANCEL' }
  | { type: 'REVERSE_TO_ZERO' }
  | { type: 'START_EXIT' }
  | { type: 'HOLD_COMPLETE' }
  | { type: 'START_SUBMIT' }
  | { type: 'SUBMIT_SUCCEEDED' }
  | { type: 'RESET' };

function reducer(
  state: OneClickBetSessionState,
  action: Action,
): OneClickBetSessionState {
  switch (action.type) {
    case 'PRESS_START':
      return {
        ...idleState(action.amount),
        phase: 'candidate',
        selectionId: action.pick.id,
        matchId: action.pick.matchId,
        pointerId: action.pointerId,
        startX: action.x,
        startY: action.y,
        odds: action.pick.odds,
        potentialWin: action.potentialWin,
        holdStartedAt: action.now,
      };
    case 'TICK':
      if (state.phase !== 'candidate' && state.phase !== 'pressing') return state;
      return {
        ...state,
        progress: action.progress,
        phase: action.phase,
        pillVisible: action.phase === 'pressing',
      };
    case 'CANCEL':
      // Progress is deliberately left untouched here — REVERSE_TO_ZERO (a
      // frame later, see abortPress) is what animates it down, so the pill
      // has an already-painted non-zero width to transition FROM.
      return { ...state, phase: 'reversing', movementCancelled: true, tapSuppressed: true };
    case 'REVERSE_TO_ZERO':
      if (state.phase !== 'reversing') return state;
      return { ...state, progress: 0 };
    case 'START_EXIT':
      if (state.phase !== 'reversing') return state;
      return { ...state, phase: 'exiting' };
    case 'HOLD_COMPLETE':
      return {
        ...state,
        phase: 'completed',
        progress: 1,
        pointerId: null,
        tapSuppressed: true,
      };
    case 'START_SUBMIT':
      return { ...state, phase: 'submitting' };
    case 'SUBMIT_SUCCEEDED':
      return { ...state, phase: 'success' };
    case 'RESET':
      return idleState(state.amount);
    default:
      return state;
  }
}

/** Shared potential-win calculation — the ONE place odds×amount is computed
    for Quick Bet, used by both the session and its callers (e.g. the debug
    pill preview), so the number can never drift between call sites. */
export function computePotentialWin(odds: number, amount: number): number {
  return Math.round(odds * amount);
}

export interface UseOneClickBetSessionOptions {
  /** Full hold duration — same clock drives the visual fill and confirmation. */
  holdDurationMs: number;
  /** candidate → pressing threshold; below this, release is a normal tap. */
  engageMs: number;
  /** Cancelled-hold fill-reverse animation duration. */
  reverseMs: number;
  /** Cancelled-hold pill squash/stretch EXIT animation duration — plays
   *  after the fill has finished reversing to 0, before the pill unmounts. */
  exitMs: number;
  /** Movement tolerance (px) — beyond this, the gesture is a scroll/drag, not a hold. */
  cancelTolerancePx: number;
  /** Configured Quick Bet stake. */
  amount: number;
  /** Gesture-complete: mark the pick "selected". Called once the hold reaches 1.0. */
  onAccept: (pick: Selection) => void;
  /** How long the pressed pick shows its selected state before entry creation starts. */
  acceptToSubmitMs: number;
  /** Async (or sync) entry creation. Resolving true → phase 'success'; false → cleanup. */
  onSubmit: () => boolean | Promise<boolean>;
  /** Onboarding readiness ('ready' | 'needsIntro' | 'needsSetup', see
   *  oneClickBetOnboarding.ts) — informational passthrough only. This hook
   *  does not gate or alter gesture behavior on it; it's returned alongside
   *  `session`/`bind`/`cancelActive` so a future onboarding redesign can
   *  query readiness without this hook needing to own any onboarding UI. */
  onboardingReadiness: OneClickBetOnboardingReadiness;
}

/** Kept as a local alias (not imported from oneClickBetOnboarding.ts) so this
 *  gesture module has no dependency on the onboarding module — it only
 *  needs the shape of the value, not where it comes from. */
export type OneClickBetOnboardingReadiness = 'ready' | 'needsIntro' | 'needsSetup';

export interface PressHandlers {
  ref: (el: HTMLButtonElement | null) => void;
  onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onPointerCancel: () => void;
  onClick: () => void;
  onContextMenu: (e: ReactMouseEvent<HTMLButtonElement>) => void;
  onDragStart: (e: ReactDragEvent<HTMLButtonElement>) => void;
}

export type BindPick = (pick: Selection) => PressHandlers;

export function useOneClickBetSession(
  onTap: (id: string) => void,
  options: UseOneClickBetSessionOptions,
) {
  const [session, dispatch] = useReducer(reducer, options.amount, idleState);

  // Plumbing refs for the rAF loop / native listeners — mirror the exact
  // mechanics of the old per-instance useLongPress, just now feeding a single
  // shared reducer instead of instance-local refs. Progress is no longer
  // written onto the DOM (the pressed selection has no inline fill anymore —
  // see CLAUDE.md's "floating pill" landmark); the floating pill reads
  // `session.progress` directly.
  const activePick = useRef<Selection | null>(null);
  const rafId = useRef<number | null>(null);
  const startedAt = useRef(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const completed = useRef(false);
  const cancelledHold = useRef(false);
  // Set when a pointermove exceeds cancelTolerancePx — read (and cleared) by
  // onPointerUp so the release doesn't fall through to a normal tap once the
  // gesture has been reclassified as a scroll/drag.
  const movementCancelled = useRef(false);
  const handledOnPointerUp = useRef(false);

  const optionsRef = useRef(options);
  optionsRef.current = options;
  const onTapRef = useRef(onTap);
  onTapRef.current = onTap;

  const stopLoop = () => {
    if (rafId.current != null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
  };

  // IDEMPOTENT centralized cleanup — safe to call from any trigger site
  // (early release, movement cancel, pointer cancel/leave, accordion
  // collapse, unmount, successful completion, failed submission, offer
  // rerender). Immediately stops the loop and forces phase back to idle,
  // no reverse animation (that's `abortPress`'s job for live gesture
  // interruption — see below).
  const cancelActive = useCallback(() => {
    stopLoop();
    completed.current = false;
    cancelledHold.current = false;
    activePick.current = null;
    dispatch({ type: 'RESET' });
  }, []);

  // Interrupts an in-flight PRESS (early release / movement-cancel / a new
  // press superseding this one). Distinguishes an "engaged" hold (>
  // engageMs elapsed — the pill was already visible) from a quick tap or an
  // early scroll/drag that never really started: engaged interruptions play
  // the transient 'reversing' phase (pill stays visible, fill animates back
  // to 0, THEN dismisses); the rest reset silently with no pressed/reversing
  // visual and no fallthrough tap.
  //
  // Gesture cleanup (stopping the rAF loop, clearing the active pick, tap
  // suppression) all happens synchronously, right here — matching the old
  // inline-button behavior where releasing the finger immediately let go of
  // the gesture even though the fill kept animating. Only the VISUAL
  // cleanup (the reverse animation, then hiding the pill) is deferred.
  const abortPress = useCallback(() => {
    stopLoop();
    completed.current = false;
    const wasActive = activePick.current != null;
    let engaged = false;
    if (wasActive) {
      const elapsedMs = performance.now() - startedAt.current;
      engaged = elapsedMs > optionsRef.current.engageMs;
      if (engaged) cancelledHold.current = true;
    }
    activePick.current = null;
    if (wasActive) {
      if (engaged) {
        // A meaningful hold was interrupted. `CANCEL` flips the phase to
        // 'reversing' WITHOUT touching progress, so the pill's already-
        // painted fill width becomes the animation's start point (this
        // dispatch commits synchronously — no rAF/paint involved — so it
        // never depends on the compositor being active). A macrotask later
        // (setTimeout 0, NOT requestAnimationFrame: rAF can be suspended
        // entirely in backgrounded/inactive tabs, per the "never blocks
        // scrolling" and general-robustness requirements — a timer boundary
        // gives the same "one commit later" guarantee without that risk),
        // `REVERSE_TO_ZERO` drops progress to 0 while still 'reversing' —
        // the pill (which only enables its width transition in that phase)
        // animates smoothly down over reverseMs, matching the previous
        // inline button's CSS-transition reversal exactly. The hide timer
        // starts from THIS point (not the CANCEL dispatch) so the pill
        // dismisses exactly when the visual reversal finishes. Once the fill
        // reversal itself completes (reverseMs later), `START_EXIT` flips
        // the phase to 'exiting' — the pill (still mounted, still visible)
        // plays its own squash/stretch exit over `exitMs`, and only THEN
        // does the final `cancelActive` reset the session (and the pill's
        // `pillVisible`-gated mount) back to idle. This guarantees the exit
        // motion is never skipped and the bet slip never restores in the
        // same frame progress hits 0.
        dispatch({ type: 'CANCEL' });
        window.setTimeout(() => {
          dispatch({ type: 'REVERSE_TO_ZERO' });
          window.setTimeout(() => {
            dispatch({ type: 'START_EXIT' });
            window.setTimeout(cancelActive, optionsRef.current.exitMs);
          }, optionsRef.current.reverseMs);
        }, 0);
      } else {
        // Never engaged (quick tap) — no visible "reversing" state, just
        // clear the session so the next press starts clean. The tap
        // itself (onTapRef) still fires normally from the caller.
        dispatch({ type: 'RESET' });
      }
    }
  }, [cancelActive]);

  const tick = useCallback(() => {
    const { holdDurationMs, engageMs, acceptToSubmitMs } = optionsRef.current;
    const elapsed = performance.now() - startedAt.current;
    const p = Math.min(1, elapsed / holdDurationMs);
    const phase: 'candidate' | 'pressing' = elapsed >= engageMs ? 'pressing' : 'candidate';
    dispatch({ type: 'TICK', progress: p, phase });

    if (p >= 1) {
      const pick = activePick.current;
      stopLoop();
      activePick.current = null;

      if (pick != null) {
        completed.current = true;
        dispatch({ type: 'HOLD_COMPLETE' });
        optionsRef.current.onAccept(pick);

        window.setTimeout(async () => {
          dispatch({ type: 'START_SUBMIT' });
          const ok = await optionsRef.current.onSubmit();
          if (ok) {
            dispatch({ type: 'SUBMIT_SUCCEEDED' });
          } else {
            cancelActive();
          }
        }, acceptToSubmitMs);
      } else {
        // No pick captured — nothing to accept; treat exactly like a
        // cancelled hold so the UI never shows a false "completed" look.
        cancelledHold.current = true;
        cancelActive();
      }
      return;
    }
    rafId.current = requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancelActive]);

  // Unmount safety — stop the rAF loop if the app unmounts mid-press (no
  // dispatch needed post-unmount; React 18 no-ops state updates after
  // unmount, but stopping the loop avoids a dangling native-DOM write).
  useEffect(() => stopLoop, []);

  // Native listener attach/detach — identical to the mechanics this
  // replaces: capture-phase, passive:false, one stable per-id ref callback
  // (see the comment in the old useLongPress for why per-id, not a single
  // shared ref slot).
  const attachNativeListeners = (el: HTMLElement): (() => void) => {
    const preventNative = (e: Event) => e.preventDefault();
    el.addEventListener('selectstart', preventNative, { capture: true, passive: false });
    el.addEventListener('contextmenu', preventNative, { capture: true, passive: false });
    el.addEventListener('dragstart', preventNative, { capture: true, passive: false });

    const preventTouchDefault = (e: TouchEvent) => {
      if (e.touches.length === 1 && !cancelledHold.current && activePick.current !== null) {
        e.preventDefault();
      }
    };
    el.addEventListener('touchstart', preventTouchDefault, { capture: true, passive: false });

    return () => {
      el.removeEventListener('selectstart', preventNative, { capture: true });
      el.removeEventListener('contextmenu', preventNative, { capture: true });
      el.removeEventListener('dragstart', preventNative, { capture: true });
      el.removeEventListener('touchstart', preventTouchDefault, { capture: true });
    };
  };

  const nativeRefs = useRef(new Map<string, (el: HTMLButtonElement | null) => void>());
  const nativeCleanups = useRef(new Map<string, () => void>());
  const getNativeRef = (id: string) => {
    let ref = nativeRefs.current.get(id);
    if (!ref) {
      ref = (el) => {
        nativeCleanups.current.get(id)?.();
        nativeCleanups.current.delete(id);
        if (el != null) nativeCleanups.current.set(id, attachNativeListeners(el));
      };
      nativeRefs.current.set(id, ref);
    }
    return ref;
  };

  const bind: BindPick = useCallback(
    (pick) => ({
      ref: getNativeRef(pick.id),
      onPointerDown: (e) => {
        completed.current = false;
        cancelledHold.current = false;
        movementCancelled.current = false;
        handledOnPointerUp.current = false;
        // Only one session in flight ever — supersede whatever was pressing.
        if (activePick.current != null) abortPress();

        activePick.current = pick;
        startedAt.current = performance.now();
        startX.current = e.clientX;
        startY.current = e.clientY;

        const amount = optionsRef.current.amount;
        dispatch({
          type: 'PRESS_START',
          pick,
          pointerId: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          amount,
          potentialWin: computePotentialWin(pick.odds, amount),
          now: startedAt.current,
        });
        rafId.current = requestAnimationFrame(tick);
      },
      // Reclassifies the gesture as a scroll/drag once it exceeds
      // cancelTolerancePx — before the engageMs threshold this cancels
      // silently (candidate never became a hold, pill never shown); after
      // it, abortPress plays the same reverse-then-dismiss as any other
      // interruption. Never calls preventDefault, so native scrolling /
      // carousel dragging is never delayed.
      onPointerMove: (e) => {
        if (activePick.current?.id !== pick.id) return;
        const dx = e.clientX - startX.current;
        const dy = e.clientY - startY.current;
        if (Math.hypot(dx, dy) > optionsRef.current.cancelTolerancePx) {
          movementCancelled.current = true;
          abortPress();
        }
      },
      onPointerUp: () => {
        if (activePick.current?.id === pick.id) abortPress();
        handledOnPointerUp.current = true;
        if (completed.current) {
          completed.current = false;
          return;
        }
        if (cancelledHold.current) {
          cancelledHold.current = false;
          return;
        }
        if (movementCancelled.current) {
          movementCancelled.current = false;
          return;
        }
        onTapRef.current(pick.id);
      },
      onPointerLeave: () => {
        if (activePick.current?.id === pick.id) abortPress();
      },
      onPointerCancel: () => {
        if (activePick.current?.id === pick.id) abortPress();
      },
      onClick: () => {
        if (handledOnPointerUp.current) {
          handledOnPointerUp.current = false;
          return;
        }
        onTapRef.current(pick.id);
      },
      onContextMenu: (e) => e.preventDefault(),
      onDragStart: (e) => e.preventDefault(),
    }),
    [abortPress, tick],
  );

  return { session, bind, cancelActive, onboardingReadiness: options.onboardingReadiness };
}
